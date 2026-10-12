package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"unicode"
)

// errCopiedExample is the error code the frontend matches to explain why a
// sentence was turned away without an AI check.
const errCopiedExample = "copied_example"

// exampleKey normalizes a sentence for comparing it with the card's examples:
// case, surrounding spaces, runs of spaces and trailing punctuation are ignored.
func exampleKey(sentence string) string {
	s := strings.TrimRightFunc(strings.TrimSpace(sentence), func(r rune) bool {
		return unicode.IsPunct(r) || unicode.IsSpace(r)
	})
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

// copiesExample reports whether sentence is one of the word's example
// sentences (or the reference sentence the learner was shown).
func (h *handler) copiesExample(word, sentence string, extra ...string) bool {
	key := exampleKey(sentence)
	if key == "" {
		return false
	}
	var examples []string
	if h.content != nil {
		examples = h.content.Examples(word)
	}
	for _, ex := range append(examples, extra...) {
		if exampleKey(ex) == key {
			return true
		}
	}
	return false
}

// handleCheckSentence handles POST /api/check-sentence
// Proxies the request to OpenRouter and returns structured AI feedback.
func (h *handler) handleCheckSentence(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Word              string `json:"word"`
		Definition        string `json:"definition"`
		ReferenceSentence string `json:"referenceSentence"`
		UserSentence      string `json:"userSentence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Word = strings.TrimSpace(req.Word)
	req.UserSentence = strings.TrimSpace(req.UserSentence)

	if req.Word == "" {
		respondError(w, http.StatusBadRequest, "word is required")
		return
	}
	if req.UserSentence == "" {
		respondError(w, http.StatusBadRequest, "userSentence is required")
		return
	}
	if len(req.UserSentence) > 1000 {
		respondError(w, http.StatusBadRequest, "sentence is too long (max 1000 characters)")
		return
	}

	if h.copiesExample(req.Word, req.UserSentence, req.ReferenceSentence) {
		respondJSON(w, http.StatusUnprocessableEntity, map[string]string{
			"error": "this is the example sentence; write your own",
			"code":  errCopiedExample,
		})
		return
	}

	claims := claimsFromCtx(r)
	result, err := h.or.CheckSentence(
		r.Context(),
		req.Word, req.Definition, req.ReferenceSentence, req.UserSentence,
	)
	if err != nil {
		log.Printf("check-sentence error (user=%s, word=%s): %v", claims.UserID, req.Word, err)
		respondError(w, http.StatusInternalServerError, "sentence check failed, please try again")
		return
	}

	respondJSON(w, http.StatusOK, result)
}
