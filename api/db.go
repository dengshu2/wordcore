package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// User represents an authenticated user account.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

// WordRecord holds everything the system tracks per word per user.
type WordRecord struct {
	Word                string    `json:"word"`
	Status              string    `json:"status"`
	Draft               string    `json:"draft"`
	LastCheckedSentence string    `json:"last_checked_sentence"`
	FeedbackAcceptable  *bool     `json:"feedback_acceptable"`
	FeedbackGrammar     string    `json:"feedback_grammar"`
	FeedbackNaturalness string    `json:"feedback_naturalness"`
	FeedbackRevision    string    `json:"feedback_revision"`
	Attempts            int       `json:"attempts"`
	AcceptedAttempts    int       `json:"accepted_attempts"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// InitDB opens a PostgreSQL connection, runs the schema migrations, and returns the handle.
func InitDB(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	schema := `
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
	`
	_, err := db.Exec(schema)
	return err
}

// ── User queries ──────────────────────────────────────────────────────────────

func createUser(db *sql.DB, email, passwordHash string) (User, error) {
	var u User
	err := db.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, email, created_at`,
		email, passwordHash,
	).Scan(&u.ID, &u.Email, &u.CreatedAt)
	if err != nil {
		return User{}, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

func getUserByEmail(db *sql.DB, email string) (User, string, error) {
	var u User
	var hash string
	err := db.QueryRow(
		`SELECT id, email, password_hash, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &hash, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return User{}, "", nil
	}
	if err != nil {
		return User{}, "", fmt.Errorf("get user by email: %w", err)
	}
	return u, hash, nil
}

// ── Word record queries ───────────────────────────────────────────────────────

// getAllRecords returns every WordRecord for the given user as a map[word]WordRecord.
func getAllRecords(db *sql.DB, userID string) (map[string]WordRecord, error) {
	rows, err := db.Query(`
		SELECT word, status, draft, last_checked_sentence,
		       feedback_acceptable, feedback_grammar, feedback_naturalness, feedback_revision,
		       attempts, accepted_attempts, updated_at
		FROM word_records
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("get all records: %w", err)
	}
	defer rows.Close()

	result := make(map[string]WordRecord)
	for rows.Next() {
		var r WordRecord
		if err := rows.Scan(
			&r.Word, &r.Status, &r.Draft, &r.LastCheckedSentence,
			&r.FeedbackAcceptable, &r.FeedbackGrammar, &r.FeedbackNaturalness, &r.FeedbackRevision,
			&r.Attempts, &r.AcceptedAttempts, &r.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan record: %w", err)
		}
		result[r.Word] = r
	}
	return result, rows.Err()
}

// upsertRecord creates or fully replaces a word record for the given user.
func upsertRecord(db *sql.DB, userID, word string, r WordRecord) (WordRecord, error) {
	var out WordRecord
	err := db.QueryRow(`
		INSERT INTO word_records
			(user_id, word, status, draft, last_checked_sentence,
			 feedback_acceptable, feedback_grammar, feedback_naturalness, feedback_revision,
			 attempts, accepted_attempts, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
		ON CONFLICT (user_id, word) DO UPDATE SET
			status                = EXCLUDED.status,
			draft                 = EXCLUDED.draft,
			last_checked_sentence = EXCLUDED.last_checked_sentence,
			feedback_acceptable   = EXCLUDED.feedback_acceptable,
			feedback_grammar      = EXCLUDED.feedback_grammar,
			feedback_naturalness  = EXCLUDED.feedback_naturalness,
			feedback_revision     = EXCLUDED.feedback_revision,
			attempts              = EXCLUDED.attempts,
			accepted_attempts     = EXCLUDED.accepted_attempts,
			updated_at            = NOW()
		RETURNING word, status, draft, last_checked_sentence,
		          feedback_acceptable, feedback_grammar, feedback_naturalness, feedback_revision,
		          attempts, accepted_attempts, updated_at
	`,
		userID, word, r.Status, r.Draft, r.LastCheckedSentence,
		r.FeedbackAcceptable, r.FeedbackGrammar, r.FeedbackNaturalness, r.FeedbackRevision,
		r.Attempts, r.AcceptedAttempts,
	).Scan(
		&out.Word, &out.Status, &out.Draft, &out.LastCheckedSentence,
		&out.FeedbackAcceptable, &out.FeedbackGrammar, &out.FeedbackNaturalness, &out.FeedbackRevision,
		&out.Attempts, &out.AcceptedAttempts, &out.UpdatedAt,
	)
	if err != nil {
		return WordRecord{}, fmt.Errorf("upsert record: %w", err)
	}
	return out, nil
}

// getAllRecordsSlice returns every record as a slice — used for CSV export.
func getAllRecordsSlice(db *sql.DB, userID string) ([]WordRecord, error) {
	rows, err := db.Query(`
		SELECT word, status, draft, last_checked_sentence,
		       feedback_acceptable, feedback_grammar, feedback_naturalness, feedback_revision,
		       attempts, accepted_attempts, updated_at
		FROM word_records
		WHERE user_id = $1
		ORDER BY word ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("get records for export: %w", err)
	}
	defer rows.Close()

	var records []WordRecord
	for rows.Next() {
		var r WordRecord
		if err := rows.Scan(
			&r.Word, &r.Status, &r.Draft, &r.LastCheckedSentence,
			&r.FeedbackAcceptable, &r.FeedbackGrammar, &r.FeedbackNaturalness, &r.FeedbackRevision,
			&r.Attempts, &r.AcceptedAttempts, &r.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan record: %w", err)
		}
		records = append(records, r)
	}
	return records, rows.Err()
}
