export default function AcceptedExamples({ attempts, requiredAttempts }) {
  if (!attempts.length) return null
  return (
    <section className="study-examples" aria-label="Accepted examples">
      <div className="study-examples__header">
        <span className="label">Accepted examples</span>
        <span className="study-examples__count num">{Math.min(attempts.length, requiredAttempts)}/{requiredAttempts}</span>
      </div>
      <ol className="study-examples__list">
        {attempts.map(attempt => (
          <li key={attempt.normalizedSentence || attempt.sentence} className="study-examples__item">
            {attempt.sentence}
          </li>
        ))}
      </ol>
    </section>
  )
}
