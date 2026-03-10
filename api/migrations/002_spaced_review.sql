-- 002: Add spaced-review columns to word_records
-- Supports interval-based review scheduling for mastered words.

ALTER TABLE word_records ADD COLUMN IF NOT EXISTS review_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE word_records ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_word_records_review ON word_records(user_id, status, next_review_at);
