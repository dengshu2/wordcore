"""Shared clients for the WordCore content pipeline: Gemini (text + Batch API), MiMo (TTS + ASR), Doubao (TTS)."""
import base64
import hashlib
import json
import os
import socket
import time
import urllib.error
import urllib.request
import uuid

# Gemini rejects this server's IPv6 range ("User location is not supported"); force IPv4 for everything.
_orig_getaddrinfo = socket.getaddrinfo
socket.getaddrinfo = lambda h, p, f=0, *a, **k: _orig_getaddrinfo(h, p, socket.AF_INET, *a, **k)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONTENT = os.path.join(ROOT, 'content')


def env(name, default=None):
    if name in os.environ:
        return os.environ[name]
    try:
        for line in open(os.path.join(ROOT, '.env')):
            if line.startswith(name + '='):
                return line.split('=', 1)[1].strip()
    except FileNotFoundError:
        pass
    return default


class Stop(Exception):
    """Unrecoverable for this run (bad key, billing, quota for the day). The loop pauses or exits."""


class DailyQuota(Stop):
    pass


def http_json(url, body=None, headers=None, timeout=120, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type': 'application/json', **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def with_retries(fn, what, attempts=8):
    """Retry transient failures (429/5xx/network) with backoff; turn auth/billing errors into Stop."""
    for i in range(attempts):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors='replace')[:600]
            if 'PerDay' in body or 'per day' in body.lower():
                raise DailyQuota(f'{what}: daily quota reached: {body[:200]}')
            if e.code in (401, 402, 403):
                raise Stop(f'{what}: HTTP {e.code}: {body[:300]}')
            if e.code in (429, 500, 502, 503, 504) and i < attempts - 1:
                time.sleep(min(600, 15 * 2 ** i))
                continue
            raise RuntimeError(f'{what}: HTTP {e.code}: {body[:300]}')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if i < attempts - 1:
                time.sleep(min(300, 10 * 2 ** i))
                continue
            raise RuntimeError(f'{what}: network: {e}')


# ---------------- Gemini ----------------

GEMINI = 'https://generativelanguage.googleapis.com'


def gemini_key():
    return env('GEMINI_API_KEY')


def gemini_request(system, user, schema, thinking='medium'):
    return {
        'systemInstruction': {'parts': [{'text': system}]},
        'contents': [{'role': 'user', 'parts': [{'text': user}]}],
        'generationConfig': {'responseMimeType': 'application/json', 'responseSchema': schema,
                             'thinkingConfig': {'thinkingLevel': thinking}},
    }


def gemini_text_of(response):
    parts = response['candidates'][0]['content']['parts']
    return ''.join(p.get('text', '') for p in parts if not p.get('thought'))


def gemini_json(model, system, user, schema, thinking='medium'):
    d = with_retries(lambda: http_json(f'{GEMINI}/v1beta/models/{model}:generateContent',
                                       gemini_request(system, user, schema, thinking),
                                       {'x-goog-api-key': gemini_key()}), f'gemini {model}')
    return json.loads(gemini_text_of(d)), d.get('usageMetadata', {})


def gemini_upload_jsonl(path, display_name):
    size = os.path.getsize(path)
    start = urllib.request.Request(f'{GEMINI}/upload/v1beta/files', method='POST',
                                   data=json.dumps({'file': {'display_name': display_name}}).encode(), headers={
        'x-goog-api-key': gemini_key(), 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': str(size), 'X-Goog-Upload-Header-Content-Type': 'application/jsonl',
        'Content-Type': 'application/json'})
    with urllib.request.urlopen(start, timeout=60) as r:
        upload_url = r.headers['X-Goog-Upload-URL']
    put = urllib.request.Request(upload_url, method='POST', data=open(path, 'rb').read(), headers={
        'Content-Length': str(size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize'})
    with urllib.request.urlopen(put, timeout=600) as r:
        return json.load(r)['file']['name']


def gemini_batch_create(model, file_name, display_name):
    return with_retries(lambda: http_json(f'{GEMINI}/v1beta/models/{model}:batchGenerateContent',
                                          {'batch': {'display_name': display_name, 'input_config': {'file_name': file_name}}},
                                          {'x-goog-api-key': gemini_key()}), 'gemini batch create')


def gemini_batch_get(name):
    return with_retries(lambda: http_json(f'{GEMINI}/v1beta/{name}', headers={'x-goog-api-key': gemini_key()}),
                        'gemini batch get')


def find_key(obj, key):
    """First value for `key` anywhere in a nested JSON value (batch responses nest it differently by version)."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            found = find_key(v, key)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_key(v, key)
            if found is not None:
                return found
    return None


def gemini_download(file_name):
    req = urllib.request.Request(f'{GEMINI}/download/v1beta/{file_name}:download?alt=media',
                                 headers={'x-goog-api-key': gemini_key()})
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read().decode()


# ---------------- TTS / ASR ----------------

MIMO_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
SENTENCE_STYLE = ('Clear, natural American English at a relaxed, steady pace, '
                  'like a friendly teacher reading an example sentence to a learner.')


def tts_style(kind):
    """Single words get no style: a teacher-like style made MiMo add fillers ("Um, among") in testing."""
    return SENTENCE_STYLE if kind == 'sentence' else ''


def clip_key(provider, voice, style, text):
    """Cache key shared with the app: the backend can look up the same file for the same text."""
    return hashlib.sha1(f'{provider}\n{voice}\n{style}\n{text}'.encode()).hexdigest()[:20]


def mimo_tts(text, voice, style):
    messages = ([{'role': 'user', 'content': style}] if style else []) + [{'role': 'assistant', 'content': text}]
    d = with_retries(lambda: http_json(MIMO_URL, {'model': 'mimo-v2.5-tts', 'messages': messages,
                                                  'audio': {'format': 'mp3', 'voice': voice}},
                                       {'Authorization': f'Bearer {env("MIMO_API_KEY")}'}, timeout=90), 'mimo tts')
    if d.get('error'):
        raise RuntimeError(f'mimo tts error: {d["error"]}')
    return base64.b64decode(d['choices'][0]['message']['audio']['data'])


def mimo_asr(mp3_bytes):
    body = {'model': 'mimo-v2.5-asr', 'messages': [{'role': 'user', 'content': [
        {'type': 'input_audio', 'input_audio': {'data': base64.b64encode(mp3_bytes).decode(), 'format': 'mp3'}}]}]}
    d = with_retries(lambda: http_json(MIMO_URL, body, {'Authorization': f'Bearer {env("MIMO_API_KEY")}'}, timeout=90),
                     'mimo asr')
    return (d['choices'][0]['message'].get('content') or '').strip()


def doubao_tts(text, voice='en_female_dacey_uranus_bigtts', resource='seed-tts-2.0', speech_rate=0):
    body = json.dumps({'user': {'uid': 'wordcore'}, 'req_params': {
        'text': text, 'speaker': voice, 'audio_params': {'format': 'mp3', 'sample_rate': 24000, 'speech_rate': speech_rate}}}).encode()

    def call():
        req = urllib.request.Request('https://openspeech.bytedance.com/api/v3/tts/unidirectional', data=body, headers={
            'Content-Type': 'application/json', 'X-Api-Key': env('DOUBAO_TTS_API_KEY'),
            'X-Api-Resource-Id': resource, 'X-Api-Request-Id': str(uuid.uuid4())})
        audio = bytearray()
        with urllib.request.urlopen(req, timeout=60) as r:
            for line in r:
                if not line.strip():
                    continue
                msg = json.loads(line)
                if msg.get('code', 0) == 0 and msg.get('data'):
                    audio += base64.b64decode(msg['data'])
                elif msg.get('code') == 20000000:
                    break
                elif msg.get('code'):
                    raise RuntimeError(f'doubao code={msg.get("code")} {msg.get("message")}')
        return bytes(audio)
    return with_retries(call, 'doubao tts')


# ---------------- DeepSeek ----------------

def deepseek_key():
    key = env('DEEPSEEK_API_KEY')
    if key:
        return key
    try:  # shared with the mcp-chat stack
        for line in open('/srv/stacks/mcp-chat/.env'):
            if line.startswith('DEEPSEEK_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"')
    except FileNotFoundError:
        pass
    return None


def deepseek_json(system, user, model='deepseek-flash', thinking=False, temperature=0.7):
    """JSON-mode chat call. JSON mode guarantees valid JSON, not a shape: callers validate."""
    body = {'model': model, 'response_format': {'type': 'json_object'}, 'temperature': temperature,
            'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}
    if not thinking:
        body['thinking'] = {'type': 'disabled'}
    d = with_retries(lambda: http_json('https://api.deepseek.com/chat/completions', body,
                                       {'Authorization': f'Bearer {deepseek_key()}'}, timeout=180), 'deepseek')
    return json.loads(d['choices'][0]['message']['content']), d.get('usage', {})
