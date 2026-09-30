package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

// Keys computed by scripts/content/lib.py (clip_key) for the same inputs.
func TestTTSKeyMatchesContentPipeline(t *testing.T) {
	tts := NewTTSService(t.TempDir(), "mimo", "Mia", "", "", 1)
	if got := tts.Key("My laptop battery died while I was writing an important email.", "sentence"); got != "0f05042a18df662a3372" {
		t.Fatalf("sentence key = %s, want the pipeline's 0f05042a18df662a3372", got)
	}
	if got := tts.Key("while", "word"); got != "6bd9254b3893a51b249b" {
		t.Fatalf("word key = %s, want the pipeline's 6bd9254b3893a51b249b", got)
	}
	if tts.Key("while", "word") == NewTTSService(t.TempDir(), "doubao", "Mia", "", "", 1).Key("while", "word") {
		t.Fatal("switching provider must not reuse another provider's recordings")
	}
}

func TestTTSDailyCap(t *testing.T) {
	tts := NewTTSService(t.TempDir(), "mimo", "Mia", "", "", 1)
	if !tts.take() || tts.take() {
		t.Fatal("the cap must allow exactly dailyCap on-demand clips per day")
	}
}

func writeContent(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	must := func(err error) {
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(dir, "cards"), 0o755))
	must(os.WriteFile(filepath.Join(dir, "bank.json"), []byte(`{"lemmas": [
		{"lemma": "result", "rank": 12, "sources": ["results", "result"]},
		{"lemma": "January", "rank": 3, "sources": ["january"]}
	]}`), 0o644))
	must(os.WriteFile(filepath.Join(dir, "cards", "result.json"), []byte(`{"word": "result", "level": "B1",
		"senses": [{"pos": "noun", "definition": "what happens because of something", "pattern": "the result of sth",
		"examples": [{"text": "The result surprised everyone at work.", "context": "at work"}]}],
		"visual": {"kind": "none"}}`), 0o644))
	return dir
}

func TestContentStoreOrdersWordsAndMapsSources(t *testing.T) {
	store := NewContentStore(writeContent(t), NewTTSService(t.TempDir(), "mimo", "Mia", "", "", 1))
	words := store.Words()
	if len(words) != 2 || words[0].Key != "january" || words[1].Key != "result" {
		t.Fatalf("words must follow frequency rank with lowercase keys, got %+v", words)
	}
	if words[0].Ready || !words[1].Ready || words[1].Level != "B1" || words[1].POS[0] != "noun" {
		t.Fatalf("ready/level/pos come from the card file, got %+v", words)
	}
	if store.Sources()["results"] != "result" {
		t.Fatal("inflected source words must map to their headword")
	}
}

func TestHandleCardAddsAudioForWordAndExamples(t *testing.T) {
	contentDir := writeContent(t)
	tts := NewTTSService(contentDir, "mimo", "Mia", "", "", 1)
	h := &handler{content: NewContentStore(contentDir, tts), tts: tts}
	// Pretend the pipeline already recorded the word itself.
	if err := os.WriteFile(tts.path(tts.Key("result", "word")), []byte("mp3"), 0o644); err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/api/cards/{word}", h.handleCard)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/cards/Result", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var card struct {
		Audio struct {
			Word     ClipAudio   `json:"word"`
			Examples []ClipAudio `json:"examples"`
		} `json:"audio"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &card); err != nil {
		t.Fatal(err)
	}
	if !card.Audio.Word.Ready || card.Audio.Word.URL != "/audio/"+tts.Key("result", "word")+".mp3" {
		t.Fatalf("word audio should point at the recorded clip, got %+v", card.Audio.Word)
	}
	if len(card.Audio.Examples) != 1 || card.Audio.Examples[0].Ready || card.Audio.Examples[0].Kind != "sentence" {
		t.Fatalf("unrecorded examples must be listed as not ready, got %+v", card.Audio.Examples)
	}
}

func TestHandleAudioOnlyServesContentKeys(t *testing.T) {
	tts := NewTTSService(t.TempDir(), "mimo", "Mia", "", "", 1)
	h := &handler{tts: tts}
	key := tts.Key("while", "word")
	if err := os.WriteFile(tts.path(key), []byte("ID3"), 0o644); err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Get("/audio/{file}", h.handleAudio)
	for path, want := range map[string]int{
		"/audio/" + key + ".mp3":          http.StatusOK,
		"/audio/" + key + ".json":         http.StatusNotFound,
		"/audio/..%2F..%2Fbank.json":      http.StatusNotFound,
		"/audio/0000000000000000000a.mp3": http.StatusNotFound,
	} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != want {
			t.Errorf("%s: status %d, want %d", path, rec.Code, want)
		}
	}
}

func TestEnsureReturnsCachedClipWithoutCallingProvider(t *testing.T) {
	tts := NewTTSService(t.TempDir(), "mimo", "Mia", "", "", 0) // cap 0: any synthesis would fail
	if err := os.WriteFile(tts.path(tts.Key("Hello there.", "sentence")), []byte("ID3"), 0o644); err != nil {
		t.Fatal(err)
	}
	clip, err := tts.Ensure(context.Background(), "Hello there.", "sentence")
	if err != nil || !clip.Ready {
		t.Fatalf("a cached clip must be returned as is, got %+v, %v", clip, err)
	}
	if _, err := tts.Ensure(context.Background(), "Not cached.", "sentence"); err != errTTSDailyCap {
		t.Fatalf("uncached text beyond the cap must fail with errTTSDailyCap, got %v", err)
	}
}

func TestMergeRowsKeepsFurthestProgress(t *testing.T) {
	early := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	late := early.Add(48 * time.Hour)
	headword := mergeRow{Status: "learning", Draft: "", LastChecked: "old", Attempts: 2, Accepted: 1, UpdatedAt: early}
	inflected := mergeRow{
		Status: "mastered", Draft: "draft from inflected form", LastChecked: "new", Attempts: 3, Accepted: 3,
		ReviewCount: 2, NextReviewAt: sql.NullTime{Time: late, Valid: true}, UpdatedAt: late,
	}
	out := mergeRows(headword, inflected)
	if out.Status != "mastered" || out.NextReviewAt.Time != late || out.ReviewCount != 2 {
		t.Fatalf("mastered status and its review schedule must survive, got %+v", out)
	}
	if out.Draft != "draft from inflected form" || out.LastChecked != "new" || out.Attempts != 5 || out.Accepted != 4 {
		t.Fatalf("empty draft is filled, latest check wins, counters add up; got %+v", out)
	}

	both := mergeRows(
		mergeRow{Status: "mastered", NextReviewAt: sql.NullTime{Time: late, Valid: true}, UpdatedAt: late},
		mergeRow{Status: "mastered", NextReviewAt: sql.NullTime{Time: early, Valid: true}, UpdatedAt: early},
	)
	if both.NextReviewAt.Time != early {
		t.Fatal("when both forms were mastered, the earlier review date wins")
	}
	if mergeRows(mergeRow{Status: "learning"}, mergeRow{Status: "new"}).NextReviewAt.Valid {
		t.Fatal("a word that is not mastered has no review date")
	}
}

func TestIconStoreFetchesOnceAndRejectsBadNames(t *testing.T) {
	calls := 0
	cdn := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path == "/coffee-duotone.svg" {
			w.Write([]byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`))
			return
		}
		http.NotFound(w, r)
	}))
	defer cdn.Close()
	icons := NewIconStore(t.TempDir())
	icons.source = cdn.URL + "/%s-duotone.svg"
	h := &handler{icons: icons}
	r := chi.NewRouter()
	r.Get("/icons/{file}", h.handleIcon)
	for i := 0; i < 2; i++ {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/icons/coffee.svg", nil))
		if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/svg+xml" {
			t.Fatalf("status %d type %q", rec.Code, rec.Header().Get("Content-Type"))
		}
	}
	if calls != 1 {
		t.Fatalf("the CDN must be asked once and the icon cached, got %d calls", calls)
	}
	for _, bad := range []string{"/icons/..%2Fbank.json", "/icons/Coffee.svg", "/icons/missing.svg"} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, bad, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404", bad, rec.Code)
		}
	}
}
