package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

// ContentStore serves the study content produced offline by scripts/content:
// content/bank.json (ordered headwords) and content/cards/<word>.json.
// The pipeline keeps adding cards while the app runs, so the store reloads
// itself periodically and swaps the new snapshot in atomically.
type ContentStore struct {
	dir string
	tts *TTSService

	mu      sync.RWMutex
	words   []WordEntry
	cards   map[string]json.RawMessage
	sources map[string]string // raw source word -> lemma key, for migrating old records
}

// WordEntry is one headword in study order.
type WordEntry struct {
	Word  string   `json:"word"`  // display form (e.g. "January")
	Key   string   `json:"key"`   // lowercase record key
	Rank  int      `json:"rank"`  // position in the original frequency list
	Level string   `json:"level"` // CEFR level of the main sense
	Kind  string   `json:"kind"`  // how the meaning is drawn: timeline, relation, scale, spatial, icon, none
	POS   []string `json:"pos"`
	Forms []string `json:"forms"` // inflected forms from the old list (was, were -> be), for highlighting
	Ready bool     `json:"ready"` // a card exists
}

type bankFile struct {
	Lemmas []struct {
		Lemma   string   `json:"lemma"`
		Rank    int      `json:"rank"`
		Sources []string `json:"sources"`
	} `json:"lemmas"`
}

type cardSummary struct {
	Level  string `json:"level"`
	Senses []struct {
		POS      string `json:"pos"`
		Examples []struct {
			Text string `json:"text"`
		} `json:"examples"`
	} `json:"senses"`
	Visual struct {
		Kind string `json:"kind"`
	} `json:"visual"`
}

func NewContentStore(dir string, tts *TTSService) *ContentStore {
	s := &ContentStore{dir: dir, tts: tts, cards: map[string]json.RawMessage{}, sources: map[string]string{}}
	if err := s.Reload(); err != nil {
		log.Printf("content: %v (study content unavailable until the pipeline writes it)", err)
	}
	return s
}

// Watch reloads the content every interval until stop is closed, calling after() on each successful reload.
func (s *ContentStore) Watch(interval time.Duration, stop <-chan struct{}, after func()) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			if err := s.Reload(); err != nil {
				log.Printf("content reload: %v", err)
				continue
			}
			if after != nil {
				after()
			}
		}
	}
}

func (s *ContentStore) Reload() error {
	raw, err := os.ReadFile(filepath.Join(s.dir, "bank.json"))
	if err != nil {
		return err
	}
	var bank bankFile
	if err := json.Unmarshal(raw, &bank); err != nil {
		return err
	}
	words := make([]WordEntry, 0, len(bank.Lemmas))
	cards := make(map[string]json.RawMessage, len(bank.Lemmas))
	sources := map[string]string{}
	for _, l := range bank.Lemmas {
		key := strings.ToLower(l.Lemma)
		entry := WordEntry{Word: l.Lemma, Key: key, Rank: l.Rank, Kind: "none", POS: []string{}, Forms: []string{}}
		for _, src := range l.Sources {
			src = strings.ToLower(src)
			sources[src] = key
			if src != key {
				entry.Forms = append(entry.Forms, src)
			}
		}
		if data, err := os.ReadFile(filepath.Join(s.dir, "cards", key+".json")); err == nil {
			var c cardSummary
			if json.Unmarshal(data, &c) == nil && len(c.Senses) > 0 {
				entry.Ready = true
				entry.Level = c.Level
				if c.Visual.Kind != "" {
					entry.Kind = c.Visual.Kind
				}
				for _, sense := range c.Senses {
					if !contains(entry.POS, sense.POS) {
						entry.POS = append(entry.POS, sense.POS)
					}
				}
				cards[key] = data
			}
		}
		words = append(words, entry)
	}
	sort.SliceStable(words, func(i, j int) bool { return words[i].Rank < words[j].Rank })

	s.mu.Lock()
	s.words, s.cards, s.sources = words, cards, sources
	s.mu.Unlock()
	return nil
}

func (s *ContentStore) Words() []WordEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.words
}

// Sources returns a copy of the raw-word -> lemma map.
func (s *ContentStore) Sources() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]string, len(s.sources))
	for k, v := range s.sources {
		out[k] = v
	}
	return out
}

func (s *ContentStore) Card(key string) (json.RawMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.cards[strings.ToLower(key)]
	return c, ok
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// handleWords handles GET /api/words — every headword in study order.
func (h *handler) handleWords(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]any{"words": h.content.Words()})
}

// ClipAudio says where the recording of one piece of card text lives.
type ClipAudio struct {
	Text  string `json:"text"`
	Kind  string `json:"kind"` // word | sentence
	URL   string `json:"url"`
	Ready bool   `json:"ready"` // false: POST /api/tts with text+kind creates it on demand
}

// handleCard handles GET /api/cards/{word} — the card plus audio for the word and every example.
func (h *handler) handleCard(w http.ResponseWriter, r *http.Request) {
	key := strings.ToLower(chi.URLParam(r, "word"))
	raw, ok := h.content.Card(key)
	if !ok {
		respondError(w, http.StatusNotFound, "no card for this word yet")
		return
	}
	var card map[string]any
	var summary cardSummary
	if err := json.Unmarshal(raw, &card); err != nil || json.Unmarshal(raw, &summary) != nil {
		respondError(w, http.StatusInternalServerError, "card is unreadable")
		return
	}
	word, _ := card["word"].(string)
	audio := map[string]any{"word": h.tts.Clip(word, "word")}
	var examples []ClipAudio
	for _, sense := range summary.Senses {
		for _, ex := range sense.Examples {
			examples = append(examples, h.tts.Clip(ex.Text, "sentence"))
		}
	}
	audio["examples"] = examples
	card["audio"] = audio
	w.Header().Set("Cache-Control", "no-cache")
	respondJSON(w, http.StatusOK, card)
}
