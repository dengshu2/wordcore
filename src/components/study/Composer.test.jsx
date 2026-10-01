import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Composer from './Composer'

function setup() {
  const onSend = vi.fn()
  render(<Composer value="I like this app" onChange={() => {}} onSend={onSend} onIdea={() => {}} canSend busy={false} hint="" placeholder="Write" focusSignal={0} />)
  return { onSend, field: screen.getByLabelText('Your sentence') }
}

describe('Composer', () => {
  it('sends on Enter and labels the return key as send', () => {
    const { onSend, field } = setup()
    expect(field).toHaveAttribute('enterkeyhint', 'send')
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 13 })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('does not send on the Enter that confirms an input-method candidate', () => {
    const { onSend, field } = setup()
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 }) // Safari: composition already ended
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 13, isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('adds a line on Shift+Enter', () => {
    const { onSend, field } = setup()
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 13, shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })
})
