-- 003: Store sentence check history per word.
-- Keeps word_records as the per-word summary while preserving each checked sentence.

CREATE TABLE IF NOT EXISTS word_attempts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word                  VARCHAR(100) NOT NULL,
    sentence              TEXT NOT NULL,
    normalized_sentence   TEXT NOT NULL,
    is_acceptable         BOOLEAN NOT NULL DEFAULT FALSE,
    feedback_grammar      TEXT NOT NULL DEFAULT '',
    feedback_naturalness  TEXT NOT NULL DEFAULT '',
    feedback_revision     TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, word, normalized_sentence)
);

CREATE INDEX IF NOT EXISTS idx_word_attempts_user_word_created
    ON word_attempts(user_id, word, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_word_attempts_user_word_accepted
    ON word_attempts(user_id, word, is_acceptable);

INSERT INTO word_attempts (
    user_id, word, sentence, normalized_sentence, is_acceptable,
    feedback_grammar, feedback_naturalness, feedback_revision, created_at
)
SELECT
    user_id,
    word,
    last_checked_sentence,
    lower(regexp_replace(trim(last_checked_sentence), '\s+', ' ', 'g')),
    COALESCE(feedback_acceptable, FALSE),
    feedback_grammar,
    feedback_naturalness,
    feedback_revision,
    updated_at
FROM word_records
WHERE trim(last_checked_sentence) <> ''
ON CONFLICT (user_id, word, normalized_sentence) DO NOTHING;
