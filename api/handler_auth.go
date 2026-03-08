package main

import (
	"encoding/json"
	"log"
	"net/http"
)

// handleRegister handles POST /auth/register
func (h *handler) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, token, err := h.auth.Register(req.Email, req.Password)
	if err != nil {
		// Distinguish user-facing errors from internal ones.
		switch err.Error() {
		case "email already registered",
			"email is required",
			"password must be at least 8 characters":
			respondError(w, http.StatusUnprocessableEntity, err.Error())
		default:
			log.Printf("register error: %v", err)
			respondError(w, http.StatusInternalServerError, "registration failed")
		}
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

// handleLogin handles POST /auth/login
func (h *handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, token, err := h.auth.Login(req.Email, req.Password)
	if err != nil {
		switch err.Error() {
		case "invalid email or password":
			respondError(w, http.StatusUnauthorized, err.Error())
		default:
			log.Printf("login error: %v", err)
			respondError(w, http.StatusInternalServerError, "login failed")
		}
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}
