package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
)

// spaHandler serves a Single Page Application.
// It returns the requested file if it exists; otherwise it returns index.html
// so that client-side routing (React Router) works correctly.
func spaHandler(staticDir string) http.Handler {
	fs := http.Dir(staticDir)
	fileServer := http.FileServer(fs)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Strip the trailing slash for file lookups (but keep "/" working).
		path := filepath.Clean(r.URL.Path)
		// If the request has a dot, it's likely a real asset — try to serve it directly.
		// If not found, fall through to index.html.
		if strings.Contains(filepath.Base(path), ".") {
			f, err := fs.Open(path)
			if err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		// For any route without a file extension (e.g. /study, /words),
		// serve index.html and let React Router handle it.
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

func main() {
	_ = godotenv.Load()

	// ── Configuration ────────────────────────────────────────────────
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENROUTER_API_KEY environment variable is required")
	}

	model := os.Getenv("OPENROUTER_MODEL")
	if model == "" {
		model = "google/gemini-2.5-flash"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// FRONTEND_URL is used for CORS — comma-separated list of allowed origins.
	// Example: https://wordcore.example.com,http://localhost:5173
	frontendURL := os.Getenv("FRONTEND_URL")
	allowedOrigins := parseOrigins(frontendURL)

	// ── Database ─────────────────────────────────────────────────────
	db, err := InitDB(databaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()
	log.Println("Database initialized")

	// ── Dependencies ─────────────────────────────────────────────────
	auth := NewAuthService(db, jwtSecret)
	or := NewOpenRouterClient(apiKey, model)
	h := &handler{db: db, auth: auth, or: or}

	// ── Router ───────────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))
	r.Use(corsMiddleware(allowedOrigins))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		if err := db.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("db: unhealthy"))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Auth routes (public)
	r.Post("/auth/register", h.handleRegister)
	r.Post("/auth/login", h.handleLogin)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(jwtMiddleware(auth))

		r.Get("/api/records", h.handleGetRecords)
		r.Get("/api/records/export", h.handleExportCSV) // must be before /{word}
		r.Put("/api/records/{word}", h.handleUpsertRecord)
		r.Post("/api/check-sentence", h.handleCheckSentence)
	})

	// SPA fallback — serve React app for all other routes.
	// This must come after /auth and /api routes.
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "./static"
	}
	r.Handle("/*", spaHandler(staticDir))

	// ── Server ───────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 90 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("WordCore API starting on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}
	log.Println("Server stopped")
}

// parseOrigins splits a comma-separated string into a set of allowed origins.
// Always includes localhost ports used for development.
func parseOrigins(raw string) map[string]bool {
	origins := map[string]bool{
		"http://localhost:5173": true,
		"http://localhost:4173": true,
		"http://localhost:3000": true,
	}
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins[o] = true
		}
	}
	return origins
}
