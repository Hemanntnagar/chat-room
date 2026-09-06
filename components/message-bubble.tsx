'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, CheckCheck, Paperclip, Pause, Play, Volume2 } from 'lucide-react'
import {
  type ChatMessage,
  type MessageStatus,
  HUB_NAME,
} from '@/lib/chat-messages'

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function Avatar({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`profile-avatar ${small ? 'profile-avatar-small' : ''}`}
      aria-label="Profit Online Hub avatar"
    >
      <span>Profit</span>
      <strong>ONLINE</strong>
      <small>HUB</small>
    </div>
  )
}

function StatusTicks({ status }: { status?: MessageStatus }) {
  if (!status || status === 'sending') {
    return <Check size={14} className="tick tick-pending" aria-label="Sending" />
  }
  if (status === 'sent') {
    return <Check size={14} className="tick" aria-label="Sent" />
  }
  return (
    <CheckCheck
      size={14}
      className={`tick ${status === 'read' ? 'tick-read' : ''}`}
      aria-label={status === 'read' ? 'Read' : 'Delivered'}
    />
  )
}

function VoiceBubble({
  caption,
  outgoing,
  audioUrl,
  durationSec = 0,
}: {
  caption?: string
  outgoing?: boolean
  audioUrl?: string
  durationSec?: number
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!playing || audioUrl) return
    const id = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          setPlaying(false)
          setElapsed(0)
          return 0
        }
        return value + 4
      })
      setElapsed((value) => value + 0.12)
    }, 120)
    return () => window.clearInterval(id)
  }, [playing, audioUrl])

  const togglePlayback = async () => {
    if (!audioUrl) {
      setPlaying((value) => !value)
      return
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.addEventListener('timeupdate', () => {
        const audio = audioRef.current
        if (!audio || !audio.duration) return
        setProgress((audio.currentTime / audio.duration) * 100)
        setElapsed(audio.currentTime)
      })
      audioRef.current.addEventListener('ended', () => {
        setPlaying(false)
        setProgress(0)
        setElapsed(0)
      })
    }

    const audio = audioRef.current
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <>
      <div className="voice-controls">
        <button
          aria-label={playing ? 'Pause voice message' : 'Play voice message'}
          className={`play-button ${outgoing ? 'play-button-out' : ''}`}
          type="button"
          onClick={() => {
            void togglePlayback()
          }}
        >
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
        </button>
        <div className="voice-track">
          <span style={{ width: `${Math.max(progress, playing ? 4 : 8)}%` }} />
        </div>
        <Volume2 size={17} className="volume-icon" />
      </div>
      <div className="voice-meta">
        <span>{playing ? formatDuration(elapsed) : formatDuration(durationSec)}</span>
        <span>1x</span>
      </div>
      {caption ? <p className="voice-caption">{caption}</p> : null}
    </>
  )
}

function PresetBody({ preset }: { preset: NonNullable<ChatMessage['preset']> }) {
  if (preset === 'links') {
    return (
      <div className="space-y-3">
        <a href="https://777.us" className="chat-link" target="_blank" rel="noreferrer">
          https://777.us
        </a>
        <a href="https://Cricxbet99.xyz" className="chat-link" target="_blank" rel="noreferrer">
          https://Cricxbet99.xyz
        </a>
        <a href="https://9wicket.com" className="chat-link" target="_blank" rel="noreferrer">
          https://9wicket.com
        </a>
        <a href="https://gold.365.run" className="chat-link" target="_blank" rel="noreferrer">
          https://gold.365.run
        </a>
        <p className="pt-1">
          (FOR DEMO Id - Just click on LOGIN WITH DEMO on our sites)
          <span aria-hidden="true">👍</span>
        </p>
        <p>
          ♆ Profit Online HUB ♆
          <br />
          ╰┈➤ 🙏 <strong>HAPPY GAMING</strong> 🙏 ╰┈➤
        </p>
        <p>🚦FAST WITHDRAWALWITH IN 10 MINUTES 🚦</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p>
        <span aria-hidden="true">💬</span> You can chat here or click the WhatsApp button above to
        connect directly.
      </p>
      <p lang="hi">
        आप यहाँ चैट कर सकते हैं या ऊपर दिए WhatsApp button पर क्लिक करके सीधे जुड़ सकते हैं।
      </p>
      <a href="https://bio.wa.link/profit" className="chat-link" target="_blank" rel="noreferrer">
        https://bio.wa.link/profit
      </a>
    </div>
  )
}

export function MessageBubble({
  message,
  perspective = 'visitor',
}: {
  message: ChatMessage
  perspective?: 'visitor' | 'admin'
}) {
  if (message.type === 'system' || message.from === 'system') {
    return (
      <div className="system-message" role="status">
        <span>{message.content}</span>
      </div>
    )
  }

  const outgoing = perspective === 'admin' ? message.from === 'them' : message.from === 'me'
  const displayName =
    message.senderName ?? (outgoing ? (perspective === 'admin' ? HUB_NAME : 'You') : HUB_NAME)

  return (
    <article
      className={`message-row ${outgoing ? 'message-out' : 'message-in'} ${message.type === 'voice' ? 'voice-row' : ''}`}
    >
      {!outgoing && <Avatar small />}
      <div
        className={`message-bubble ${outgoing ? 'bubble-out' : 'bubble-in'} ${message.type === 'voice' ? 'voice-bubble' : ''} ${message.type === 'file' ? 'file-bubble' : ''}`}
      >
        <div className={`sender-name ${outgoing ? 'sender-name-out' : ''}`}>{displayName}</div>
        {message.type === 'voice' ? (
          <VoiceBubble
            caption={message.audioUrl ? undefined : String(message.text ?? message.content)}
            outgoing={outgoing}
            audioUrl={message.audioUrl}
            durationSec={message.durationSec}
          />
        ) : message.type === 'file' ? (
          <div className="file-card">
            <Paperclip size={18} />
            <span>{message.fileName ?? 'Attachment'}</span>
          </div>
        ) : (
          <div className="message-body">
            {message.preset ? <PresetBody preset={message.preset} /> : message.content}
          </div>
        )}
        <div className="message-meta">
          <time>{message.timestamp}</time>
          {outgoing && <StatusTicks status={message.status} />}
        </div>
      </div>
    </article>
  )
}
