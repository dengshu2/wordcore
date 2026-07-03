export function FeedbackPanel({ feedback, acceptedAttempts, requiredAttempts, remainingAcceptedChecks, masteredReady, onAgain, onMastered }) {
  return (
    <div className="study-feedback">
      <p className={`study-feedback__verdict ${feedback.is_acceptable ? 'study-feedback__verdict--ok' : 'study-feedback__verdict--warn'}`}>
        {feedback.is_acceptable ? 'This sentence is acceptable for study use.' : 'This sentence needs revision before you move on.'}
      </p>
      {(feedback.grammar_feedback || feedback.naturalness_feedback) && (
        <p className="study-feedback__note">{feedback.grammar_feedback || feedback.naturalness_feedback}</p>
      )}
      {feedback.suggested_revision && (
        <p className="study-feedback__suggestion">Suggested: {feedback.suggested_revision}</p>
      )}
      <p className="study-feedback__tally num">Acceptable checks: {acceptedAttempts}/{requiredAttempts}</p>
      {feedback.is_acceptable && !masteredReady && (
        <p className="study-feedback__note">Complete {remainingAcceptedChecks} more acceptable self-check{remainingAcceptedChecks === 1 ? '' : 's'} before marking this word as mastered.</p>
      )}
      <ActionRow masteredReady={masteredReady} onAgain={onAgain} onMastered={onMastered} isAcceptable={feedback.is_acceptable} />
    </div>
  )
}

export function StoredFeedbackPanel({ stored, currentRecord, requiredAttempts, storedMasteredReady, onAgain, onMastered }) {
  return (
    <div className="study-feedback">
      <p className={`study-feedback__verdict ${stored.isAcceptable ? 'study-feedback__verdict--ok' : 'study-feedback__verdict--warn'}`}>
        {stored.message}
      </p>
      <p className="study-feedback__note">Last checked sentence: {stored.checkedSentence}</p>
      {stored.note && <p className="study-feedback__note">{stored.note}</p>}
      {stored.suggestedRevision && (
        <p className="study-feedback__suggestion">Suggested: {stored.suggestedRevision}</p>
      )}
      <p className="study-feedback__tally num">Accepted checks: {currentRecord.acceptedAttempts || 0}/{requiredAttempts}</p>
      <ActionRow masteredReady={storedMasteredReady} onAgain={onAgain} onMastered={onMastered} isAcceptable={stored.isAcceptable} />
    </div>
  )
}

function ActionRow({ masteredReady, onAgain, onMastered, isAcceptable }) {
  return (
    <div>
      <div className="study-action-row">
        <button className="btn btn--outline flex-1" onClick={onAgain}>Next</button>
        <button className="btn btn--primary flex-1" onClick={onMastered} disabled={!masteredReady}>Mastered</button>
      </div>
      {masteredReady && (
        <p className="body-xs" style={{ color: 'var(--wc-muted)', marginTop: 'var(--space-1)', textAlign: 'right' }}>
          Cmd/Ctrl + Shift + Enter
        </p>
      )}
      <p className="study-action-hint">
        {masteredReady
          ? 'Mark as mastered, or move to the next word.'
          : isAcceptable
            ? 'This word stays in your learning queue.'
            : 'You can revise your sentence above and re-check, or move on.'}
      </p>
    </div>
  )
}
