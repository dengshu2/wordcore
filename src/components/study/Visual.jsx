import { splitByWord } from '../../lib/wordForms'

// Drawings that show a word's meaning without a photo. The content pipeline
// picks the kind and grounds timelines and logic links in one example
// sentence; anything it could not ground arrives as kind "none" and draws nothing.

const ROLES = {
  contrast: ['one fact', 'contrasting fact'],
  concession: ['obstacle', 'true anyway'],
  cause: ['cause', 'result'],
  condition: ['condition', 'result'],
  alternative: ['replaced', 'chosen instead'],
  purpose: ['action', 'goal'],
}

export function Highlighted({ text, word, forms }) {
  return splitByWord(text, word, forms).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))
}

/** The example sentence, with the two linked ideas marked when this is a logic word's grounding example. */
export function ExampleText({ text, word, forms, visual }) {
  const v = visual || {}
  if (v.kind !== 'relation' || v.example !== text || !v.a || !v.b) return <Highlighted text={text} word={word} forms={forms} />
  const parts = [[text.indexOf(v.a), v.a, 'ca'], [text.indexOf(v.b), v.b, 'cb']].sort((p, q) => p[0] - q[0])
  if (parts[0][0] < 0 || parts[0][0] + parts[0][1].length > parts[1][0]) return <Highlighted text={text} word={word} forms={forms} />
  const out = []
  let pos = 0
  parts.forEach(([at, piece, cls], i) => {
    out.push(<Highlighted key={`t${i}`} text={text.slice(pos, at)} word={word} forms={forms} />)
    out.push(<span key={`p${i}`} className={cls}>{piece}</span>)
    pos = at + piece.length
  })
  out.push(<Highlighted key="end" text={text.slice(pos)} word={word} forms={forms} />)
  return out
}

export function RoleLegend({ visual, text }) {
  if (visual?.kind !== 'relation' || visual.example !== text) return null
  const [a, b] = ROLES[visual.relation] || ROLES.contrast
  return <div className="legend"><span className="ca">{a}</span><span className="cb">{b}</span></div>
}

function Timeline({ v }) {
  const tracks = (v.tracks || []).filter(t => t.label)
  const x = t => 16 + Math.max(0, Math.min(10, t)) * 30.8
  const top = v.marker ? 40 : 16
  const h = top + tracks.length * 44 + 24
  const mx = x(v.marker_at ?? 0)
  const anchor = mx > 280 ? 'end' : mx < 60 ? 'start' : 'middle'
  return (
    <svg className="draw" viewBox={`0 0 340 ${h}`} role="img" aria-label="Timeline">
      {v.marker && (
        <>
          <line x1={mx} x2={mx} y1={22} y2={h - 18} stroke="var(--amber)" strokeWidth="1.5" strokeDasharray="3 4" />
          <circle cx={mx} cy={22} r={4} fill="var(--amber)" />
          <text x={mx} y={12} textAnchor={anchor} fontSize="12.5" fontWeight="600" fill="var(--amber)">{v.marker}</text>
        </>
      )}
      {tracks.map((t, i) => {
        const y = top + i * 44 + 16
        return (
          <g key={i}>
            <text x={Math.min(x(t.start), 230)} y={y - 7} fontSize="13" fill="var(--ink)" stroke="var(--bg)" strokeWidth="6" paintOrder="stroke">{t.label}</text>
            <rect x={x(t.start)} y={y} width={Math.max(6, x(t.end) - x(t.start))} height={10} rx={5} fill={i ? 'var(--faint)' : 'var(--green)'} />
          </g>
        )
      })}
      <line x1={16} x2={326} y1={h - 8} y2={h - 8} stroke="var(--line)" strokeWidth="1.5" />
    </svg>
  )
}

// Spatial scenes on a 340x160 canvas: grey landmarks, a green dot for the thing
// that is placed or moves, and a green arrow for movement.
const Box = props => <rect rx="8" fill="var(--bubble)" stroke="var(--faint)" strokeWidth="1.5" {...props} />
const Dot = ({ x, y }) => <circle cx={x} cy={y} r="10" fill="var(--green)" />
const Arrow = ({ d, dashed }) => <path d={d} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeDasharray={dashed ? '5 6' : undefined} markerEnd="url(#wc-arrow)" />
const Surface = props => <rect rx="3" fill="var(--faint)" {...props} />

const SCENES = {
  in: <><Box x="120" y="40" width="100" height="80" /><Dot x={170} y={80} /></>,
  on: <><Surface x="90" y="100" width="160" height="12" /><Dot x={170} y={88} /></>,
  under: <><Surface x="90" y="56" width="160" height="12" /><Surface x="100" y="68" width="8" height="70" /><Surface x="232" y="68" width="8" height="70" /><Dot x={170} y={112} /></>,
  above: <><Box x="110" y="104" width="120" height="40" /><Dot x={170} y={48} /></>,
  over: <><Box x="130" y="84" width="80" height="60" /><Arrow d="M60 130C120 20 220 20 276 128" /><Dot x={52} y={138} /></>,
  between: <><Box x="50" y="40" width="40" height="80" /><Box x="250" y="40" width="40" height="80" /><Dot x={170} y={80} /></>,
  among: <>{[0, 1, 2, 3, 4, 5, 6].map(i => { const a = (i / 7) * Math.PI * 2; return <circle key={i} cx={170 + Math.cos(a) * 60} cy={80 + Math.sin(a) * 46} r="10" fill="var(--bubble)" stroke="var(--faint)" strokeWidth="1.5" /> })}<Dot x={170} y={80} /></>,
  through: <><Box x="120" y="48" width="100" height="64" rx="0" /><Arrow d="M50 80H296" /><Dot x={40} y={80} /></>,
  across: <><Box x="136" y="10" width="70" height="140" rx="0" /><Arrow d="M64 80H280" /><Dot x={52} y={80} /></>,
  along: <><Surface x="30" y="112" width="280" height="6" /><Arrow d="M64 92H296" /><Dot x={52} y={92} /></>,
  around: <><Box x="135" y="50" width="70" height="60" /><Arrow d="M170 24a82 56 0 1 1 -1 0" /><Dot x={170} y={24} /></>,
  behind: <><Dot x={196} y={66} /><Box x="130" y="44" width="90" height="84" /></>,
  in_front_of: <><Box x="150" y="30" width="90" height="84" /><Dot x={180} y={104} /></>,
  next_to: <><Box x="110" y="40" width="80" height="80" /><Dot x={216} y={80} /></>,
  into: <><Box x="190" y="40" width="110" height="80" /><Arrow d="M62 80H236" /><Dot x={50} y={80} /></>,
  out_of: <><Box x="40" y="40" width="110" height="80" /><Arrow d="M104 80H292" /><Dot x={94} y={80} /></>,
  onto: <><Surface x="170" y="112" width="140" height="12" /><Arrow d="M64 110C120 30 200 40 236 98" /><Dot x={52} y={118} /></>,
  off: <><Surface x="30" y="92" width="140" height="12" /><Arrow d="M120 76C200 50 250 90 282 136" /><Dot x={110} y={80} /></>,
  toward: <><circle cx="282" cy="80" r="24" fill="var(--bubble)" stroke="var(--faint)" strokeWidth="1.5" /><circle cx="282" cy="80" r="7" fill="var(--faint)" /><Arrow d="M72 80H206" /><Dot x={58} y={80} /></>,
  away_from: <><circle cx="70" cy="80" r="24" fill="var(--bubble)" stroke="var(--faint)" strokeWidth="1.5" /><circle cx="70" cy="80" r="7" fill="var(--faint)" /><Arrow d="M150 80H296" /><Dot x={138} y={80} /></>,
  against: <><Surface x="222" y="20" width="14" height="120" /><Dot x={207} y={80} /><Arrow d="M110 66H184" /><Arrow d="M110 94H184" /></>,
  beyond: <><path d="M176 12v136" stroke="var(--faint)" strokeWidth="2" strokeDasharray="6 6" /><Arrow d="M60 112C130 10 220 10 262 84" dashed /><Dot x={274} y={102} /><circle cx="50" cy="122" r="8" fill="none" stroke="var(--faint)" strokeWidth="2" /></>,
  past: <><Box x="150" y="24" width="44" height="64" /><Arrow d="M64 116H296" /><Dot x={52} y={116} /></>,
  up: <><Surface x="110" y="140" width="120" height="6" /><Arrow d="M170 124V36" /><Dot x={170} y={128} /></>,
  down: <><Surface x="110" y="140" width="120" height="6" /><Arrow d="M170 36V112" /><Dot x={170} y={26} /></>,
}

function Spatial({ preposition }) {
  const scene = SCENES[preposition]
  if (!scene) return null
  return (
    <svg className="draw" viewBox="0 0 340 160" role="img" aria-label={preposition.replace(/_/g, ' ')}>
      <defs>
        <marker id="wc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="var(--green)" />
        </marker>
      </defs>
      {scene}
    </svg>
  )
}

function Scale({ v, word }) {
  const items = v.scale || []
  if (items.length < 2) return null
  const idx = items.findIndex(x => x.toLowerCase() === word.toLowerCase())
  const target = Math.max(0, Math.min(items.length - 1, v.scale_target ?? idx))
  return (
    <div className="scale" role="img" aria-label={`From ${items[0]} to ${items[items.length - 1]}`}>
      {items.map((it, i) => (
        <div key={i} className={`tick${i === target ? ' on' : ''}`}><i /><span>{it}</span></div>
      ))}
    </div>
  )
}

/** The drawing above the example, or null when this word (or this example) has none. */
export default function Visual({ card, exampleText }) {
  const v = card?.visual
  if (!v) return null
  let body = null
  if (v.kind === 'timeline' && v.example === exampleText) body = <Timeline v={v} />
  else if (v.kind === 'spatial') body = <Spatial preposition={v.preposition} />
  else if (v.kind === 'scale') body = <Scale v={v} word={card.word} />
  else if (v.kind === 'icon' && v.icons?.[0]) body = <span className="icon" role="img" aria-label={v.icons[0].replace(/-/g, ' ')} style={{ '--icon': `url(/icons/${v.icons[0]}.svg)` }} />
  return body ? <div className="visual">{body}</div> : null
}
