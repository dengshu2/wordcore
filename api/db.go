package main

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// User represents an authenticated user account.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

// WordRecord holds everything the system tracks per word per user.
type WordRecord struct {
	Word                string     `json:"word"`
	Status              string     `json:"status"`
	Draft               string     `json:"draft"`
	LastCheckedSentence string     `json:"last_checked_sentence"`
	FeedbackAcceptable  *bool      `json:"feedback_acceptable"`
	FeedbackGrammar     string     `json:"feedback_grammar"`
	FeedbackNaturalness string     `json:"feedback_naturalness"`
	FeedbackRevision    string     `json:"feedback_revision"`
	Attempts            int        `json:"attempts"`
	AcceptedAttempts    int        `json:"accepted_attempts"`
	UpdatedAt           time.Time  `json:"updated_at"`
	ReviewCount         int        `json:"review_count"`
	NextReviewAt        *time.Time `json:"next_review_at"`
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
	// Ensure the migrations tracking table exists.
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	// Read all .sql files from the embedded migrations directory.
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		version := strings.TrimSuffix(name, filepath.Ext(name))

		// Check if this migration has already been applied.
		var exists bool
		if err := db.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`,
			version,
		).Scan(&exists); err != nil {
			return fmt.Errorf("check migration %s: %w", version, err)
		}
		if exists {
			continue
		}

		// Read and execute the migration.
		content, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}

		if _, err := db.Exec(
			`INSERT INTO schema_migrations (version) VALUES ($1)`,
			version,
		); err != nil {
			return fmt.Errorf("record migration %s: %w", version, err)
		}

		log.Printf("applied migration: %s", version)
	}

	return nil
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
		       attempts, accepted_attempts, updated_at,
		       review_count, next_review_at
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
			&r.ReviewCount, &r.NextReviewAt,
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
			 attempts, accepted_attempts, updated_at,
			 review_count, next_review_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12,$13)
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
			review_count          = EXCLUDED.review_count,
			next_review_at        = EXCLUDED.next_review_at,
			updated_at            = NOW()
		RETURNING word, status, draft, last_checked_sentence,
		          feedback_acceptable, feedback_grammar, feedback_naturalness, feedback_revision,
		          attempts, accepted_attempts, updated_at,
		          review_count, next_review_at
	`,
		userID, word, r.Status, r.Draft, r.LastCheckedSentence,
		r.FeedbackAcceptable, r.FeedbackGrammar, r.FeedbackNaturalness, r.FeedbackRevision,
		r.Attempts, r.AcceptedAttempts,
		r.ReviewCount, r.NextReviewAt,
	).Scan(
		&out.Word, &out.Status, &out.Draft, &out.LastCheckedSentence,
		&out.FeedbackAcceptable, &out.FeedbackGrammar, &out.FeedbackNaturalness, &out.FeedbackRevision,
		&out.Attempts, &out.AcceptedAttempts, &out.UpdatedAt,
		&out.ReviewCount, &out.NextReviewAt,
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
		       attempts, accepted_attempts, updated_at,
		       review_count, next_review_at
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
			&r.ReviewCount, &r.NextReviewAt,
		); err != nil {
			return nil, fmt.Errorf("scan record: %w", err)
		}
		records = append(records, r)
	}
	return records, rows.Err()
}
