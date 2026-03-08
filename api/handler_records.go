package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// handleGetRecords handles GET /api/records
// Returns a map of word -> WordRecord for the authenticated user.
func (h *handler) handleGetRecords(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromCtx(r)
	records, err := getAllRecords(h.db, claims.UserID)
	if err != nil {
		log.Printf("get records error (user=%s): %v", claims.UserID, err)
		respondError(w, http.StatusInternalServerError, "failed to fetch records")
		return
	}
	respondJSON(w, http.StatusOK, records)
}

// handleUpsertRecord handles PUT /api/records/{word}
func (h *handler) handleUpsertRecord(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromCtx(r)
	word := strings.ToLower(strings.TrimSpace(chi.URLParam(r, "word")))
	if word == "" {
		respondError(w, http.StatusBadRequest, "word is required")
		return
	}

	var rec WordRecord
	if err := json.NewDecoder(r.Body).Decode(&rec); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate status values.
	switch rec.Status {
	case "new", "learning", "mastered":
	case "":
		rec.Status = "new"
	default:
		respondError(w, http.StatusBadRequest, "status must be one of: new, learning, mastered")
		return
	}

	out, err := upsertRecord(h.db, claims.UserID, word, rec)
	if err != nil {
		log.Printf("upsert record error (user=%s, word=%s): %v", claims.UserID, word, err)
		respondError(w, http.StatusInternalServerError, "failed to save record")
		return
	}

	respondJSON(w, http.StatusOK, out)
}

// handleExportCSV handles GET /api/records/export
func (h *handler) handleExportCSV(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromCtx(r)
	records, err := getAllRecordsSlice(h.db, claims.UserID)
	if err != nil {
		log.Printf("export error (user=%s): %v", claims.UserID, err)
		respondError(w, http.StatusInternalServerError, "export failed")
		return
	}

	filename := fmt.Sprintf("wordcore_%s.csv", time.Now().Format("20060102"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	// UTF-8 BOM for Excel compatibility.
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	cw := csv.NewWriter(w)
	defer cw.Flush()

	cw.Write([]string{
		"word", "status", "draft", "last_checked_sentence",
		"feedback_acceptable", "feedback_grammar", "feedback_naturalness", "feedback_revision",
		"attempts", "accepted_attempts", "updated_at",
	})

	for _, rec := range records {
		acceptable := ""
		if rec.FeedbackAcceptable != nil {
			if *rec.FeedbackAcceptable {
				acceptable = "true"
			} else {
				acceptable = "false"
			}
		}
		cw.Write([]string{
			rec.Word, rec.Status, rec.Draft, rec.LastCheckedSentence,
			acceptable, rec.FeedbackGrammar, rec.FeedbackNaturalness, rec.FeedbackRevision,
			fmt.Sprintf("%d", rec.Attempts),
			fmt.Sprintf("%d", rec.AcceptedAttempts),
			rec.UpdatedAt.Format(time.RFC3339),
		})
	}
}
