import { useEffect } from 'react'
import { useParams } from 'react-router'
import { useCard, useContent } from '../context/ContentContext'
import { useProgressContext } from '../context/ProgressContext'
import { setSlowPlayback, useSlowPlayback } from '../lib/settings'
import { PageTopBar } from '../components/TopBar'
import { Highlighted } from '../components/study/Visual'

export default function Details() {
  const { word } = useParams()
  const key = (word || '').toLowerCase()
  const { words } = useContent()
  const { records } = useProgressContext()
  const { card, error } = useCard(key)
  const slow = useSlowPlayback()
  const forms = words.find(w => w.word === key)?.forms
  const mine = (records[key]?.sentenceAttempts || []).filter(a => a.isAcceptable)

  useEffect(() => { document.title = `${card?.word || key} details — WordCore` }, [card, key])

  if (error) return <Shell><p className="empty">This card could not load.</p></Shell>
  if (!card) return <Shell><div className="skeleton" style={{ height: 36, width: '40%' }} /><div className="skeleton" style={{ height: 120 }} /></Shell>

  const collocations = [...new Set(card.senses.flatMap(s => s.collocations || []))]
  return (
    <Shell>
      <div className="page-head">
        <h2>{card.word}</h2>
        <p>{card.ipa} · {card.level}</p>
      </div>
      <section className="sec">
        <h3>Meanings</h3>
        <ol className="senses">
          {card.senses.map((s, i) => <li key={i}><b>{s.pattern}</b><span>{s.definition}</span></li>)}
        </ol>
      </section>
      {collocations.length > 0 && (
        <section className="sec">
          <h3>Often used with</h3>
          <div className="chips">{collocations.map(c => <span key={c} className="chip"><Highlighted text={c} word={card.word} forms={forms} /></span>)}</div>
        </section>
      )}
      {card.near?.length > 0 && (
        <section className="sec">
          <h3>Often confused with</h3>
          <div className="near">{card.near.map(n => <div key={n.word}><b>{n.word}</b><span>{n.note}</span></div>)}</div>
        </section>
      )}
      {card.mistake?.wrong && (
        <section className="sec mis">
          <h3>Common mistake</h3>
          <p className="no">{card.mistake.wrong}</p>
          <p><Highlighted text={card.mistake.right} word={card.word} forms={forms} /></p>
          <p className="why">{card.mistake.why}</p>
        </section>
      )}
      {card.family?.length > 0 && (
        <section className="sec">
          <h3>Word family</h3>
          <div className="chips">{card.family.map(f => <span key={f.word} className="chip">{f.word}<small>{f.pos}</small></span>)}</div>
        </section>
      )}
      {mine.length > 0 && (
        <section className="sec">
          <h3>Your accepted sentences</h3>
          <ul className="mine">{mine.map(a => <li key={a.normalizedSentence}>{a.sentence}</li>)}</ul>
        </section>
      )}
      <section className="sec">
        <h3>Playback speed</h3>
        <div className="seg" role="group" aria-label="Playback speed">
          <button type="button" aria-pressed={!slow} onClick={() => setSlowPlayback(false)}>Normal</button>
          <button type="button" aria-pressed={slow} onClick={() => setSlowPlayback(true)}>Slower</button>
        </div>
      </section>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="app">
      <PageTopBar />
      <main id="main-content" className="page">{children}</main>
    </div>
  )
}
