import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useProgressContext } from '../context/ProgressContext'
import { useCard, useContent } from '../context/ContentContext'
import { normalizeSentenceKey } from '../hooks/useProgress'
import { checkSentence } from '../services/sentenceCheck'
import { stop as stopAudio } from '../services/audio'
import { includesWord } from '../lib/wordForms'
import { getEarliestReviewDate } from './studySession'
import useStudySession, { REQUIRED_ACCEPTED_ATTEMPTS } from './useStudySession'
import { StudyTopBar } from '../components/TopBar'
import PlayButton from '../components/PlayButton'
import Composer from '../components/study/Composer'
import Thread from '../components/study/Thread'
import Visual, { ExampleText, RoleLegend } from '../components/study/Visual'

let nextId = 1
const uid = () => `m${nextId++}`

export default function Study() {
  const { words, status } = useContent()
  const { syncState } = useProgressContext()
  const ready = useMemo(() => words.filter(w => w.ready), [words])

  if (status === 'error') return <Message title="Study content could not load." detail="Check your connection and reload the page." />
  if (status === 'loading' || syncState === 'loading') return <StudySkeleton />
  if (!ready.length) return <Message title="Your study cards are being prepared." detail="Check back in a few minutes." />
  return <StudySession words={ready} />
}

function StudySession({ words }) {
  const progress = useProgressContext()
  const session = useStudySession(words, progress.records, progress.syncState)
  const { current } = session.state

  if (!current) {
    const next = getEarliestReviewDate(words, progress.records)
    return (
      <Message
        title="All caught up for now."
        detail={next ? `Next review: ${next.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}` : ''}
        topTitle={`${progress.masteredCount} mastered`}
      />
    )
  }
  return <WordStudy key={current.word} entry={current} session={session} progress={progress} />
}

function examplesOf(card) {
  const list = []
  card.senses.forEach((sense, si) => sense.examples.forEach(ex => {
    list.push({ si, text: ex.text, context: ex.context, clip: card.audio?.examples?.[list.length] })
  }))
  // Show the sentence a drawing was made from first, so drawing and example match.
  const k = card.visual?.example ? list.findIndex(e => e.text === card.visual.example) : -1
  if (k > 0) list.unshift(list.splice(k, 1)[0])
  return list
}

function WordStudy({ entry, session, progress }) {
  const { state, dispatch, advance } = session
  const { records, saveDraft, saveFeedback, setStatus, markMastered, confirmReview, resetToLearning, masteredCount } = progress
  const { card, error } = useCard(entry.word)
  const record = records[entry.word] || {}
  const [exi, setExi] = useState(0)
  const [notes, setNotes] = useState([]) // this visit's prompts, pending sentence and messages
  const [focusSignal, setFocusSignal] = useState(0)
  const scrollNext = useRef(false)

  const examples = useMemo(() => (card ? examplesOf(card) : []), [card])
  const cur = examples[exi]
  const sense = cur ? card.senses[cur.si] : null
  const accepted = record.acceptedAttempts || 0
  const isReview = record.status === 'mastered'
  const sessionReady = Boolean(state.feedback?.is_acceptable) && accepted >= REQUIRED_ACCEPTED_ATTEMPTS && state.sessionAcceptedSentences.size > 0
  const storedReady = !state.feedback && accepted >= REQUIRED_ACCEPTED_ATTEMPTS && Boolean(record.feedback?.isAcceptable)
  const masteredReady = sessionReady || storedReady
  const display = card?.word || entry.display || entry.word

  useEffect(() => { document.title = `${display} — WordCore` }, [display])
  useEffect(() => () => stopAudio(), [])

  const items = useMemo(() => {
    const saved = [...(record.sentenceAttempts || [])]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .flatMap(a => [
        { id: `a-${a.normalizedSentence}-me`, type: 'me', text: a.sentence, at: a.createdAt },
        {
          id: `a-${a.normalizedSentence}-r`, type: 'result', ok: a.isAcceptable, at: a.createdAt,
          note: a.feedbackGrammar || a.feedbackNaturalness, revision: a.isAcceptable ? '' : a.feedbackRevision,
        },
      ])
    const all = [...saved, ...notes].sort((a, b) => new Date(a.at) - new Date(b.at))
    const last = all.findLast(i => i.type === 'result')
    if (last && last.ok) last.tally = accepted
    if (state.isChecking) all.push({ id: 'typing', type: 'typing' })
    return all
  }, [record.sentenceAttempts, notes, accepted, state.isChecking])

  useEffect(() => {
    if (!scrollNext.current) return
    scrollNext.current = false
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }))
  }, [items.length])

  if (error) {
    return (
      <Message title="This card could not load." detail="Move on and it will be tried again later."
        action={<button type="button" className="btn primary" onClick={() => advance(entry.word, record.status || 'learning')}>Next word</button>} />
    )
  }
  if (!card) return <StudySkeleton />

  const hasText = state.sentence.trim().length > 0
  const hasWord = includesWord(state.sentence, card.word, entry.forms)
  const hint = hasText && !hasWord ? `Include “${display}” to check your sentence` : ''

  function addNote(note) {
    scrollNext.current = true
    setNotes(list => [...list, { id: uid(), at: new Date().toISOString(), ...note }])
  }

  function setSentence(value) {
    dispatch({ type: 'set-sentence', value })
    saveDraft(entry.word, value)
  }

  function handleIdea(kind) {
    const p = card.prompts || {}
    const label = { answer: `Answer with “${display}”`, finish: 'Finish this sentence', rewrite: `Rewrite this with “${display}”` }[kind]
    const text = { answer: p.question, finish: p.starter, rewrite: p.rewrite_source }[kind]
    if (!text) return
    addNote({ type: 'prompt', label, text })
    if (kind === 'finish') setSentence(`${text.replace(/(\.\.\.|…)\s*$/, '').trimEnd()} `)
    setFocusSignal(n => n + 1)
  }

  async function handleSend() {
    const text = state.sentence.trim()
    if (!text || !hasWord || state.isChecking) return
    const key = normalizeSentenceKey(text)
    setSentence('')
    if ((record.sentenceAttempts || []).some(a => a.isAcceptable && a.normalizedSentence === key)) {
      addNote({ type: 'me', text })
      addNote({ type: 'note', text: 'You already used this sentence. Write a new one to make progress.' })
      return
    }
    const pendingId = uid()
    scrollNext.current = true
    setNotes(list => [...list, { id: pendingId, type: 'me', text, pending: true, at: new Date().toISOString() }])
    dispatch({ type: 'check-start' })
    try {
      const result = await checkSentence({ word: card.word, definition: sense.definition, referenceSentence: cur.text, userSentence: text })
      dispatch({ type: 'check-success', result, sentence: text })
      scrollNext.current = true
      setNotes(list => list.filter(n => n.id !== pendingId))
      saveFeedback(entry.word, result, text)
    } catch (err) {
      const busy = (err?.message || '').toLowerCase().includes('too many')
      dispatch({ type: 'check-error', message: '' })
      setNotes(list => list.map(n => (n.id === pendingId ? { ...n, pending: false } : n)))
      addNote({ type: 'note', text: busy ? 'You are checking too quickly. Wait a moment, then send it again.' : 'The check did not go through. Your sentence is back in the box, try again.' })
      setSentence(text)
    }
  }

  function handleMastered() {
    if (!masteredReady) return
    if (isReview) confirmReview(entry.word)
    else markMastered(entry.word)
    advance(entry.word, 'mastered')
  }

  function handleNext() {
    if (isReview) {
      advance(entry.word, 'mastered') // skipping a review keeps the word mastered
      return
    }
    setStatus(entry.word, 'learning')
    advance(entry.word, 'learning')
  }

  function handlePractiseMore() {
    resetToLearning(entry.word)
    advance(entry.word, 'learning')
  }

  const syllables = card.syllables?.length > 1
    ? card.syllables.map((s, i) => (i === card.stress ? <b key={i}>{s}</b> : <span key={i}>{s}</span>)).reduce((acc, el, i) => (i ? [...acc, '·', el] : [el]), [])
    : null

  return (
    <div className="app">
      <StudyTopBar
        title={`${masteredCount} mastered`}
        subtitle={isReview ? 'Review' : `${Math.min(accepted, REQUIRED_ACCEPTED_ATTEMPTS)} of ${REQUIRED_ACCEPTED_ATTEMPTS} sentences accepted`}
        action={<Link className="pill" to={`/word/${encodeURIComponent(entry.word)}`}>Details</Link>}
      />
      <main id="main-content" className="page page--study">
        <section className="card" aria-label="Word">
          <div className="meta">{card.level}{sense?.pos ? ` · ${sense.pos}` : ''}{isReview ? ' · review' : ''}</div>
          <div className="word-row">
            <h1>{display}</h1>
            <PlayButton clip={card.audio?.word} label={`Play “${display}”`} />
          </div>
          <p className="pron">{card.ipa}{syllables && <> · <span className="syl">{syllables}</span></>}</p>
          {sense && <p className="def">{sense.definition}</p>}
          <Visual card={card} exampleText={cur?.text} />
          {cur && (
            <>
              <div className="bubble ex">
                <p><ExampleText text={cur.text} word={card.word} forms={entry.forms} visual={card.visual} /></p>
                <PlayButton size="sm" clip={cur.clip} label="Play the example" />
              </div>
              <RoleLegend visual={card.visual} text={cur.text} />
              <div className="ex-foot">
                <span>{cur.context}</span>
                <span className="num">{exi + 1} / {examples.length}</span>
                <span className="sep" />
                {examples.length > 1 && <button type="button" className="link" onClick={() => { stopAudio(); setExi((exi + 1) % examples.length) }}>Another example</button>}
              </div>
            </>
          )}
        </section>

        <Thread items={items} word={card.word} forms={entry.forms} required={REQUIRED_ACCEPTED_ATTEMPTS} />

        <div className="actions">
          {masteredReady && (
            <button type="button" className="btn primary" onClick={handleMastered}>{isReview ? 'Keep as mastered' : 'Mark as mastered'}</button>
          )}
          {isReview && masteredReady && <button type="button" className="btn" onClick={handlePractiseMore}>Practise more</button>}
          <button type="button" className={`btn${masteredReady ? '' : ' quiet'}`} onClick={handleNext}>
            {items.some(i => i.type === 'result') ? 'Next word' : 'Skip for now'}
          </button>
        </div>
      </main>

      <Composer
        value={state.sentence}
        onChange={setSentence}
        onSend={handleSend}
        onIdea={handleIdea}
        onMastered={handleMastered}
        canSend={hasText && hasWord && !state.isChecking}
        busy={state.isChecking}
        hint={hint}
        placeholder={`Write a sentence with “${display}”`}
        focusSignal={focusSignal}
      />
    </div>
  )
}

function StudySkeleton() {
  return (
    <div className="app">
      <div className="top" />
      <main className="page" aria-busy="true">
        <div className="skeleton" style={{ height: 14, width: '22%' }} />
        <div className="skeleton" style={{ height: 56, width: '46%' }} />
        <div className="skeleton" style={{ height: 18, width: '70%' }} />
        <div className="skeleton" style={{ height: 88, borderRadius: 22 }} />
      </main>
    </div>
  )
}

function Message({ title, detail, action, topTitle }) {
  return (
    <div className="app">
      <StudyTopBar title={topTitle || 'WordCore'} />
      <main id="main-content" className="page page--message">
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
        {action}
      </main>
    </div>
  )
}
