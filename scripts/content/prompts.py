"""Prompts and response schemas for the WordCore content pipeline (proven in scripts/card-pilot)."""
import os

ICONS = open(os.path.join(os.path.dirname(__file__), 'phosphor-names.txt')).read().split()

SPATIAL = ['in', 'on', 'under', 'above', 'over', 'between', 'among', 'through', 'across', 'along',
           'around', 'behind', 'in_front_of', 'next_to', 'into', 'out_of', 'onto', 'off', 'toward',
           'away_from', 'against', 'beyond', 'past', 'up', 'down']

S, O, A, I = 'STRING', 'OBJECT', 'ARRAY', 'INTEGER'
def obj(props, req=None):
    return {'type': O, 'properties': props, 'required': req or list(props), 'propertyOrdering': list(props)}
def arr(item, lo=None, hi=None):
    a = {'type': A, 'items': item}
    if lo is not None: a['minItems'] = lo
    if hi is not None: a['maxItems'] = hi
    return a
STR = {'type': S}

SCHEMA = obj({
    'word': STR,
    'ipa': STR,
    'syllables': arr(STR, 1),
    'stress': {'type': I},
    'level': {'type': S, 'enum': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']},
    'senses': arr(obj({
        'pos': STR,
        'definition': STR,
        'pattern': STR,
        'examples': arr(obj({'text': STR, 'context': STR}), 3, 3),
        'collocations': arr(STR, 2, 6),
    }), 1, 3),
    'family': arr(obj({'word': STR, 'pos': STR}), 0, 5),
    'near': arr(obj({'word': STR, 'note': STR}), 0, 3),
    'mistake': obj({'wrong': STR, 'right': STR, 'why': STR}),
    'visual': obj({
        'kind': {'type': S, 'enum': ['timeline', 'spatial', 'relation', 'scale', 'icon', 'none']},
        'tracks': arr(obj({'label': STR, 'start': {'type': I}, 'end': {'type': I}}), 0, 3),
        'marker': STR,
        'marker_at': {'type': I},
        'preposition': {'type': S, 'enum': SPATIAL + ['none']},
        'relation': {'type': S, 'enum': ['contrast', 'concession', 'cause', 'condition', 'alternative', 'addition', 'purpose', 'choice', 'none']},
        'a': STR,
        'b': STR,
        'scale': arr(STR, 0, 6),
        'scale_target': {'type': I},
        'icons': arr(STR, 0, 3),
    }, ['kind']),
    'prompts': obj({'question': STR, 'starter': STR, 'rewrite_source': STR}),
})

SYSTEM = f"""You write vocabulary study cards for an adult English learner at about B1-B2 level who studies in an English-only environment. Write everything in English. The learner practises by writing their own sentences with the word, so the card must give varied, natural material to imitate.

Rules
- senses: the 1-3 most useful senses for everyday adult life, most common first. Skip rare, technical or archaic senses. A different part of speech is a different sense.
- definition: learner-dictionary style, using words simpler than the target, at most 16 words. Never use the target word inside its own definition.
- pattern: the grammar frame to copy, e.g. "while + subject + verb", "protect sb/sth from sth".
- examples: exactly 3 per sense. Sentences a native speaker would really say or write, 8-15 words, plain and specific rather than showy, adult topics (work, home, travel, money, health, news, friends). No children's-book sentences, no real people's names. Each example must contain the target word (any inflected form) used in that sense. context: 1-3 words naming the situation, e.g. "at work", "texting a friend", "news".
- collocations: 2-6 frequent, real word partners or chunks containing the word (e.g. 'make a decision', 'while waiting'). Only phrases a corpus would show as common; never invent, and never use a different word that merely contains the letters. Fewer is better than weak ones.
- family: other word forms with a different part of speech (develop -> development, developer). Empty array if none.
- near: up to 3 words learners confuse with this one; note explains the difference in one short sentence.
- mistake: one typical learner error with this word: wrong sentence, corrected sentence, and a short reason. Use empty strings if there is no typical error.
- visual: how the app should draw the meaning without a photo.
  * "timeline" for time words (while, until, since, during, before...). 2-3 tracks, label max 4 words, start/end on a 0-10 scale. Use marker + marker_at for a single moment such as "now" or an event.
  * "spatial" for place or movement prepositions; choose preposition from the enum.
  * "relation" for linking words about logic; set relation, and a / b as short clauses (max 6 words each) from one example.
  * "scale" for gradable adjectives or adverbs and for degrees of size, likelihood or frequency: 4-6 words ordered low to high; scale_target is the index of the target word (include the target word itself).
  * "icon" for concrete nouns and physical actions: 3 candidate names from the icon list below, best first.
  * "none" when nothing above honestly shows the meaning. Do not force it.
  Leave fields that do not apply to the chosen kind empty (use "none" for preposition and relation).
- prompts: three writing tasks that make the learner produce a new sentence with the word.
  * question: a personal question whose natural answer uses the word.
  * starter: the opening words of a sentence for the learner to finish so that it uses the word.
  * rewrite_source: one or two short sentences WITHOUT the word that can be rewritten more naturally with it.
- level: CEFR level of the most common sense.
- ipa: General American IPA between slashes. syllables: the word split into syllables. stress: 0-based index of the stressed syllable.

Icon list: {' '.join(ICONS)}"""

ROLES = {
    'contrast': 'a = one fact, b = the fact that contrasts with it',
    'concession': 'a = the obstacle or surprising background, b = what is true anyway',
    'cause': 'a = the cause, b = the result',
    'condition': 'a = the condition, b = the result that depends on it',
    'alternative': 'a = the original plan or the thing replaced, b = what happens instead',
    'purpose': 'a = the action, b = the goal',
}

TIMELINE = {'type': O, 'properties': {
    'example': {'type': I},
    'tracks': {'type': A, 'minItems': 1, 'maxItems': 3, 'items': {'type': O, 'properties': {
        'label': {'type': S}, 'start': {'type': I}, 'end': {'type': I}}, 'required': ['label', 'start', 'end']}},
    'marker': {'type': S}, 'marker_at': {'type': I},
}, 'required': ['example', 'tracks', 'marker', 'marker_at']}

RELATION = {'type': O, 'properties': {
    'example': {'type': I},
    'relation': {'type': S, 'enum': list(ROLES)},
    'a': {'type': S}, 'b': {'type': S},
}, 'required': ['example', 'relation', 'a', 'b']}

SYSTEM_T = """You draw a timeline for a time word in a vocabulary app. Choose ONE of the numbered example sentences and draw exactly what happens in it.
- tracks: 1-3 bars for the actions or states in that sentence. label: 2-4 words taken from the sentence. start/end on a 0-10 time scale.
- marker/marker_at: a single moment that matters for the word (the moment something stops for "until", the starting point for "since", "now" when relevant). marker is 1-3 words from the sentence or "now"; use an empty marker if there is no such moment.
- example: the 0-based index of the sentence you drew."""

SYSTEM_R = """You mark the logic of a linking word in a vocabulary app. Choose ONE numbered example sentence in which both ideas are stated explicitly, and mark them.
- a and b must be copied EXACTLY, character for character, from that sentence (no paraphrase, no added words), and must not include the target word itself.
- Roles: """ + '; '.join(f'{k}: {v}' for k, v in ROLES.items()) + """
- example: the 0-based index of the sentence you used."""


# ---------------- word list cleanup ----------------

BANK_SCHEMA = {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {
    'word': {'type': 'STRING'},
    'status': {'type': 'STRING', 'enum': ['keep', 'inflection', 'drop']},
    'lemma': {'type': 'STRING'},
}, 'required': ['word', 'status', 'lemma']}}

BANK_SYSTEM = """You clean a frequency-ordered English word list for an adult learner's vocabulary app. For EVERY input word, in the same order, return one object.
- status "keep": a normal dictionary headword worth studying. Keep function words, days, months, languages and nationality words (English, American, Chinese, Monday, January).
- status "inflection": an inflected form (plural, past tense, past participle, -ing, third person -s, comparative, superlative) of another headword; lemma is that headword (is -> be, results -> result, came -> come, better -> good only if it is clearly the comparative).
- status "drop": abbreviations and acronyms (gps, cds, acc, inc, info, ltd), brand, product or website names, names of people, cities, countries and organisations, web or code tokens, fragments and typos.
- lemma: the dictionary headword in lowercase, except words that are always capitalised (English, Monday, January). For keep it is the word itself; for drop repeat the word."""


# ---------------- DeepSeek: JSON mode has no schema, so the shape is spelled out ----------------

CARD_SHAPE = """Return one JSON object with exactly this shape (all keys present):
{
  "word": "the target word",
  "ipa": "/.../",
  "syllables": ["syl", "la", "bles"],
  "stress": 0,
  "level": "A1|A2|B1|B2|C1|C2",
  "senses": [
    {"pos": "noun|verb|adjective|...", "definition": "...", "pattern": "...",
     "examples": [{"text": "...", "context": "..."}, {"text": "...", "context": "..."}, {"text": "...", "context": "..."}],
     "collocations": ["...", "..."]}
  ],
  "family": [{"word": "...", "pos": "..."}],
  "near": [{"word": "...", "note": "..."}],
  "mistake": {"wrong": "...", "right": "...", "why": "..."},
  "visual": {"kind": "timeline|spatial|relation|scale|icon|none",
             "tracks": [{"label": "...", "start": 0, "end": 10}], "marker": "", "marker_at": 0,
             "preposition": "one of the preposition list or none", "relation": "contrast|concession|cause|condition|alternative|addition|purpose|choice|none",
             "a": "", "b": "", "scale": [], "scale_target": 0, "icons": []},
  "prompts": {"question": "...", "starter": "...", "rewrite_source": "..."}
}
senses has 1-3 items and every sense has exactly 3 examples. Preposition list: """ + ', '.join(SPATIAL) + """.
Output only the JSON object."""

TIMELINE_SHAPE = """Return JSON: {"example": 0, "tracks": [{"label": "...", "start": 0, "end": 10}], "marker": "", "marker_at": 0}"""
RELATION_SHAPE = """Return JSON: {"example": 0, "relation": "contrast|concession|cause|condition|alternative|purpose", "a": "...", "b": "..."}"""

LEVELS = {'A1', 'A2', 'B1', 'B2', 'C1', 'C2'}
KINDS = {'timeline', 'spatial', 'relation', 'scale', 'icon', 'none'}
RELATIONS = {'contrast', 'concession', 'cause', 'condition', 'alternative', 'addition', 'purpose', 'choice'}


def card_problems(card):
    """Why a model-written card cannot be used as is (empty list when it is fine)."""
    p = []
    s = lambda v: isinstance(v, str) and v.strip() != ''
    if not isinstance(card, dict):
        return ['not an object']
    if not s(card.get('ipa')):
        p.append('ipa')
    if not (isinstance(card.get('syllables'), list) and card['syllables'] and all(s(x) for x in card['syllables'])):
        p.append('syllables')
    if not isinstance(card.get('stress'), int):
        p.append('stress')
    if card.get('level') not in LEVELS:
        p.append('level')
    senses = card.get('senses')
    if not (isinstance(senses, list) and 1 <= len(senses) <= 3):
        p.append('senses count')
    else:
        for i, sense in enumerate(senses):
            if not all(s(sense.get(k)) for k in ('pos', 'definition', 'pattern')):
                p.append(f'sense {i} fields')
            exs = sense.get('examples')
            if not (isinstance(exs, list) and len(exs) == 3 and all(isinstance(e, dict) and s(e.get('text')) and s(e.get('context')) for e in exs)):
                p.append(f'sense {i} examples')
            if not isinstance(sense.get('collocations'), list):
                p.append(f'sense {i} collocations')
    v = card.get('visual')
    if not (isinstance(v, dict) and v.get('kind') in KINDS):
        p.append('visual kind')
    elif v['kind'] == 'spatial' and v.get('preposition') not in SPATIAL:
        p.append('visual preposition')
    elif v['kind'] == 'relation' and v.get('relation') not in RELATIONS:
        p.append('visual relation')
    pr = card.get('prompts')
    if not (isinstance(pr, dict) and all(s(pr.get(k)) for k in ('question', 'starter', 'rewrite_source'))):
        p.append('prompts')
    m = card.get('mistake')
    if not isinstance(m, dict):
        p.append('mistake')
    return p


def tidy_card(card):
    """Fill optional parts the model may omit so the app sees one shape."""
    card.setdefault('family', [])
    card.setdefault('near', [])
    m = card.setdefault('mistake', {})
    for k in ('wrong', 'right', 'why'):
        m[k] = m.get(k) or ''
    v = card['visual']
    for k, default in (('tracks', []), ('marker', ''), ('marker_at', 0), ('preposition', 'none'), ('relation', 'none'),
                       ('a', ''), ('b', ''), ('scale', []), ('scale_target', 0), ('icons', [])):
        v.setdefault(k, default)
    return card
