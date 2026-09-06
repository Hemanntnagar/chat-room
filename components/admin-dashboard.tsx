'use client'

import Link from 'next/link'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  ArrowLeft,
  LogOut,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Send,
  Shield,
  Smile,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { MessageBubble, Avatar } from '@/components/message-bubble'
import {
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
  ADMIN_PASSWORD,
  HUB_NAME,
  formatTime,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from '@/lib/chat-messages'
import { uploadChatFile } from '@/lib/upload-client'

const POLL_MS = 2000
const EMOJIS = ['🙂', '😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '🔥', '💬', '✅', '🤖']
const MAX_FILE_BYTES = 8 * 1024 * 1024

type AdminSendPayload = {
  text?: string
  fileName?: string
  fileUrl?: string
  mimeType?: string
  audioUrl?: string
  durationSec?: number
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

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  return (
    <main className="admin-shell">
      <section className="admin-login-card" aria-label="Admin login">
        <div className="admin-login-icon">
          <Shield size={28} />
        </div>
        <h1>Admin Dashboard</h1>
        <p>Sign in to view customer chats and reply live.</p>
        <form
          className="admin-login-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (password === ADMIN_PASSWORD) {
              setAdminAuthenticated(true)
              onSuccess()
              return
            }
            setError('Incorrect password. Try again.')
          }}
        >
          <label htmlFor="admin-password" className="sr-only">
            Admin password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            placeholder="Admin password"
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
          />
          {error ? <p className="admin-error">{error}</p> : null}
          <button type="submit">Sign in</button>
        </form>
        <p className="admin-hint">
          Demo password: <code>admin</code>
        </p>
        <Link href="/" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to chat
        </Link>
      </section>
    </main>
  )
}

function AdminComposer({ onSend }: { onSend: (payload: AdminSendPayload) => void }) {
  const [draft, setDraft] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordError, setRecordError] = useState('')
  const [attachError, setAttachError] = useState('')
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
    if (recording) return
    setRecordError('')
    setAttachError('')
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
        void blobToDataUrl(blob).then((audioUrl) => {
          onSend({
            audioUrl,
            durationSec,
            text: 'Voice message',
          })
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
    if (recording) return
    const text = draft.trim()
    if (!text) return
    onSend({ text })
    setDraft('')
    setShowEmojiPicker(false)
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (recording) return
    const file = event.target.files?.[0]
    event.target.value = ''
    setAttachError('')
    if (!file) return

    if (file.size > MAX_FILE_BYTES) {
      setAttachError('File is too large. Please keep attachments under 8 MB.')
      return
    }

    void uploadChatFile(file)
      .then((uploaded) => {
        onSend({
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          mimeType: uploaded.mimeType,
          text: uploaded.fileName,
        })
      })
      .catch((error: unknown) => {
        setAttachError(
          error instanceof Error ? error.message : 'Could not upload that file. Try another file.',
        )
      })
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
      {recordError ? <p className="record-error">{recordError}</p> : null}
      {attachError ? <p className="record-error">{attachError}</p> : null}
      <form
        className="composer"
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
            onClick={() => {
              setShowEmojiPicker((value) => !value)
            }}
          >
            <Smile size={22} />
          </button>
          {showEmojiPicker ? (
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
          ) : null}
        </div>
        <div className="composer-tool-wrap">
          <button
            type="button"
            aria-label="Attach file"
            className="composer-icon"
            onClick={() => {
              setShowEmojiPicker(false)
              fileInputRef.current?.click()
            }}
          >
            <Paperclip size={22} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          onChange={handleFile}
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Reply as Profit Online Hub…"
          aria-label="Admin reply"
          autoFocus
        />
        {hasText ? (
          <button
            type="submit"
            aria-label="Send reply"
            className="send-button send-button-visible"
          >
            <Send size={20} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Record voice message"
            className="mic-button"
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

function formatRelative(updatedAt: number) {
  const diff = Date.now() - updatedAt
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(updatedAt).toLocaleDateString()
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [active, setActive] = useState<Conversation | null>(null)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const loadList = async () => {
    const response = await fetch('/api/chats', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load customers')
    const data = (await response.json()) as { conversations: ConversationSummary[] }
    setConversations(data.conversations)
    return data.conversations
  }

  const loadConversation = async (customerId: string, markRead = false) => {
    const response = await fetch(`/api/chats/${encodeURIComponent(customerId)}`, {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Failed to load chat')
    const data = (await response.json()) as { conversation: Conversation }
    setActive(data.conversation)

    if (markRead && data.conversation.unreadByAdmin > 0) {
      await fetch(`/api/chats/${encodeURIComponent(customerId)}`, { method: 'PATCH' })
      await loadList()
    }

    return data.conversation
  }

  useEffect(() => {
    setAuthed(isAdminAuthenticated())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!authed) return

    let cancelled = false

    const refresh = async () => {
      try {
        const list = await loadList()
        if (cancelled) return
        setError('')

        const currentId = selectedIdRef.current
        if (currentId) {
          await loadConversation(currentId)
          return
        }

        if (list.length > 0) {
          setSelectedId(list[0].customerId)
        }
      } catch {
        if (!cancelled) setError('Could not load customer chats.')
      }
    }

    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [authed])

  useEffect(() => {
    if (!authed || !selectedId) return
    void loadConversation(selectedId, true).catch(() => {
      setError('Could not open this customer chat.')
    })
  }, [authed, selectedId])

  useEffect(() => {
    if (!authed || !active) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages.length, authed, active])

  const handleSend = async ({
    text,
    fileName,
    fileUrl,
    mimeType,
    audioUrl,
    durationSec,
  }: AdminSendPayload) => {
    if (!active || (!text && !fileName && !audioUrl && !fileUrl)) return

    const type = audioUrl ? 'voice' : fileName || fileUrl ? 'file' : 'text'
    const message: ChatMessage = {
      id: `admin-${Date.now()}`,
      from: 'them',
      type,
      senderName: HUB_NAME,
      content: text ?? fileName ?? 'Voice message',
      text,
      fileName,
      fileUrl,
      mimeType,
      audioUrl,
      durationSec,
      timestamp: formatTime(),
      createdAt: Date.now(),
      status: 'sent',
      customerId: active.customerId,
    }

    const previous = active
    setActive({
      ...active,
      messages: [...active.messages, message],
      updatedAt: message.createdAt,
    })

    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: active.customerId,
          customerName: active.customerName,
          message,
          fromAdmin: true,
        }),
      })
      if (!response.ok) throw new Error('send failed')
      const data = (await response.json()) as { conversation: Conversation }
      setActive(data.conversation)
      await loadList()
      setError('')
    } catch {
      setActive(previous)
      setError('Reply failed to send. Try again.')
    }
  }

  const handleClear = async () => {
    if (!active) return
    if (!window.confirm(`Reset chat with ${active.customerName}?`)) return
    const response = await fetch(`/api/chats/${encodeURIComponent(active.customerId)}`, {
      method: 'PUT',
    })
    if (!response.ok) {
      setError('Could not reset chat.')
      return
    }
    const data = (await response.json()) as { conversation: Conversation }
    setActive(data.conversation)
    await loadList()
  }

  if (!ready) {
    return <main className="admin-shell admin-loading">Loading…</main>
  }

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />
  }

  return (
    <main className="admin-inbox-shell">
      <section className="admin-inbox" aria-label="Admin customer inbox">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <div>
              <h1>Customer chats</h1>
              <p>
                {conversations.length} customer{conversations.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="admin-sidebar-actions">
              <button
                type="button"
                className="icon-button"
                aria-label="Refresh"
                onClick={() => {
                  void loadList().catch(() => setError('Refresh failed.'))
                }}
              >
                <RefreshCw size={18} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Sign out"
                onClick={() => {
                  setAdminAuthenticated(false)
                  setAuthed(false)
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div className="admin-customer-list" role="list" aria-label="Customers">
            {conversations.length === 0 ? (
              <div className="admin-empty-list">
                <Users size={28} />
                <p>No customers yet</p>
                <span>When a visitor joins the chat, they appear here.</span>
              </div>
            ) : (
              conversations.map((item) => {
                const selected = item.customerId === selectedId
                return (
                  <button
                    key={item.customerId}
                    type="button"
                    role="listitem"
                    className={`admin-customer-item ${selected ? 'admin-customer-item-active' : ''}`}
                    onClick={() => setSelectedId(item.customerId)}
                  >
                    <div className="admin-customer-avatar" aria-hidden="true">
                      {(item.customerName || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="admin-customer-meta">
                      <div className="admin-customer-top">
                        <strong>{item.customerName || 'Guest'}</strong>
                        <time>{formatRelative(item.updatedAt)}</time>
                      </div>
                      <div className="admin-customer-bottom">
                        <span>{item.lastMessage}</span>
                        {item.unreadByAdmin > 0 ? (
                          <em className="admin-unread">{item.unreadByAdmin}</em>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <Link href="/" className="admin-sidebar-footer">
            <ArrowLeft size={16} />
            Open visitor chat
          </Link>
        </aside>

        <div className="admin-thread">
          {!active ? (
            <div className="admin-thread-empty">
              <MessageSquare size={36} />
              <h2>Select a customer</h2>
              <p>Choose a chat from the left to view messages and reply.</p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="header-profile">
                  <div className="avatar-wrap">
                    <Avatar />
                    <span className="online-dot" />
                  </div>
                  <div>
                    <h1>{active.customerName}</h1>
                    <p>
                      {active.messages.length} message
                      {active.messages.length === 1 ? '' : 's'} · live reply
                    </p>
                  </div>
                </div>
                <div className="header-actions admin-chat-actions">
                  <button
                    type="button"
                    className="save-chat-button"
                    aria-label="Clear chat"
                    onClick={() => {
                      void handleClear()
                    }}
                  >
                    <Trash2 size={18} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div className="joined-bar">
                <Shield size={18} />
                <p>
                  Replying as <strong>{HUB_NAME}</strong>
                  <span> · customer sees your reply in their chat</span>
                </p>
              </div>

              {error ? <p className="sync-error">{error}</p> : null}

              <div className="chat-content">
                <div className="messages">
                  <div className="day-separator" role="separator">
                    <span>Customer conversation</span>
                  </div>
                  {active.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} perspective="admin" />
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>

              <AdminComposer onSend={(payload) => void handleSend(payload)} />
            </>
          )}
        </div>
      </section>
    </main>
  )
}
