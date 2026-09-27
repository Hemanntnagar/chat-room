'use client'

import { useLayoutEffect, useRef } from 'react'

const MAX_HEIGHT_PX = 120

export function ComposerTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  disabled,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = 'auto'
    const next = Math.min(node.scrollHeight, MAX_HEIGHT_PX)
    node.style.height = `${next}px`
    node.style.overflowY = node.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden'
  }, [value])

  return (
    <textarea
      ref={ref}
      className="composer-textarea"
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        // Let IME composition (e.g. Hindi / emoji keyboards) finish before sending.
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
        event.preventDefault()
        onSubmit()
      }}
    />
  )
}
