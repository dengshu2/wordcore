package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

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
