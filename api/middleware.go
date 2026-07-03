package main

import (
	"context"
	"net"
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

// ── Rate limiting ─────────────────────────────────────────────────────────────

type keyedLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// rateLimiter returns a middleware that limits requests to `rps`
// requests-per-second with a burst of `burst`, bucketed by the key that
// `keyOf` extracts from the request (user ID, client IP, ...). Requests with
// an empty key are rejected as unauthorized. Stale entries (no activity for
// > 5 min) are pruned once per minute.
func rateLimiter(keyOf func(*http.Request) string, rps rate.Limit, burst int, message string) func(http.Handler) http.Handler {
	var (
		mu       sync.Mutex
		limiters = make(map[string]*keyedLimiter)
	)

	// Background cleanup: remove entries idle for more than 5 minutes.
	go func() {
		for range time.Tick(time.Minute) {
			mu.Lock()
			for id, kl := range limiters {
				if time.Since(kl.lastSeen) > 5*time.Minute {
					delete(limiters, id)
				}
			}
			mu.Unlock()
		}
	}()

	getLimiter := func(key string) *rate.Limiter {
		mu.Lock()
		defer mu.Unlock()
		kl, ok := limiters[key]
		if !ok {
			kl = &keyedLimiter{limiter: rate.NewLimiter(rps, burst)}
			limiters[key] = kl
		}
		kl.lastSeen = time.Now()
		return kl.limiter
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyOf(r)
			if key == "" {
				respondError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if !getLimiter(key).Allow() {
				w.Header().Set("Retry-After", "10")
				respondError(w, http.StatusTooManyRequests, message)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// aiRateLimiter limits each authenticated user's AI-check requests.
func aiRateLimiter(rps rate.Limit, burst int) func(http.Handler) http.Handler {
	return rateLimiter(func(r *http.Request) string {
		if claims := claimsFromCtx(r); claims != nil {
			return claims.UserID
		}
		return ""
	}, rps, burst, "too many requests — please wait a moment before checking again")
}

// authRateLimiter limits login/register attempts per client IP, slowing
// credential brute-forcing and shielding the bcrypt hot path.
func authRateLimiter(rps rate.Limit, burst int) func(http.Handler) http.Handler {
	return rateLimiter(clientIP, rps, burst, "too many attempts — please wait a moment and try again")
}

// clientIP extracts the originating client IP. The container only listens on
// 127.0.0.1 behind the reverse proxy, so X-Forwarded-For is trustworthy here.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if first, _, ok := strings.Cut(xff, ","); ok {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
