import { useEffect, useId, useState } from 'react'
import { onPlayingChange, play } from '../services/audio'
import { useSlowPlayback } from '../lib/settings'
import { SpeakerIcon } from './Icons'

export default function PlayButton({ clip, label, size = 'md' }) {
  const id = useId()
  const slow = useSlowPlayback()
  const [on, setOn] = useState(false)
  useEffect(() => onPlayingChange(playing => setOn(playing === id)), [id])
  if (!clip?.text) return null
  return (
    <button type="button" className={`play play--${size}${on ? ' is-on' : ''}`} aria-label={label} aria-pressed={on}
      onClick={() => play(id, clip, { slow })}>
      <SpeakerIcon />
    </button>
  )
}
