import PlayButton from '../PlayButton'
import { CheckIcon } from '../Icons'
import { Highlighted } from './Visual'

// The conversation about one word: prompts the learner chose, their sentences,
// and the check results. Items are built by Study from saved attempts plus
// this visit's prompts and notes.
export default function Thread({ items, word, forms, required }) {
  if (!items.length) return null
  return (
    <section className="thread" aria-label="Your sentences and feedback" aria-live="polite">
      {items.map(item => {
        switch (item.type) {
          case 'me':
            return <div key={item.id} className={`msg me${item.pending ? ' is-pending' : ''}`}><p>{item.text}</p></div>
          case 'typing':
            return <div key={item.id} className="msg bot" aria-label="Checking"><span className="typing"><i /><i /><i /></span></div>
          case 'prompt':
            return <div key={item.id} className="msg bot"><small>{item.label}</small><p>{item.text}</p></div>
          case 'note':
            return <div key={item.id} className="msg bot"><p>{item.text}</p></div>
          default:
            return (
              <div key={item.id} className="msg bot">
                <p className={`verdict ${item.ok ? 'ok' : 'warn'}`}>{item.ok ? <><CheckIcon />Natural and correct</> : 'Almost there'}</p>
                {item.note && <p>{item.note}</p>}
                {item.revision && (
                  <p className="try">
                    <span>Try: <Highlighted text={item.revision} word={word} forms={forms} /></span>
                    <PlayButton size="sm" label="Play the suggestion" clip={{ text: item.revision, kind: 'sentence', ready: false }} />
                  </p>
                )}
                {item.tally != null && (
                  <p className="tally">
                    <span className="dots">{Array.from({ length: required }, (_, k) => <i key={k} className={k < item.tally ? 'on' : ''} />)}</span>
                    {Math.min(item.tally, required)} of {required} accepted
                  </p>
                )}
              </div>
            )
        }
      })}
    </section>
  )
}
