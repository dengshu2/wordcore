-- 001: Initial schema — users and word_records tables
-- Applied by the migration runner on first boot.

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS word_records (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word                  VARCHAR(100) NOT NULL,
    status                VARCHAR(20)  NOT NULL DEFAULT 'new',
    draft                 TEXT NOT NULL DEFAULT '',
    last_checked_sentence TEXT NOT NULL DEFAULT '',
    feedback_acceptable   BOOLEAN,
    feedback_grammar      TEXT NOT NULL DEFAULT '',
    feedback_naturalness  TEXT NOT NULL DEFAULT '',
    feedback_revision     TEXT NOT NULL DEFAULT '',
    attempts              INTEGER NOT NULL DEFAULT 0,
    accepted_attempts     INTEGER NOT NULL DEFAULT 0,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_word_records_user_id ON word_records(user_id);
CREATE INDEX IF NOT EXISTS idx_word_records_status  ON word_records(user_id, status);
