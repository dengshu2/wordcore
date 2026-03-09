package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// jsonFenceRe matches an optional ```json / ``` code fence and captures the inner content.
// The (?s) flag makes . match newlines so multi-line JSON blocks are captured correctly.
var jsonFenceRe = regexp.MustCompile(`(?s)` + "```" + `(?:json)?\s*([\s\S]*?)\s*` + "```")

const sentenceCheckSystemPrompt = `You are checking a learner's English sentence for a vocabulary imitation exercise.

Your job is to evaluate whether the learner's sentence is grammatically acceptable and uses the target word naturally.

Return ONLY valid JSON with exactly this shape:
{
  "is_acceptable": true,
  "grammar_feedback": "",
  "naturalness_feedback": "",
  "suggested_revision": ""
}

Rules:
- "is_acceptable" is true if the sentence is grammatically correct and uses the target word naturally enough for study.
- Keep feedback short and concrete — one key point maximum per field.
- Only mention the most important grammar issue if there is one; leave empty string if none.
- Only mention the most important naturalness issue if there is one; leave empty string if none.
- "suggested_revision" must always provide a corrected or more natural version of the learner's sentence.
- Do not add markdown, explanation, or any text outside the JSON.`

type openRouterRequest struct {
	Model    string              `json:"model"`
	Messages []openRouterMessage `json:"messages"`
}

type openRouterMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openRouterResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// SentenceCheckResult mirrors what the frontend expects.
type SentenceCheckResult struct {
	IsAcceptable        bool   `json:"is_acceptable"`
	GrammarFeedback     string `json:"grammar_feedback"`
	NaturalnessFeedback string `json:"naturalness_feedback"`
	SuggestedRevision   string `json:"suggested_revision"`
}

// OpenRouterClient calls the OpenRouter chat completions API.
type OpenRouterClient struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewOpenRouterClient(apiKey, model string) *OpenRouterClient {
	return &OpenRouterClient{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// CheckSentence evaluates a learner's sentence through OpenRouter.
func (c *OpenRouterClient) CheckSentence(ctx context.Context, word, definition, referenceSentence, userSentence string) (SentenceCheckResult, error) {
	userMsg := fmt.Sprintf(
		"Target word: %s\nDefinition: %s\nReference sentence: %s\nLearner sentence: %s",
		word, definition, referenceSentence, userSentence,
	)

	payload := openRouterRequest{
		Model: c.model,
		Messages: []openRouterMessage{
			{Role: "system", Content: sentenceCheckSystemPrompt},
			{Role: "user", Content: userMsg},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return SentenceCheckResult{}, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://openrouter.ai/api/v1/chat/completions",
		bytes.NewReader(body),
	)
	if err != nil {
		return SentenceCheckResult{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return SentenceCheckResult{}, fmt.Errorf("openrouter call failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return SentenceCheckResult{}, fmt.Errorf("read response: %w", err)
	}

	var orResp openRouterResponse
	if err := json.Unmarshal(respBody, &orResp); err != nil {
		return SentenceCheckResult{}, fmt.Errorf("parse response: %w", err)
	}

	if orResp.Error != nil {
		return SentenceCheckResult{}, fmt.Errorf("openrouter error: %s", orResp.Error.Message)
	}

	if len(orResp.Choices) == 0 {
		return SentenceCheckResult{}, fmt.Errorf("openrouter returned empty choices")
	}

	// Extract JSON from the model output.
	// Try to find a ```json ... ``` or ``` ... ``` block first (handles extra prose around it).
	// Fall back to treating the whole trimmed response as JSON.
	raw := strings.TrimSpace(orResp.Choices[0].Message.Content)
	if m := jsonFenceRe.FindStringSubmatch(raw); len(m) == 2 {
		raw = strings.TrimSpace(m[1])
	}

	var result SentenceCheckResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return SentenceCheckResult{}, fmt.Errorf("parse model JSON: %w (raw: %s)", err, raw)
	}

	return result, nil
}
