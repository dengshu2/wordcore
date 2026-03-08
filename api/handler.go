package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

// handler holds shared dependencies for all HTTP handlers.
type handler struct {
	db   *sql.DB
	auth *AuthService
	or   *OpenRouterClient
}

// respondJSON writes a JSON response.
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// respondError writes a JSON error response.
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
