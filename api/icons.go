package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

var iconNameRe = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// IconStore serves the Phosphor duotone icons that cards refer to by name,
// fetching each from the npm CDN once and keeping it under content/icons.
type IconStore struct {
	dir    string
	source string // printf pattern with the icon name
	client *http.Client
}

func NewIconStore(contentDir string) *IconStore {
	dir := filepath.Join(contentDir, "icons")
	_ = os.MkdirAll(dir, 0o755)
	return &IconStore{
		dir:    dir,
		source: "https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/duotone/%s-duotone.svg",
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *IconStore) Get(ctx context.Context, name string) ([]byte, error) {
	path := filepath.Join(s.dir, name+".svg")
	if data, err := os.ReadFile(path); err == nil {
		return data, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf(s.source, name), nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK || !bytes.HasPrefix(bytes.TrimSpace(data), []byte("<svg")) {
		return nil, os.ErrNotExist
	}
	return data, writeFileAtomic(path, data)
}

// handleIcon handles GET /icons/{file} (public; used as a CSS mask image).
func (h *handler) handleIcon(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSuffix(chi.URLParam(r, "file"), ".svg")
	if !iconNameRe.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	data, err := h.icons.Get(r.Context(), name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Write(data)
}
