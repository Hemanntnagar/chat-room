'use client'

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  Download,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Send,
  Smile,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Avatar, MessageBubble } from '@/components/message-bubble'
import {
  type ChatMessage,
  type MessageStatus,
  HUB_NAME,
  formatTime,
  loadMessages,
  saveMessages,
} from '@/lib/chat-messages'

const EMOJIS = ['🙂', '😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '🔥', '💬', '✅', '🤖']
const QUICK_REPLIES = [
  { label: '🤖 🆔 I Need ID.', text: 'I Need ID.' },
  { label: '🤖 💬 I Need Support', text: 'I Need Support' },
]

const AUTO_REPLIES: Record<string, string> = {
  'i need id.': 'Sure! Please share your preferred game. We will create your demo ID shortly.',
  'i need support': 'Our support team is here. Please describe your issue and we will help you right away.',
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function pickAudioMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
}

function Header() {
  return (
    <header className="chat-header">
      <div className="header-profile">
        <div className="avatar-wrap">
          <Avatar />
          <span className="online-dot" />
        </div>
        <div>
          <h1>Profit Online Hub</h1>
          <p>online</p>
        </div>
      </div>
      <div className="header-actions">
        <button aria-label="Call Profit Online Hub" className="icon-button header-call" type="button">
          <Phone size={22} />
        </button>
        <a
          href="https://bio.wa.link/profit"
          target="_blank"
          rel="noreferrer"
          aria-label="Open WhatsApp"
          className="icon-button whatsapp-button"
        >
          <MessageCircle size={25} />
        </a>
        <button className="save-chat-button" type="button" aria-label="Save chat">
          <Download size={22} />
          <span>Save Chat</span>
        </button>
      </div>
    </header>
  )
}

function NameGate({
  onJoin,
}: {
  onJoin: (name: string) => void
}) {
  const [draft, setDraft] = useState('')
  const canJoin = draft.trim().length > 0

  return (
    <section className="name-gate" aria-label="Join chat room">
      <div className="name-gate-card">
        <div className="name-gate-icon">
          <UserRound size={28} />
        </div>
        <h2>Enter your name to join</h2>
        <p>Your name will be visible to everyone in this chat room.</p>
        <form
          className="name-gate-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canJoin) return
            onJoin(draft.trim())
          }}
        >
          <label htmlFor="visitor-name" className="sr-only">
            Your name
          </label>
          <input
            id="visitor-name"
            value={draft}
            autoFocus
            maxLength={40}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Your name"
            autoComplete="nickname"
          />
          <button type="submit" disabled={!canJoin}>
            Join chat
          </button>
        </form>
      </div>
    </section>
  )
}

function JoinedBar({ name }: { name: string }) {
  return (
    <section className="joined-bar" aria-live="polite">
      <UserRound size={18} />
      <p>
        Chatting as <strong>{name}</strong>
        <span> · visible to everyone in this room</span>
      </p>
    </section>
  )
}

function Composer({
  enabled,
  onSend,
}: {
  enabled: boolean
  onSend: (payload: {
    text?: string
    fileName?: string
    audioUrl?: string
    durationSec?: number
  }) => void
}) {
  const [draft, setDraft] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordError, setRecordError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const shouldSendRef = useRef(false)
  const hasText = Boolean(draft.trim())

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  const resetRecordingState = () => {
    clearTimer()
    setRecording(false)
    setRecordSeconds(0)
    mediaRecorderRef.current = null
    chunksRef.current = []
    shouldSendRef.current = false
  }

  useEffect(() => {
    return () => {
      clearTimer()
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      stopStream()
    }
  }, [])

  const finishRecording = (send: boolean) => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      resetRecordingState()
      stopStream()
      return
    }
    shouldSendRef.current = send
    recorder.stop()
  }

  const startRecording = async () => {
    if (!enabled || recording) return
    setRecordError('')
    setShowEmojiPicker(false)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordError('Voice recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mimeType = pickAudioMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      mediaRecorderRef.current = recorder
      startedAtRef.current = Date.now()
      shouldSendRef.current = false

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const send = shouldSendRef.current
        const blobType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        stopStream()
        resetRecordingState()

        if (!send || blob.size === 0) return
        const audioUrl = URL.createObjectURL(blob)
        onSend({
          audioUrl,
          durationSec,
          text: 'Voice message',
        })
      }

      recorder.start(250)
      setRecording(true)
      setRecordSeconds(0)
      timerRef.current = window.setInterval(() => {
        setRecordSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)
    } catch {
      stopStream()
      resetRecordingState()
      setRecordError('Microphone access is needed to record voice messages.')
    }
  }

  const sendMessage = () => {
    if (!enabled || recording) return
    const text = draft.trim()
    if (!text) return
    onSend({ text })
    setDraft('')
    setShowEmojiPicker(false)
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (!enabled || recording) return
    const file = event.target.files?.[0]
    if (file) {
      onSend({ fileName: file.name, text: `Attached: ${file.name}` })
      event.target.value = ''
    }
  }

  if (recording) {
    return (
      <div className="composer recording-bar" role="status" aria-live="polite">
        <button
          type="button"
          className="composer-icon record-cancel"
          aria-label="Cancel recording"
          onClick={() => finishRecording(false)}
        >
          <Trash2 size={22} />
        </button>
        <div className="recording-status">
          <span className="recording-dot" />
          <span className="recording-timer">{formatDuration(recordSeconds)}</span>
          <span className="recording-label">Recording… tap send to share</span>
        </div>
        <button
          type="button"
          aria-label="Send voice message"
          className="send-button send-button-visible"
          onClick={() => finishRecording(true)}
        >
          <Send size={20} />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className={`quick-replies ${enabled ? '' : 'composer-disabled'}`} aria-label="Quick replies">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply.text}
            type="button"
            disabled={!enabled}
            onClick={() => onSend({ text: reply.text })}
          >
            {reply.label}
          </button>
        ))}
      </div>
      {recordError ? <p className="record-error">{recordError}</p> : null}
      <form
        className={`composer ${enabled ? '' : 'composer-disabled'}`}
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage()
        }}
      >
        <div className="composer-tool-wrap">
          <button
            type="button"
            aria-label="Add emoji"
            className="composer-icon"
            disabled={!enabled}
            onClick={() => setShowEmojiPicker((value) => !value)}
          >
            <Smile size={22} />
          </button>
          {showEmojiPicker && enabled && (
            <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
              <div className="emoji-picker-header">
                <span>Choose an emoji</span>
                <button
                  type="button"
                  aria-label="Close emoji picker"
                  onClick={() => setShowEmojiPicker(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="emoji-grid">
                {EMOJIS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => {
                      setDraft((current) => `${current}${emoji}`)
                      setShowEmojiPicker(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Attach image or file"
          className="composer-icon"
          disabled={!enabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={22} />
        </button>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFile}
          disabled={!enabled}
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={enabled ? 'Type a message' : 'Enter your name above to start chatting'}
          aria-label="Message"
          disabled={!enabled}
        />
        {hasText ? (
          <button
            type="submit"
            aria-label="Send message"
            className="send-button send-button-visible"
            disabled={!enabled}
          >
            <Send size={20} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Record voice message"
            className="mic-button"
            disabled={!enabled}
            onClick={() => {
              void startRecording()
            }}
          >
            <Mic size={21} />
          </button>
        )}
      </form>
    </>
  )
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [visitorName, setVisitorName] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const joined = Boolean(visitorName)
  const bottomRef = useRef<HTMLDivElement>(null)
  const replyTimers = useRef<number[]>([])

  useEffect(() => {
    setMessages(loadMessages())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveMessages(messages)
  }, [messages, hydrated])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, joined])

  useEffect(() => {
    return () => {
      replyTimers.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const updateStatus = (id: string, status: MessageStatus) => {
    setMessages((items) => items.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  const pushReply = (text: string, delay = 900) => {
    const timer = window.setTimeout(() => {
      setMessages((items) => [
        ...items,
        {
          id: `reply-${Date.now()}`,
          from: 'them',
          type: 'text',
          senderName: HUB_NAME,
          content: text,
          text,
          timestamp: formatTime(),
          createdAt: Date.now(),
        },
      ])
    }, delay)
    replyTimers.current.push(timer)
  }

  const handleJoin = (name: string) => {
    setVisitorName(name)
    setMessages((items) => [
      ...items,
      {
        id: `join-${Date.now()}`,
        from: 'system',
        type: 'system',
        content: `${name} joined the chat room`,
        timestamp: formatTime(),
        createdAt: Date.now(),
      },
    ])
    pushReply(`Welcome ${name}! How can we help you today?`, 700)
  }

  const handleSend = ({
    text,
    fileName,
    audioUrl,
    durationSec,
  }: {
    text?: string
    fileName?: string
    audioUrl?: string
    durationSec?: number
  }) => {
    if (!joined || (!text && !fileName && !audioUrl)) return

    const id = `me-${Date.now()}`
    const type = audioUrl ? 'voice' : fileName ? 'file' : 'text'
    const outgoing: ChatMessage = {
      id,
      from: 'me',
      type,
      senderName: visitorName,
      content: text ?? fileName ?? 'Voice message',
      text,
      fileName,
      audioUrl,
      durationSec,
      timestamp: formatTime(),
      status: 'sending',
      createdAt: Date.now(),
    }

    setMessages((items) => [...items, outgoing])

    window.setTimeout(() => updateStatus(id, 'sent'), 350)
    window.setTimeout(() => updateStatus(id, 'delivered'), 900)
    window.setTimeout(() => updateStatus(id, 'read'), 1600)

    const normalized = (text ?? '').trim().toLowerCase()
    const autoReply = AUTO_REPLIES[normalized]
    if (audioUrl) {
      pushReply(`${visitorName}, thanks for the voice message. We will listen and get back to you.`, 1600)
    } else if (autoReply) {
      pushReply(`${visitorName}, ${autoReply.charAt(0).toLowerCase()}${autoReply.slice(1)}`, 1800)
    } else if (fileName) {
      pushReply(`${visitorName}, got your file. Our team will review it shortly.`, 1600)
    } else if (text) {
      pushReply(
        `${visitorName}, thanks for your message. A Profit Online Hub agent will reply shortly.`,
        1800,
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="chat-window" aria-label="Chat with Profit Online Hub">
        <Header />
        {joined ? <JoinedBar name={visitorName} /> : null}
        <div className="chat-content">
          {!joined ? (
            <NameGate onJoin={handleJoin} />
          ) : (
            <div className="messages">
              <div className="day-separator" role="separator">
                <span>Today</span>
              </div>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <Composer enabled={joined} onSend={handleSend} />
      </section>
    </main>
  )
}
