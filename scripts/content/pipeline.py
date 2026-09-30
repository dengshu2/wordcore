"""WordCore content pipeline, slow and resumable.

  word list --(Gemini, interactive)--> content/bank.json          cleaned, lemmatised, frequency-ordered headwords
            --(Gemini Batch API)-----> content/cards/<word>.json  English-only study cards
            --(Gemini, interactive)--> grounded timeline/relation visuals
            --(MiMo TTS + MiMo ASR)--> content/audio/<provider>-<voice>/<key>.mp3 (+ .json with the check result)

Usage:
  python3 pipeline.py status
  python3 pipeline.py run [--start-rank N]      # works until everything is done; safe to stop and restart
  touch content/STOP                              # ask a running job to exit at the next safe point

Every step is skipped when its output file already exists, so a crash or restart never redoes paid work.
"""
import argparse
import datetime
import fcntl
import glob
import json
import os
import re
import subprocess
import sys
import threading
import time
import traceback
import unicodedata
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor

import lib
import prompts as P
from lib import CONTENT, DailyQuota, Stop

TEXT_MODEL = lib.env('CONTENT_TEXT_MODEL', 'gemini-3.8-flash')
CARDS_PROVIDER = lib.env('CARDS_PROVIDER', 'gemini-batch')     # gemini-batch | deepseek
CARD_WORKERS = int(lib.env('CARD_WORKERS', '12'))
PROVIDER = lib.env('TTS_PROVIDER', 'mimo')
VOICE = lib.env('TTS_VOICE', 'Mia')
MIMO_DAILY_CAP = int(lib.env('MIMO_DAILY_CAP', '40000'))          # TTS + ASR calls per day; bounds cost if the free period ends
REFINE_DAILY_CAP = int(lib.env('REFINE_DAILY_CAP', '150'))       # interactive Gemini calls per day (translens shares the key)
AUDIO_WORKERS = int(lib.env('AUDIO_WORKERS', '4'))         # words voiced in parallel; ~40 TTS + ~40 ASR calls/min, half of MiMo's 100 RPM
PAUSE = float(lib.env('PIPELINE_PAUSE', '1.0'))                   # seconds between TTS/ASR calls
BATCH_POLL_SECS = 300
BATCH_MAX = int(lib.env('CARDS_BATCH_MAX', '400'))                # words per Gemini batch; bounds the loss if a batch goes wrong

BANK = os.path.join(CONTENT, 'bank.json')
CARDS = os.path.join(CONTENT, 'cards')
AUDIO = os.path.join(CONTENT, 'audio', f'{PROVIDER}-{VOICE}')
STATE = os.path.join(CONTENT, 'state.json')
LOG = os.path.join(CONTENT, 'logs', 'pipeline.log')
STOP_FILE = os.path.join(CONTENT, 'STOP')
PILOT_CARDS = os.path.join(lib.ROOT, 'scripts', 'card-pilot', 'cards')  # optional: cards reviewed during the pilot
RAW_WORDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'source-words.json')

for d in (CARDS, AUDIO, os.path.dirname(LOG)):
    os.makedirs(d, exist_ok=True)


def log(msg):
    line = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S} {msg}'
    print(line, flush=True)
    with open(LOG, 'a') as f:
        f.write(line + '\n')


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, value):
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(value, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def today():
    return datetime.date.today().isoformat()


_calls_lock = threading.Lock()


def count_call(state, kind, n=1):
    with _calls_lock:
        _count_call(state, kind, n)


def _count_call(state, kind, n):
    c = state.setdefault('calls', {})
    if c.get('date') != today():
        c.clear()
        c['date'] = today()
    c[kind] = c.get(kind, 0) + n
    cap = {'mimo': MIMO_DAILY_CAP, 'refine': REFINE_DAILY_CAP}.get(kind)
    if cap and c[kind] > cap:
        raise DailyQuota(f'self-imposed daily cap reached for {kind} ({cap})')


# ---------------- 1. word list ----------------

def build_bank():
    bank = load_json(BANK, None)
    if bank:
        return bank
    raw = [x['word'] for x in load_json(RAW_WORDS, [])]
    partial_path = os.path.join(CONTENT, 'bank-partial.json')
    partial = load_json(partial_path, {})
    chunks = [raw[i:i + 100] for i in range(0, len(raw), 100)]
    for n, chunk in enumerate(chunks):
        if str(n) in partial:
            continue
        out, _ = lib.gemini_json(TEXT_MODEL, P.BANK_SYSTEM, '\n'.join(chunk), P.BANK_SCHEMA, thinking='low')
        by = {o['word'].strip().lower(): o for o in out if isinstance(o, dict) and o.get('word')}
        partial[str(n)] = [by.get(w.lower(), {'word': w, 'status': 'keep', 'lemma': w}) for w in chunk]
        save_json(partial_path, partial)
        log(f'bank: cleaned words {n * 100 + 1}-{n * 100 + len(chunk)} of {len(raw)}')
        time.sleep(2)
    rows = [r for n in range(len(chunks)) for r in partial[str(n)]]
    lemmas, index, dropped = [], {}, []
    for rank, r in enumerate(rows):
        if r['status'] == 'drop':
            dropped.append(r['word'])
            continue
        lemma = (r.get('lemma') or r['word']).strip()
        if lemma.lower() not in index:
            index[lemma.lower()] = len(lemmas)
            lemmas.append({'lemma': lemma, 'rank': rank, 'sources': []})
        lemmas[index[lemma.lower()]]['sources'].append(r['word'])
    bank = {'created': today(), 'model': TEXT_MODEL, 'raw': len(raw), 'lemmas': lemmas, 'dropped': dropped}
    save_json(BANK, bank)
    log(f'bank: {len(raw)} raw words -> {len(lemmas)} headwords, {len(dropped)} dropped')
    return bank


def card_path(lemma):
    return os.path.join(CARDS, f'{lemma.lower()}.json')


def import_pilot_cards(bank):
    wanted = {l['lemma'].lower() for l in bank['lemmas']}
    for path in glob.glob(os.path.join(PILOT_CARDS, '*.json')):
        word = os.path.basename(path)[:-5]
        if word in wanted and not os.path.exists(card_path(word)):
            card = load_json(path, None)
            if card:
                card.pop('_usage', None)
                card.pop('_issues', None)
                card['source'] = 'pilot'
                save_json(card_path(word), card)


# ---------------- 2. cards (Gemini Batch API, half price, separate quota) ----------------

def stem_ok(word, sentence):
    w = word.lower()
    root = w[:-1] if (w.endswith('e') and len(w) > 3) or w.endswith('y') else w
    return any(t.startswith(root) for t in re.findall(r"[a-z']+", sentence.lower()))


def finish_card(lemma, card):
    card['word'] = lemma
    v = card.setdefault('visual', {'kind': 'none'})
    if v.get('kind') == 'icon':
        v['icons'] = [i for i in v.get('icons', []) if i in P.ICONS]
        if not v['icons']:
            v['kind'] = 'none'
    if v.get('kind') == 'spatial' and v.get('preposition') in (None, '', 'none'):
        v['kind'] = 'none'
    # A logic-link drawing only makes sense for linking words ("reply" was once drawn as one).
    linking = {'conjunction', 'adverb', 'preposition'}
    if v.get('kind') == 'relation' and not any(str(s.get('pos', '')).lower() in linking for s in card.get('senses', [])):
        card['visual'] = v = {'kind': 'none', 'dropped': 'relation'}
    card['issues'] = [ex['text'] for s in card.get('senses', []) for ex in s.get('examples', []) if not stem_ok(lemma, ex['text'])]
    card['generated'] = today()
    return card


def study_order(bank, start_rank):
    """Headwords in frequency order, starting where the learner currently is and wrapping around."""
    lemmas = sorted(bank['lemmas'], key=lambda l: l['rank'])
    k = next((i for i, l in enumerate(lemmas) if l['rank'] >= start_rank), 0)
    return lemmas[k:] + lemmas[:k]


def cards_stage(bank, state, start_rank):
    """Returns True while a batch is still running."""
    attempts = state.setdefault('card_attempts', {})
    missing = [l['lemma'] for l in study_order(bank, start_rank)
               if not os.path.exists(card_path(l['lemma'])) and attempts.get(l['lemma'], 0) < 3][:BATCH_MAX]
    batch = state.get('batch')
    if batch:
        if time.time() - batch.get('last_poll', 0) < BATCH_POLL_SECS:
            return True
        info = lib.gemini_batch_get(batch['name'])
        batch['last_poll'] = time.time()
        st = str(lib.find_key(info, 'state') or '')
        if 'SUCCEEDED' in st:
            ingest_batch(info, batch, attempts)
            state['batch'] = None
            return False
        if any(x in st for x in ('FAILED', 'CANCELLED', 'EXPIRED')):
            log(f'cards: batch {batch["name"]} ended as {st}; will resubmit what is missing')
            for k in batch['keys']:
                attempts[k] = attempts.get(k, 0) + 1
            state['batch'] = None
            return False
        log(f'cards: batch {batch["name"]} is {st or "pending"} ({len(batch["keys"])} words, submitted {batch["submitted"]})')
        return True
    if not missing:
        return False
    jsonl = os.path.join(CONTENT, 'batch-input.jsonl')
    with open(jsonl, 'w') as f:
        for lemma in missing:
            f.write(json.dumps({'key': lemma, 'request': lib.gemini_request(P.SYSTEM, f'Target word: {lemma}', P.SCHEMA, 'medium')}) + '\n')
    file_name = lib.gemini_upload_jsonl(jsonl, f'wordcore-cards-{today()}')
    created = lib.gemini_batch_create(TEXT_MODEL, file_name, f'wordcore-cards-{today()}-{len(missing)}')
    name = created.get('name') or lib.find_key(created, 'name')
    state['batch'] = {'name': name, 'keys': missing, 'submitted': datetime.datetime.now().isoformat(timespec='minutes'),
                      'last_poll': time.time()}
    log(f'cards: submitted batch {name} for {len(missing)} words')
    return True


def ingest_batch(info, batch, attempts):
    out_file = lib.find_key(info, 'responsesFile')
    if not out_file:
        raise RuntimeError(f'batch finished without a responses file: {json.dumps(info)[:300]}')
    ok = bad = 0
    for line in lib.gemini_download(out_file).splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        lemma = row.get('key')
        try:
            card = json.loads(lib.gemini_text_of(row['response']))
            if not card.get('senses'):
                raise ValueError('no senses')
            save_json(card_path(lemma), finish_card(lemma, card))
            ok += 1
        except Exception as e:  # noqa: BLE001 - any malformed row just goes back into the queue
            attempts[lemma] = attempts.get(lemma, 0) + 1
            bad += 1
            log(f'cards: {lemma} failed ({str(e)[:80]}); attempt {attempts[lemma]}')
    log(f'cards: batch {batch["name"]} done, {ok} cards written, {bad} to retry')


# ---------------- 3. grounded visuals ----------------

def examples_of(card):
    return [ex['text'] for s in card['senses'] for ex in s['examples']]


def refine_stage(bank, state, limit):
    done = 0
    for l in bank['lemmas']:
        if done >= limit:
            break
        path = card_path(l['lemma'])
        card = load_json(path, None)
        if not card or card['visual'].get('kind') not in ('timeline', 'relation') or card['visual'].get('example'):
            continue
        exs = examples_of(card)
        user = f'Target word: {card["word"]}\nExamples:\n' + '\n'.join(f'{i}. {t}' for i, t in enumerate(exs))
        kind, new = card['visual']['kind'], None
        for _ in range(3):
            count_call(state, 'refine')
            if kind == 'timeline':
                out, _ = lib.gemini_json(TEXT_MODEL, P.SYSTEM_T, user, P.TIMELINE)
            else:
                out, _ = lib.gemini_json(TEXT_MODEL, P.SYSTEM_R, user, P.RELATION)
            i = out.get('example', -1)
            if not 0 <= i < len(exs):
                continue
            if kind == 'relation' and not (out.get('a') and out.get('b') and out['a'] in exs[i] and out['b'] in exs[i]):
                continue
            new = {'kind': kind, 'example': exs[i], **{k: v for k, v in out.items() if k != 'example'}}
            break
        # An ungrounded drawing was sometimes wrong (reversed logic), so no drawing beats a guess.
        card['visual'] = new or {'kind': 'none', 'dropped': kind}
        save_json(path, card)
        done += 1
        log(f'visual: {card["word"]} {kind} -> {"grounded" if new else "dropped"}')
    return done


# ---------------- 2b. cards with DeepSeek (interactive, parallel, no thinking) ----------------

def deepseek_ground(card):
    """Ground a timeline/relation drawing in one example; return the new visual or None."""
    kind = card['visual']['kind']
    exs = examples_of(card)
    user = f'Target word: {card["word"]}\nExamples:\n' + '\n'.join(f'{i}. {t}' for i, t in enumerate(exs))
    system = (P.SYSTEM_T + '\n' + P.TIMELINE_SHAPE) if kind == 'timeline' else (P.SYSTEM_R + '\n' + P.RELATION_SHAPE)
    for _ in range(3):
        out, _ = lib.deepseek_json(system, user)
        i = out.get('example', -1)
        if not isinstance(i, int) or not 0 <= i < len(exs):
            continue
        if kind == 'relation' and not (out.get('relation') in P.RELATIONS and out.get('a') and out.get('b')
                                       and out['a'] in exs[i] and out['b'] in exs[i]):
            continue
        if kind == 'timeline' and not (isinstance(out.get('tracks'), list) and out['tracks']):
            continue
        return {'kind': kind, 'example': exs[i], **{k: v for k, v in out.items() if k != 'example'}}
    return None


def deepseek_card(lemma):
    """Write one card; returns (lemma, ok, note)."""
    system = P.SYSTEM + '\n\n' + P.CARD_SHAPE
    problems = []
    for _ in range(3):
        card, _ = lib.deepseek_json(system, f'Target word: {lemma}')
        problems = P.card_problems(card)
        if problems and all(x.startswith('visual') for x in problems) and isinstance(card, dict):
            # The text is fine; only the drawing is off the list. Keep the card without a drawing.
            card['visual'] = {'kind': 'none', 'dropped': str((card.get('visual') or {}).get('kind'))}
            problems = P.card_problems(card)
        if not problems:
            break
    else:
        return lemma, False, ', '.join(problems)
    card = finish_card(lemma, P.tidy_card(card))
    if card['visual']['kind'] in ('timeline', 'relation'):
        kind = card['visual']['kind']
        card['visual'] = deepseek_ground(card) or {'kind': 'none', 'dropped': kind}
    card['generator'] = 'deepseek-flash'
    save_json(card_path(lemma), card)
    return lemma, True, card['visual']['kind']


def cards_deepseek(start_rank, limit=None):
    bank = build_bank()
    todo = [l['lemma'] for l in study_order(bank, start_rank) if not os.path.exists(card_path(l['lemma']))]
    if limit:
        todo = todo[:limit]
    log(f'cards/deepseek: {len(todo)} to write with {CARD_WORKERS} workers')
    done = failed = 0
    t0 = time.time()
    with ThreadPoolExecutor(CARD_WORKERS) as ex:
        for lemma, ok, note in ex.map(lambda w: _safe(deepseek_card, w), todo):
            if os.path.exists(STOP_FILE):
                log('cards/deepseek: STOP requested; finishing the cards already in flight')
                ex.shutdown(cancel_futures=True)
                break
            done += ok
            failed += not ok
            if not ok:
                log(f'cards/deepseek: {lemma} failed: {note}')
            if (done + failed) % 50 == 0:
                rate = (done + failed) / max(1, time.time() - t0) * 60
                log(f'cards/deepseek: {done + failed}/{len(todo)} ({failed} failed, {rate:.0f}/min)')
    log(f'cards/deepseek: finished, {done} written, {failed} failed in {time.time() - t0:.0f}s')


def _safe(fn, *args):
    try:
        return fn(*args)
    except Stop:
        raise
    except Exception as e:  # noqa: BLE001 - one bad word must not stop the batch
        return args[0], False, f'{type(e).__name__}: {str(e)[:120]}'


# ---------------- 4. audio ----------------

def plain(s):
    """Lowercase ASCII words: café -> cafe, curly quotes -> straight."""
    s = unicodedata.normalize('NFKD', s.replace('’', "'")).encode('ascii', 'ignore').decode()
    return ' '.join(re.findall(r"[a-z0-9']+", s.lower()))


def words_of(s):
    return plain(s).split()


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def mp3_normalize(data):
    """Re-encode to 48 kbps mono: fixes the occasional broken first frame and keeps files small."""
    r = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 'mp3', '-i', 'pipe:0', '-ac', '1', '-b:a', '48k', '-f', 'mp3', 'pipe:1'],
                       input=data, capture_output=True)
    return r.stdout if r.returncode == 0 and r.stdout else data


def mp3_seconds(data):
    """Length of a 48 kbps CBR file (what mp3_normalize produces); ffprobe cannot read the length from a pipe."""
    return len(data) * 8 / 48000


# MiMo ASR sometimes refuses harmless audio with this canned text; that says nothing about the speech itself.
ASR_REFUSAL = re.compile(r'request was rejected|considered high risk', re.I)


def judge(kind, text, heard, secs):
    """Return (ok, score). The ASR is unreliable on lone words ("while" -> "Wow"), so words pass on shape."""
    want, got = words_of(text), words_of(heard)
    if kind == 'word':
        if got == want:
            return True, 1.0
        return (len(got) == 1 and 0.2 < secs <= 1.8), 0.5
    dist = edit_distance(want, got)
    # Character similarity forgives spelling variants the ASR normalises (favourite/favorite)
    # while repeats, skipped words and misread words still fail.
    ratio = SequenceMatcher(None, plain(text), plain(heard)).ratio()
    ok = dist == 0 or (ratio >= 0.93 and len(got) <= len(want) + 2)
    return ok, ratio


def synthesize(text, style):
    if PROVIDER == 'mimo':
        return lib.mimo_tts(text, VOICE, style)
    if PROVIDER == 'doubao':
        return lib.doubao_tts(text, VOICE)
    raise Stop(f'unknown TTS_PROVIDER {PROVIDER}')


def clips_of(card):
    yield 'word', card['word']
    for text in examples_of(card):
        yield 'sentence', text


def audio_pending(card):
    return [(k, t) for k, t in clips_of(card)
            if not os.path.exists(os.path.join(AUDIO, lib.clip_key(PROVIDER, VOICE, lib.tts_style(k) if PROVIDER == 'mimo' else '', t) + '.json'))]


def make_clip(state, word, kind, text):
    style = lib.tts_style(kind) if PROVIDER == 'mimo' else ''
    key = lib.clip_key(PROVIDER, VOICE, style, text)
    best = None
    for attempt in range(1, 4):
        count_call(state, 'mimo' if PROVIDER == 'mimo' else 'tts')
        audio = mp3_normalize(synthesize(text, style))
        time.sleep(PAUSE)
        count_call(state, 'mimo')
        heard = lib.mimo_asr(audio)
        time.sleep(PAUSE)
        secs = mp3_seconds(audio)
        refused = bool(ASR_REFUSAL.search(heard))
        ok, score = (True, 0.9) if refused else judge(kind, text, heard, secs)
        if best is None or score > best['score']:
            best = {'audio': audio, 'heard': heard, 'score': score, 'ok': ok, 'secs': secs, 'attempts': attempt,
                    'unverified': refused}
        if ok:
            break
    tmp = os.path.join(AUDIO, f'{key}.mp3.{threading.get_ident()}.tmp')
    with open(tmp, 'wb') as f:
        f.write(best['audio'])
    os.replace(tmp, os.path.join(AUDIO, key + '.mp3'))
    save_json(os.path.join(AUDIO, key + '.json'), {
        'word': word, 'kind': kind, 'text': text, 'heard': best['heard'], 'ok': best['ok'], 'seconds': round(best['secs'], 2),
        'attempts': best['attempts'], 'unverified': best['unverified'], 'provider': PROVIDER, 'voice': VOICE, 'style': style, 'created': today()})
    if not best['ok']:
        log(f'audio: {word} {kind} kept after 3 tries, needs review: "{text[:60]}" heard "{best["heard"][:60]}"')
    return best['ok']


def audio_stage(bank, state, start_rank, max_words):
    """Voice the next words that have cards, AUDIO_WORKERS words at a time."""
    todo = []
    for l in study_order(bank, start_rank):
        if len(todo) >= max_words or os.path.exists(STOP_FILE):
            break
        card = load_json(card_path(l['lemma']), None)
        if card and audio_pending(card):
            todo.append(card)
    if not todo:
        return 0

    def voice(card):
        pending = audio_pending(card)
        for kind, text in pending:
            if os.path.exists(STOP_FILE):
                return card['word'], 0
            make_clip(state, card['word'], kind, text)
        return card['word'], len(pending)

    with ThreadPoolExecutor(AUDIO_WORKERS) as ex:
        for word, n in ex.map(voice, todo):
            log(f'audio: {word} ({n} clips)')
    return len(todo)


# ---------------- status and loop ----------------

def status():
    bank = load_json(BANK, None)
    state = load_json(STATE, {})
    if not bank:
        print('bank: not built yet')
        return
    lemmas = bank['lemmas']
    cards = [load_json(card_path(l['lemma']), None) for l in lemmas]
    have = [c for c in cards if c]
    kinds = {}
    for c in have:
        kinds[c['visual'].get('kind', 'none')] = kinds.get(c['visual'].get('kind', 'none'), 0) + 1
    ungrounded = sum(1 for c in have if c['visual'].get('kind') in ('timeline', 'relation') and not c['visual'].get('example'))
    metas = [load_json(p, {}) for p in glob.glob(os.path.join(AUDIO, '*.json'))]
    words_done = sum(1 for c in have if not audio_pending(c))
    clips_total = sum(1 + len(examples_of(c)) for c in have)
    print(f'bank:   {bank["raw"]} raw words -> {len(lemmas)} headwords ({len(bank["dropped"])} dropped)')
    b = state.get('batch')
    print(f'cards:  {len(have)}/{len(lemmas)}' + (f'   batch {b["name"]} running since {b["submitted"]}' if b else ''))
    print(f'visual: {kinds}   still to ground: {ungrounded}')
    print(f'audio:  {PROVIDER}-{VOICE}  {len(metas)}/{clips_total} clips for cards so far, {words_done} words complete, '
          f'{sum(1 for m in metas if not m.get("ok"))} need review, {sum(1 for m in metas if m.get("unverified"))} unverified (ASR refused)')
    print(f'today:  {state.get("calls", {})}   caps: mimo {MIMO_DAILY_CAP}/day, refine {REFINE_DAILY_CAP}/day')
    if os.path.exists(STOP_FILE):
        print(f'STOP:   {open(STOP_FILE).read().strip() or "requested"}')


def run(start_rank):
    lock = open(os.path.join(CONTENT, '.lock'), 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit('another pipeline run is already active')
    log(f'run: start (provider={PROVIDER} voice={VOICE} start_rank={start_rank})')
    while not os.path.exists(STOP_FILE):
        state = load_json(STATE, {})
        try:
            bank = build_bank()
            import_pilot_cards(bank)
            batch_running = cards_stage(bank, state, start_rank) if CARDS_PROVIDER == 'gemini-batch' else False
            save_json(STATE, state)
            refined = refine_stage(bank, state, limit=5) if CARDS_PROVIDER == 'gemini-batch' else 0
            voiced = audio_stage(bank, state, start_rank, max_words=AUDIO_WORKERS * 2)
            save_json(STATE, state)
            if not batch_running and not refined and not voiced and not state.get('batch'):
                left = [l for l in bank['lemmas'] if not os.path.exists(card_path(l['lemma']))]
                gave_up = CARDS_PROVIDER == 'gemini-batch' and all(state.get('card_attempts', {}).get(l['lemma'], 0) >= 3 for l in left)
                if not left or gave_up:
                    log('run: everything is done')
                    break
            if not refined and not voiced:
                time.sleep(120)
        except DailyQuota as e:
            save_json(STATE, state)
            log(f'run: {e}; sleeping an hour')
            time.sleep(3600)
        except Stop as e:
            save_json(STATE, state)
            with open(STOP_FILE, 'w') as f:
                f.write(f'{today()} {e}\n')
            log(f'run: stopped: {e}')
            break
        except Exception:  # noqa: BLE001 - keep a multi-day job alive through transient bugs; details go to the log
            save_json(STATE, state)
            log('run: error\n' + traceback.format_exc())
            time.sleep(300)
    log('run: exit')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run', 'status', 'cards'])
    ap.add_argument('--limit', type=int, default=None)
    ap.add_argument('--start-rank', type=int, default=int(lib.env('START_RANK', '0')))
    a = ap.parse_args()
    if a.cmd == 'status':
        status()
    elif a.cmd == 'cards':
        cards_deepseek(a.start_rank, a.limit)
    else:
        run(a.start_rank)
