# WordCore Rebuild Plan

> Date: 2026-03-08

## Product Goal

WordCore is an ultra-minimal English vocabulary imitation-writing tool.

The product goal is not to help users "finish a word list", but to help them turn the core 3000 words into expressions they can actively write.

Core loop:

1. Read the target word and a natural reference sentence
2. Write a parallel sentence by changing one small detail
3. Get lightweight language feedback
4. Repeat until the word is genuinely usable

## Target User

Learners who can understand basic English sentences but still struggle to produce natural sentences on their own.

## Core Principles

1. Minimal UI: remove non-essential panels, stats, and decorative clutter
2. Focus-first: each screen should support one primary action
3. Lightweight feedback: AI should give short, actionable language guidance
4. Persistent learning records: user-written sentences must be saved, reviewed, and exportable
5. Completion-oriented: the system must help a user actually work through the 3000-word foundation

## Core Learning Flow

For each word:

1. Show word, part of speech, definition, and reference sentence
2. Let the user write a similar sentence with one changed detail
3. Run AI-based sentence checking on `Self-check`
4. Return concise feedback:
   - acceptable or needs revision
   - key grammar or naturalness note
   - suggested revision
5. Save the user's sentence and feedback
6. Re-queue the word until it meets mastery criteria

## Core Features

### Study

- Show the current word, definition, and reference sentence
- Let the user write a similar sentence
- Run AI feedback on demand
- Save the latest draft automatically
- Keep the interface within a single, focused workspace

### AI Sentence Check

Triggered when the user presses `Self-check`.

Suggested response shape:

```json
{
  "is_acceptable": true,
  "grammar_feedback": "",
  "naturalness_feedback": "",
  "suggested_revision": ""
}
```

Display rule:

- If acceptable, show a very short confirmation
- If revision is needed, show only the most important issue
- Always provide a suggested rewrite

### Learning Records

Per word, the system should eventually track:

```js
records[word] = {
  status: 'new' | 'learning' | 'mastered',
  draft: '...',
  lastCheckedSentence: '...',
  feedback: {
    isAcceptable: true,
    grammarFeedback: '',
    naturalnessFeedback: '',
    suggestedRevision: ''
  },
  attempts: 0,
  acceptedAttempts: 0,
  updatedAt: 'ISO_DATE'
}
```

### Word Bank

The word bank is not just a dictionary view. It is a review screen for:

- word info
- reference sentence
- user sentence
- status
- written-only filtering
- CSV export

### CSV Export

Suggested columns:

- `word`
- `pos`
- `definition`
- `reference_sentence`
- `my_sentence`
- `status`
- `attempts`
- `accepted_attempts`
- `updated_at`

## Mastery Logic

Manual one-click mastery is only acceptable for the MVP.

Later rules should move toward:

- multiple successful imitation attempts
- AI acceptance as part of the mastery signal
- mastered words returning at lower frequency for review

## Review Scheduling

The long-term system should prioritize:

1. unseen words
2. unfinished learning words
3. recently weak words
4. occasional mastered review

## Frontend Style Direction

The product should stay visually restrained:

- minimal layout
- very low UI noise
- short copy
- no decorative dashboard sprawl
- one-screen study workflow on desktop
- typography and spacing should do most of the work

## Delivery Phases

### Phase 1

Add the AI sentence-check loop to `Self-check` with minimal feedback UI.

### Phase 2

Unify learning records so status, drafts, feedback, attempts, and timestamps live in a single model.

### Phase 3

Upgrade mastery rules so a word becomes mastered only after repeated acceptable attempts.

### Phase 4

Add stronger review scheduling to help a learner actually finish the 3000-word set.

### Phase 5

Continue removing UI noise while preserving saved history and feedback visibility.
