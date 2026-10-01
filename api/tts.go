package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/time/rate"
)

// sentenceStyle must match SENTENCE_STYLE in scripts/content/lib.py: it is part
// of the cache key, so both sides find the same file for the same text.
const sentenceStyle = "Clear, natural American English at a relaxed, steady pace, like a friendly teacher reading an example sentence to a learner."

var (
	errTTSDailyCap = errors.New("tts daily cap reached")
	audioKeyRe     = regexp.MustCompile(`^[0-9a-f]{20}$`)
)

// TTSService reads recordings from the shared audio cache and creates missing
// ones on demand (the learner's own sentence, a suggested fix, a clip the
// batch pipeline has not reached yet).
type TTSService struct {
	provider, voice string
	dir             string
	mimoKey         string
	doubaoKey       string
	dailyCap        int
	client          *http.Client

	mu    sync.Mutex
	day   string
	used  int
	locks map[string]*sync.Mutex
}

func NewTTSService(contentDir, provider, voice, mimoKey, doubaoKey string, dailyCap int) *TTSService {
	dir := filepath.Join(contentDir, "audio", provider+"-"+voice)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Printf("tts: cannot create %s: %v", dir, err)
	}
	return &TTSService{
		provider: provider, voice: voice, dir: dir, mimoKey: mimoKey, doubaoKey: doubaoKey, dailyCap: dailyCap,
		client: &http.Client{Timeout: 60 * time.Second}, locks: map[string]*sync.Mutex{},
	}
}

// style is the delivery instruction sent with the text. Single words get none:
// with a teacher-like style MiMo added fillers ("Um, among") in testing.
func (t *TTSService) style(kind string) string {
	if t.provider == "mimo" && kind == "sentence" {
		return sentenceStyle
	}
	return ""
}

// Key is the cache key shared with scripts/content (lib.clip_key).
func (t *TTSService) Key(text, kind string) string {
	sum := sha1.Sum([]byte(t.provider + "\n" + t.voice + "\n" + t.style(kind) + "\n" + text))
	return hex.EncodeToString(sum[:])[:20]
}

func (t *TTSService) path(key string) string { return filepath.Join(t.dir, key+".mp3") }

// Clip describes the recording for text without creating it.
func (t *TTSService) Clip(text, kind string) ClipAudio {
	key := t.Key(text, kind)
	_, err := os.Stat(t.path(key))
	return ClipAudio{Text: text, Kind: kind, URL: "/audio/" + key + ".mp3", Ready: err == nil}
}

// Ensure returns the clip, synthesizing and caching it first when needed.
func (t *TTSService) Ensure(ctx context.Context, text, kind string) (ClipAudio, error) {
	clip := t.Clip(text, kind)
	if clip.Ready {
		return clip, nil
	}
	key := t.Key(text, kind)
	lock := t.keyLock(key)
	lock.Lock()
	defer lock.Unlock()
	if clip = t.Clip(text, kind); clip.Ready { // another request made it while we waited
		return clip, nil
	}
	if !t.take() {
		return clip, errTTSDailyCap
	}
	audio, err := t.synthesize(ctx, text, t.style(kind))
	if err != nil {
		return clip, err
	}
	if err := writeFileAtomic(t.path(key), audio); err != nil {
		return clip, err
	}
	meta, _ := json.Marshal(map[string]any{
		"kind": kind, "text": text, "provider": t.provider, "voice": t.voice, "style": t.style(kind),
		"unverified": true, "source": "app", "created": time.Now().Format("2006-01-02"),
	})
	_ = writeFileAtomic(filepath.Join(t.dir, key+".json"), meta)
	clip.Ready = true
	return clip, nil
}

func (t *TTSService) keyLock(key string) *sync.Mutex {
	t.mu.Lock()
	defer t.mu.Unlock()
	l, ok := t.locks[key]
	if !ok {
		l = &sync.Mutex{}
		t.locks[key] = l
	}
	return l
}

// take counts one on-demand synthesis against today's cap.
func (t *TTSService) take() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	today := time.Now().Format("2006-01-02")
	if t.day != today {
		t.day, t.used = today, 0
		t.locks = map[string]*sync.Mutex{}
	}
	if t.used >= t.dailyCap {
		return false
	}
	t.used++
	return true
}

func writeFileAtomic(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// romanLike matches short capitals made of Roman-numeral letters (ID, CV, CD),
// which MiMo reads as numbers ("ID card" came out as "four hundred ninety-nine
// card"). speakable spells them with dots so they are read as letters; only the
// spoken text changes, never the cache key. Same rule as lib.speakable.
var romanLike = regexp.MustCompile(`\b([IVXLCDM]{2,4})\b(\.?)`)

func speakable(text string) string {
	return romanLike.ReplaceAllStringFunc(text, func(m string) string {
		letters := strings.TrimSuffix(m, ".")
		return strings.Join(strings.Split(letters, ""), ".") + "."
	})
}

func (t *TTSService) synthesize(ctx context.Context, text, style string) ([]byte, error) {
	text = speakable(text)
	switch t.provider {
	case "mimo":
		return t.mimo(ctx, text, style)
	case "doubao":
		return t.doubao(ctx, text)
	}
	return nil, fmt.Errorf("unknown TTS provider %q", t.provider)
}

func (t *TTSService) mimo(ctx context.Context, text, style string) ([]byte, error) {
	messages := []map[string]string{}
	if style != "" {
		messages = append(messages, map[string]string{"role": "user", "content": style})
	}
	messages = append(messages, map[string]string{"role": "assistant", "content": text})
	body, _ := json.Marshal(map[string]any{
		"model": "mimo-v2.5-tts", "messages": messages, "audio": map[string]string{"format": "mp3", "voice": t.voice},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.xiaomimimo.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+t.mimoKey)
	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mimo: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mimo HTTP %d: %.200s", resp.StatusCode, raw)
	}
	var out struct {
		Choices []struct {
			Message struct {
				Audio struct {
					Data string `json:"data"`
				} `json:"audio"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || len(out.Choices) == 0 || out.Choices[0].Message.Audio.Data == "" {
		return nil, fmt.Errorf("mimo: no audio in response: %.200s", raw)
	}
	return base64.StdEncoding.DecodeString(out.Choices[0].Message.Audio.Data)
}

func (t *TTSService) doubao(ctx context.Context, text string) ([]byte, error) {
	resource := "seed-tts-1.0"
	if strings.Contains(t.voice, "_uranus_") {
		resource = "seed-tts-2.0"
	}
	body, _ := json.Marshal(map[string]any{
		"user": map[string]string{"uid": "wordcore"},
		"req_params": map[string]any{"text": text, "speaker": t.voice,
			"audio_params": map[string]any{"format": "mp3", "sample_rate": 24000}},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://openspeech.bytedance.com/api/v3/tts/unidirectional", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Api-Key", t.doubaoKey)
	req.Header.Set("X-Api-Resource-Id", resource)
	req.Header.Set("X-Api-Request-Id", fmt.Sprintf("wordcore-%d", time.Now().UnixNano()))
	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("doubao: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("doubao HTTP %d: %.200s", resp.StatusCode, raw)
	}
	var audio bytes.Buffer
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 1<<20), 8<<20)
	for sc.Scan() {
		line := bytes.TrimSpace(sc.Bytes())
		if len(line) == 0 {
			continue
		}
		var msg struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Data    string `json:"data"`
		}
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}
		switch {
		case msg.Code == 0 && msg.Data != "":
			chunk, err := base64.StdEncoding.DecodeString(msg.Data)
			if err != nil {
				return nil, err
			}
			audio.Write(chunk)
		case msg.Code == 20000000:
			return audio.Bytes(), nil
		case msg.Code != 0:
			return nil, fmt.Errorf("doubao code %d: %s", msg.Code, msg.Message)
		}
	}
	if audio.Len() == 0 {
		return nil, errors.New("doubao: no audio")
	}
	return audio.Bytes(), sc.Err()
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// handleTTS handles POST /api/tts {text, kind} — returns the clip, creating it if needed.
func (h *handler) handleTTS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Text string `json:"text"`
		Kind string `json:"kind"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Kind != "word" && req.Kind != "sentence" {
		req.Kind = "sentence"
	}
	if req.Text == "" || len([]rune(req.Text)) > 300 {
		respondError(w, http.StatusBadRequest, "text must be 1-300 characters")
		return
	}
	clip, err := h.tts.Ensure(r.Context(), req.Text, req.Kind)
	switch {
	case errors.Is(err, errTTSDailyCap):
		respondError(w, http.StatusTooManyRequests, "the voice limit for today is reached")
	case err != nil:
		log.Printf("tts error: %v", err)
		respondError(w, http.StatusBadGateway, "the voice service did not answer, try again")
	default:
		respondJSON(w, http.StatusOK, clip)
	}
}

// handleAudio handles GET /audio/{key}.mp3. Public on purpose: <audio> cannot send
// the auth header, and keys are content hashes. ServeFile answers Range requests,
// which iOS Safari needs to play audio.
func (h *handler) handleAudio(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "file")
	key := strings.TrimSuffix(name, ".mp3")
	if !audioKeyRe.MatchString(key) || name != key+".mp3" {
		http.NotFound(w, r)
		return
	}
	path := h.tts.path(key)
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}

// ttsRateLimiter keeps one user from burning the day's voice budget in seconds.
func ttsRateLimiter() func(http.Handler) http.Handler {
	return rateLimiter(func(r *http.Request) string {
		if claims := claimsFromCtx(r); claims != nil {
			return claims.UserID
		}
		return ""
	}, rate.Limit(30.0/60.0), 10, "too many voice requests — please wait a moment")
}
