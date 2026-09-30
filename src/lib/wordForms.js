// Recognise a target word in a sentence, including inflected forms: regular
// endings (drop -> dropped), common irregular forms (take -> took) and the
// forms the word bank merged into this headword (be -> was, were).

const IRREGULAR = {
  be: ['is', 'am', 'are', 'was', 'were', 'been', 'being'], have: ['has', 'had'], do: ['does', 'did', 'done'],
  say: ['said'], go: ['went', 'gone'], get: ['got', 'gotten'], make: ['made'], know: ['knew', 'known'],
  think: ['thought'], take: ['took', 'taken'], see: ['saw', 'seen'], come: ['came'], give: ['gave', 'given'],
  find: ['found'], tell: ['told'], become: ['became'], leave: ['left'], feel: ['felt'], bring: ['brought'],
  begin: ['began', 'begun'], keep: ['kept'], hold: ['held'], write: ['wrote', 'written'], stand: ['stood'],
  hear: ['heard'], mean: ['meant'], meet: ['met'], run: ['ran'], pay: ['paid'], sit: ['sat'],
  speak: ['spoke', 'spoken'], lead: ['led'], grow: ['grew', 'grown'], lose: ['lost'], fall: ['fell', 'fallen'],
  send: ['sent'], build: ['built'], understand: ['understood'], draw: ['drew', 'drawn'], break: ['broke', 'broken'],
  spend: ['spent'], rise: ['rose', 'risen'], drive: ['drove', 'driven'], buy: ['bought'], wear: ['wore', 'worn'],
  choose: ['chose', 'chosen'], sell: ['sold'], catch: ['caught'], teach: ['taught'], eat: ['ate', 'eaten'],
  fly: ['flew', 'flown'], win: ['won'], sleep: ['slept'], forget: ['forgot', 'forgotten'], fight: ['fought'],
  throw: ['threw', 'thrown'], show: ['shown'], hide: ['hid', 'hidden'], ride: ['rode', 'ridden'],
  shake: ['shook', 'shaken'], steal: ['stole', 'stolen'], wake: ['woke', 'woken'], feed: ['fed'],
  can: ['could'], will: ['would'], may: ['might'], shall: ['should'],
  good: ['better', 'best'], bad: ['worse', 'worst'], far: ['further', 'farther', 'furthest'],
  child: ['children'], man: ['men'], woman: ['women'], person: ['people'], foot: ['feet'], tooth: ['teeth'],
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function stem(word) {
  if (word.length <= 3) return word
  if (word.endsWith('e')) return word.slice(0, -1)
  if (word.endsWith('y')) return word.slice(0, -1)
  return word
}

export function wordPattern(word, forms = []) {
  const w = word.toLowerCase()
  const alternatives = new Set([...(IRREGULAR[w] || []), ...forms.map(f => f.toLowerCase())])
  // Regular inflections: the stem plus a short ending (s, es, ed, ing, er, est, ies, ied, ly...).
  const regular = `${escape(stem(w))}[a-z]{0,4}`
  const parts = [regular, ...[...alternatives].map(escape)]
  return new RegExp(`\\b(${parts.join('|')})\\b`, 'gi')
}

export function includesWord(sentence, word, forms) {
  if (!sentence.trim() || !word) return false
  return wordPattern(word, forms).test(sentence)
}

/** Split text into [{text, hit}] parts for highlighting the target word. */
export function splitByWord(text, word, forms) {
  const re = wordPattern(word, forms)
  const parts = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), hit: false })
    parts.push({ text: m[0], hit: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false })
  return parts
}
