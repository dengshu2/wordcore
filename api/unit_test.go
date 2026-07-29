package main

import (
	"context"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestFinalizeSentenceCheckAcceptsDifferentNaturalSense(t *testing.T) {
	result := finalizeSentenceCheck(sentenceCheckModelResult{
		GrammarOK:             true,
		NaturalTargetUse:      true,
		MatchesReferenceSense: false,
		NaturalnessFeedback:   "This is a valid different meaning of own.",
	})

	if !result.IsAcceptable {
		t.Fatal("a grammatical, natural use must be accepted even when it differs from the reference sense")
	}
	if result.MatchesReferenceSense {
		t.Fatal("reference-sense match should remain informational")
	}
}

func TestFinalizeSentenceCheckRejectsInvalidSentenceOrTargetUse(t *testing.T) {
	tests := []struct {
		name       string
		grammarOK  bool
		naturalUse bool
	}{
		{name: "grammar issue", grammarOK: false, naturalUse: true},
		{name: "target only mentioned", grammarOK: true, naturalUse: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := finalizeSentenceCheck(sentenceCheckModelResult{
				GrammarOK:        tt.grammarOK,
				NaturalTargetUse: tt.naturalUse,
			})
			if result.IsAcceptable {
				t.Fatal("acceptance must require both acceptable grammar and a natural target-word use")
			}
		})
	}
}

func TestSentenceCheckPromptMakesReferenceSenseInformational(t *testing.T) {
	requiredRules := []string{
		"ANY common meaning, part of speech, or idiomatic use",
		"inspiration only",
		"never changes acceptance",
		"Merely naming, quoting, spelling, defining, or repeating",
	}
	for _, rule := range requiredRules {
		if !strings.Contains(sentenceCheckSystemPrompt, rule) {
			t.Errorf("sentence-check prompt is missing policy rule %q", rule)
		}
	}
}

func TestLiveSentenceCheckPolicy(t *testing.T) {
	if os.Getenv("WORDCORE_RUN_LIVE_AI_TEST") != "1" {
		t.Skip("set WORDCORE_RUN_LIVE_AI_TEST=1 to exercise the configured OpenRouter model")
	}
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		t.Fatal("OPENROUTER_API_KEY is required for the live AI policy test")
	}
	model := os.Getenv("OPENROUTER_MODEL")
	if model == "" {
		model = "google/gemini-2.5-flash"
	}

	client := NewOpenRouterClient(apiKey, model)
	tests := []struct {
		name     string
		sentence string
		want     bool
	}{
		{name: "reference verb sense", sentence: "I own a bicycle.", want: true},
		{name: "different idiomatic sense", sentence: "I finished the project on my own.", want: true},
		{name: "word merely quoted", sentence: `"Own" is a word.`, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			result, err := client.CheckSentence(
				ctx,
				"own",
				"To possess something; have as one's property.",
				"I own a small house.",
				tt.sentence,
			)
			if err != nil {
				t.Fatalf("CheckSentence: %v", err)
			}
			if result.IsAcceptable != tt.want {
				t.Fatalf("IsAcceptable = %v, want %v; result = %+v", result.IsAcceptable, tt.want, result)
			}
		})
	}
}

func TestIsHashedAsset(t *testing.T) {
	cases := []struct {
		name string
		want bool
	}{
		{"index-BZbSmBmg.js", true},
		{"wordbank-DcjIxlb4.js", true},
		{"index-Dy7HiZ8i.css", true},
		{"favicon.ico", false},
		{"apple-touch-icon.png", false}, // "icon" after last dash is too short
		{"index.html", false},
		{"noext", false},
		{"short-abc.js", false},
	}
	for _, c := range cases {
		if got := isHashedAsset(c.name); got != c.want {
			t.Errorf("isHashedAsset(%q) = %v, want %v", c.name, got, c.want)
		}
	}
}

func TestNormalizeSentenceForKey(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"  The  hikers Abandon\tthe trail.  ", "the hikers abandon the trail."},
		{"Simple.", "simple."},
		{"", ""},
	}
	for _, c := range cases {
		if got := normalizeSentenceForKey(c.in); got != c.want {
			t.Errorf("normalizeSentenceForKey(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestParseOrigins(t *testing.T) {
	origins := parseOrigins("https://wordcore.example.com, https://other.example.com,")
	for _, want := range []string{
		"https://wordcore.example.com",
		"https://other.example.com",
		"http://localhost:5173", // dev origins always included
	} {
		if !origins[want] {
			t.Errorf("expected origin %q to be allowed", want)
		}
	}
	if origins[""] {
		t.Error("empty origin must not be allowed")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	auth := NewAuthService(nil, "test-secret")
	user := User{ID: "user-123", Email: "a@b.com"}

	token, err := auth.signToken(user)
	if err != nil {
		t.Fatalf("signToken: %v", err)
	}

	claims, err := auth.ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken: %v", err)
	}
	if claims.UserID != user.ID || claims.Email != user.Email {
		t.Errorf("claims = %+v, want user %q email %q", claims, user.ID, user.Email)
	}

	if _, err := auth.ValidateToken(token + "x"); err == nil {
		t.Error("tampered token must not validate")
	}

	other := NewAuthService(nil, "different-secret")
	if _, err := other.ValidateToken(token); err == nil {
		t.Error("token signed with another secret must not validate")
	}
}

func TestValidateTokenRejectsUnsignedAlg(t *testing.T) {
	auth := NewAuthService(nil, "test-secret")
	unsigned := jwt.NewWithClaims(jwt.SigningMethodNone, &Claims{
		UserID: "user-123",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	tokenStr, err := unsigned.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign none token: %v", err)
	}
	if _, err := auth.ValidateToken(tokenStr); err == nil {
		t.Error(`token with alg "none" must not validate`)
	}
}

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest("POST", "/auth/login", nil)
	r.RemoteAddr = "10.0.0.5:41234"
	if got := clientIP(r); got != "10.0.0.5" {
		t.Errorf("clientIP without XFF = %q, want 10.0.0.5", got)
	}

	r.Header.Set("X-Forwarded-For", "203.0.113.9, 10.0.0.5")
	if got := clientIP(r); got != "203.0.113.9" {
		t.Errorf("clientIP with XFF chain = %q, want 203.0.113.9", got)
	}

	r.Header.Set("X-Forwarded-For", "203.0.113.9")
	if got := clientIP(r); got != "203.0.113.9" {
		t.Errorf("clientIP with single XFF = %q, want 203.0.113.9", got)
	}
}
