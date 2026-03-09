package main

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// corsMiddleware adds CORS headers, restricting to the configured origins.
func corsMiddleware(allowedOrigins map[string]bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if allowedOrigins[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// jwtMiddleware extracts and validates the Bearer token, injecting claims into the context.
func jwtMiddleware(auth *AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				respondError(w, http.StatusUnauthorized, "missing or invalid authorization header")
				return
			}
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := auth.ValidateToken(tokenStr)
			if err != nil {
				respondError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}
			ctx := context.WithValue(r.Context(), contextKeyUser, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// claimsFromCtx extracts JWT claims from the request context.
func claimsFromCtx(r *http.Request) *Claims {
	c, _ := r.Context().Value(contextKeyUser).(*Claims)
	return c
}

// ── AI rate limiter ───────────────────────────────────────────────────────────

type userLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// aiRateLimiter returns a middleware that limits each authenticated user to
// `rps` requests-per-second with a burst of `burst`.
// Stale entries (no activity for > 5 min) are pruned once per minute.
func aiRateLimiter(rps rate.Limit, burst int) func(http.Handler) http.Handler {
	var (
		mu       sync.Mutex
		limiters = make(map[string]*userLimiter)
	)

	// Background cleanup: remove entries idle for more than 5 minutes.
	go func() {
		for range time.Tick(time.Minute) {
			mu.Lock()
			for id, ul := range limiters {
				if time.Since(ul.lastSeen) > 5*time.Minute {
					delete(limiters, id)
				}
			}
			mu.Unlock()
		}
	}()

	getLimiter := func(userID string) *rate.Limiter {
		mu.Lock()
		defer mu.Unlock()
		ul, ok := limiters[userID]
		if !ok {
			ul = &userLimiter{limiter: rate.NewLimiter(rps, burst)}
			limiters[userID] = ul
		}
		ul.lastSeen = time.Now()
		return ul.limiter
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := claimsFromCtx(r)
			if claims == nil {
				// jwtMiddleware should have blocked unauthenticated requests first.
				respondError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if !getLimiter(claims.UserID).Allow() {
				w.Header().Set("Retry-After", "10")
				respondError(w, http.StatusTooManyRequests, "too many requests — please wait a moment before checking again")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
