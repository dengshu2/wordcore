package main

import (
	"database/sql"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
)

const lemmaMigrationVersion = "004_lemma_records"

// migrateRecordsToLemmas moves progress recorded under inflected forms of the
// old word list ("results", "was") onto the headwords of the new bank
// ("result", "be"). It runs once, in one transaction, after the content is
// loaded; without content it waits for a later start.
func migrateRecordsToLemmas(db *sql.DB, sources map[string]string) error {
	if len(sources) == 0 {
		return nil
	}
	var done bool
	if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, lemmaMigrationVersion).Scan(&done); err != nil {
		return err
	}
	if done {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	rows, err := tx.Query(`SELECT user_id, word FROM word_records ORDER BY user_id, word`)
	if err != nil {
		return err
	}
	type ref struct{ user, word string }
	var moves []ref
	for rows.Next() {
		var r ref
		if err := rows.Scan(&r.user, &r.word); err != nil {
			rows.Close()
			return err
		}
		if lemma, ok := sources[r.word]; ok && lemma != r.word {
			moves = append(moves, r)
		}
	}
	rows.Close()

	renamed, merged := 0, 0
	for _, m := range moves {
		lemma := sources[m.word]
		src, err := loadMergeRow(tx, m.user, m.word)
		if err != nil {
			return err
		}
		dst, err := loadMergeRow(tx, m.user, lemma)
		switch {
		case err == sql.ErrNoRows:
			if _, err := tx.Exec(`UPDATE word_records SET word = $1 WHERE user_id = $2 AND word = $3`, lemma, m.user, m.word); err != nil {
				return err
			}
			renamed++
		case err != nil:
			return err
		default:
			out := mergeRows(dst, src)
			if _, err := tx.Exec(`
				UPDATE word_records SET status = $1, draft = $2, last_checked_sentence = $3, feedback_acceptable = $4,
					feedback_grammar = $5, feedback_naturalness = $6, feedback_revision = $7, attempts = $8,
					accepted_attempts = $9, review_count = $10, next_review_at = $11, updated_at = $12
				WHERE user_id = $13 AND word = $14`,
				out.Status, out.Draft, out.LastChecked, out.FeedbackAcceptable, out.FeedbackGrammar, out.FeedbackNaturalness,
				out.FeedbackRevision, out.Attempts, out.Accepted, out.ReviewCount, out.NextReviewAt, out.UpdatedAt, m.user, lemma); err != nil {
				return err
			}
			if _, err := tx.Exec(`DELETE FROM word_records WHERE user_id = $1 AND word = $2`, m.user, m.word); err != nil {
				return err
			}
			merged++
		}
		if err := moveAttempts(tx, m.user, m.word, lemma); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(`INSERT INTO schema_migrations (version) VALUES ($1)`, lemmaMigrationVersion); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("migration %s: %d records renamed, %d merged into existing headwords", lemmaMigrationVersion, renamed, merged)
	return nil
}

// moveAttempts re-files sentence history under the headword and refreshes the
// headword's counters from that history.
func moveAttempts(tx *sql.Tx, user, from, to string) error {
	if _, err := tx.Exec(`
		INSERT INTO word_attempts (user_id, word, sentence, normalized_sentence, is_acceptable,
			feedback_grammar, feedback_naturalness, feedback_revision, created_at)
		SELECT user_id, $3, sentence, normalized_sentence, is_acceptable,
			feedback_grammar, feedback_naturalness, feedback_revision, created_at
		FROM word_attempts WHERE user_id = $1 AND word = $2
		ON CONFLICT (user_id, word, normalized_sentence) DO NOTHING`, user, from, to); err != nil {
		return fmt.Errorf("copy attempts %s -> %s: %w", from, to, err)
	}
	if _, err := tx.Exec(`DELETE FROM word_attempts WHERE user_id = $1 AND word = $2`, user, from); err != nil {
		return err
	}
	_, err := tx.Exec(`
		UPDATE word_records r SET attempts = c.total, accepted_attempts = c.ok
		FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_acceptable) AS ok
		      FROM word_attempts WHERE user_id = $1 AND word = $2) c
		WHERE r.user_id = $1 AND r.word = $2 AND c.total > 0`, user, to)
	return err
}

type mergeRow struct {
	Status, Draft, LastChecked                             string
	FeedbackAcceptable                                     sql.NullBool
	FeedbackGrammar, FeedbackNaturalness, FeedbackRevision string
	Attempts, Accepted, ReviewCount                        int
	NextReviewAt                                           sql.NullTime
	UpdatedAt                                              time.Time
}

func loadMergeRow(tx *sql.Tx, user, word string) (mergeRow, error) {
	var r mergeRow
	err := tx.QueryRow(`
		SELECT status, draft, last_checked_sentence, feedback_acceptable, feedback_grammar, feedback_naturalness,
			feedback_revision, attempts, accepted_attempts, review_count, next_review_at, updated_at
		FROM word_records WHERE user_id = $1 AND word = $2`, user, word).Scan(
		&r.Status, &r.Draft, &r.LastChecked, &r.FeedbackAcceptable, &r.FeedbackGrammar, &r.FeedbackNaturalness,
		&r.FeedbackRevision, &r.Attempts, &r.Accepted, &r.ReviewCount, &r.NextReviewAt, &r.UpdatedAt)
	return r, err
}

var statusRank = map[string]int{"new": 0, "learning": 1, "mastered": 2}

// mergeRows combines two records of the same headword: the further status wins,
// the most recent check is kept, and a mastered word comes up for review at the
// earlier of the two dates.
func mergeRows(dst, src mergeRow) mergeRow {
	out := dst
	if statusRank[src.Status] > statusRank[dst.Status] {
		out.Status = src.Status
	}
	if strings.TrimSpace(out.Draft) == "" {
		out.Draft = src.Draft
	}
	if src.UpdatedAt.After(dst.UpdatedAt) {
		out.LastChecked, out.FeedbackAcceptable = src.LastChecked, src.FeedbackAcceptable
		out.FeedbackGrammar, out.FeedbackNaturalness, out.FeedbackRevision = src.FeedbackGrammar, src.FeedbackNaturalness, src.FeedbackRevision
		out.UpdatedAt = src.UpdatedAt
	}
	out.Attempts = dst.Attempts + src.Attempts
	out.Accepted = dst.Accepted + src.Accepted
	if src.ReviewCount > out.ReviewCount {
		out.ReviewCount = src.ReviewCount
	}
	dates := []sql.NullTime{}
	for _, r := range []mergeRow{dst, src} {
		if r.Status == "mastered" && r.NextReviewAt.Valid {
			dates = append(dates, r.NextReviewAt)
		}
	}
	sort.Slice(dates, func(i, j int) bool { return dates[i].Time.Before(dates[j].Time) })
	switch {
	case out.Status != "mastered":
		out.NextReviewAt = sql.NullTime{}
	case len(dates) > 0:
		out.NextReviewAt = dates[0]
	}
	return out
}
