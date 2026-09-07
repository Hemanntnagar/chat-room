'use client'

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  Check,
  Download,
  Mic,
  Paperclip,
  Pencil,
  Send,
  Smile,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Avatar, MessageBubble } from '@/components/message-bubble'
import {
  type AdminProfile,
  type ChatMessage,
  type Conversation,
  CUSTOMER_QUICK_REPLIES,
  HUB_NAME,
  formatTime,
} from '@/lib/chat-messages'
import {
  canEditCustomerName,
  createCustomerIdentity,
  loadCustomerIdentity,
  updateCustomerName,
  type CustomerIdentity,
} from '@/lib/customer-identity'
import { uploadChatFile } from '@/lib/upload-client'

const EMOJIS = ['🙂', '😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '🔥', '💬', '✅', '🤖']
const POLL_MS = 2000
const MAX_FILE_BYTES = 8 * 1024 * 1024

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

async function ensureConversationOnServer(identity: CustomerIdentity) {
  const response = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: identity.id,
      customerName: identity.name,
    }),
  })
  if (!response.ok) throw new Error('Failed to start chat')
  const data = (await response.json()) as { conversation: Conversation }
  return data.conversation
}

async function fetchConversation(customerId: string) {
  const response = await fetch(`/api/chats/${encodeURIComponent(customerId)}`, {
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Failed to load chat')
  const data = (await response.json()) as { conversation: Conversation }
  return data.conversation
}

async function postCustomerMessage(
  identity: CustomerIdentity,
  message: ChatMessage,
) {
  const response = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: identity.id,
      customerName: identity.name,
      message,
      fromAdmin: false,
    }),
  })
  if (!response.ok) throw new Error('Failed to send message')
  const data = (await response.json()) as { conversation: Conversation }
  return data.conversation
}

function Header({ profile }: { profile: AdminProfile }) {
  return (
    <header className="chat-header">
      <div className="header-profile">
        <div className="avatar-wrap">
          <Avatar name={profile.name} imageUrl={profile.imageUrl} />
          <span className="online-dot" />
        </div>
        <div>
          <h1>{profile.name}</h1>
          <p>online</p>
        </div>
      </div>
      <div className="header-actions">
        <span className="icon-button whatsapp-button" aria-hidden="true" title="WhatsApp">
          <img
            src="/whatsapp-icon.png"
            alt=""
            width={28}
            height={28}
            className="whatsapp-icon"
          />
        </span>
        <button className="save-chat-button" type="button" aria-label="Save chat">
          <Download size={22} />
          <span>Save Chat</span>
        </button>
      </div>
    </header>
  )
}

function JoinedBar({
  name,
  canEdit,
  onRename,
}: {
  name: string
  canEdit: boolean
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const startEditing = () => {
    if (!canEdit) return
    setDraft(name)
    setEditing(true)
  }

  const cancelEditing = () => {
    setDraft(name)
    setEditing(false)
  }

  const saveName = () => {
    const next = draft.trim()
    if (!next || next === name) {
      cancelEditing()
      return
    }
    onRename(next)
    setEditing(false)
  }

  return (
    <section className="joined-bar" aria-live="polite">
      <UserRound size={18} />
      {editing ? (
        <form
          className="joined-bar-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveName()
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
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelEditing()
            }}
            placeholder="Your name"
            autoComplete="nickname"
          />
          <button type="submit" aria-label="Save name" disabled={!draft.trim()}>
            <Check size={16} />
          </button>
          <button type="button" aria-label="Cancel rename" onClick={cancelEditing}>
            <X size={16} />
          </button>
        </form>
      ) : (
        <>
          <p>
            Chatting as <strong>{name}</strong>
          </p>
          {canEdit ? (
            <button
              type="button"
              className="joined-bar-edit"
              aria-label="Change name"
              onClick={startEditing}
            >
              <Pencil size={14} />
              <span>Change</span>
            </button>
          ) : null}
        </>
      )}
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
    fileUrl?: string
    mimeType?: string
    audioUrl?: string
    durationSec?: number
  }) => void
}) {
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
    if (!enabled || recording) return
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
      <div className={`quick-replies ${enabled ? '' : 'composer-disabled'}`} aria-label="Quick replies">
        {CUSTOMER_QUICK_REPLIES.map((reply) => (
          <button
            key={reply.id}
            type="button"
            disabled={!enabled}
            onClick={() => onSend({ text: reply.text })}
          >
            {reply.label}
          </button>
        ))}
      </div>
      {recordError ? <p className="record-error">{recordError}</p> : null}
      {attachError ? <p className="record-error">{attachError}</p> : null}
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
            onClick={() => {
              setShowEmojiPicker((value) => !value)
            }}
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
        <div className="composer-tool-wrap">
          <button
            type="button"
            aria-label="Attach file"
            className="composer-icon"
            disabled={!enabled}
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
          disabled={!enabled}
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={enabled ? 'Type a message' : 'Connecting…'}
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
  const [identity, setIdentity] = useState<CustomerIdentity | null>(null)
  const [hubProfile, setHubProfile] = useState<AdminProfile>({
    name: HUB_NAME,
    imageUrl: null,
  })
  const [hydrated, setHydrated] = useState(false)
  const [syncError, setSyncError] = useState('')
  const ready = Boolean(identity)
  const bottomRef = useRef<HTMLDivElement>(null)
  const identityRef = useRef<CustomerIdentity | null>(null)

  useEffect(() => {
    identityRef.current = identity
  }, [identity])

  useEffect(() => {
    let cancelled = false

    const loadHubProfile = async () => {
      try {
        const response = await fetch('/api/admin-profile', { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as { profile: AdminProfile }
        if (!cancelled && data.profile?.name) {
          setHubProfile({
            name: data.profile.name,
            imageUrl: data.profile.imageUrl ?? null,
          })
        }
      } catch {
        // keep defaults
      }
    }

    void loadHubProfile()
    const timer = window.setInterval(() => {
      void loadHubProfile()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const saved = loadCustomerIdentity() ?? createCustomerIdentity()

      try {
        const conversation =
          (await fetchConversation(saved.id)) ?? (await ensureConversationOnServer(saved))
        if (cancelled) return
        setIdentity(saved)
        setMessages(conversation.messages)
        setSyncError('')
      } catch {
        if (!cancelled) {
          setIdentity(saved)
          setSyncError('Could not start chat. Try refreshing.')
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!identity) return

    const poll = async () => {
      try {
        const conversation = await fetchConversation(identity.id)
        if (!conversation) return
        setMessages(conversation.messages)
        setSyncError('')
      } catch {
        setSyncError('Connection issue. Retrying…')
      }
    }

    const timer = window.setInterval(() => {
      void poll()
    }, POLL_MS)

    return () => window.clearInterval(timer)
  }, [identity])

  useEffect(() => {
    if (!hydrated || !ready) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, ready, hydrated])

  const handleRename = async (name: string) => {
    const current = identityRef.current
    if (!current) return
    const next = updateCustomerName(current, name)
    setIdentity(next)
    try {
      await ensureConversationOnServer(next)
      setSyncError('')
    } catch {
      setSyncError('Name saved locally, but server sync failed.')
    }
  }

  const handleSend = async ({
    text,
    fileName,
    fileUrl,
    mimeType,
    audioUrl,
    durationSec,
  }: {
    text?: string
    fileName?: string
    fileUrl?: string
    mimeType?: string
    audioUrl?: string
    durationSec?: number
  }) => {
    const current = identityRef.current
    if (!current || (!text && !fileName && !audioUrl && !fileUrl)) return

    const id = `me-${Date.now()}`
    const type = audioUrl ? 'voice' : fileName || fileUrl ? 'file' : 'text'
    const outgoing: ChatMessage = {
      id,
      from: 'me',
      type,
      senderName: current.name,
      content: text ?? fileName ?? 'Voice message',
      text,
      fileName,
      fileUrl,
      mimeType,
      audioUrl,
      durationSec,
      timestamp: formatTime(),
      status: 'sending',
      createdAt: Date.now(),
      customerId: current.id,
    }

    setMessages((items) => [...items, outgoing])

    try {
      const conversation = await postCustomerMessage(current, {
        ...outgoing,
        status: 'sent',
      })
      setMessages(conversation.messages)
      setSyncError('')
    } catch {
      setMessages((items) => items.filter((item) => item.id !== id))
      setSyncError('Message may not have reached admin. Check your connection.')
    }
  }

  return (
    <main className="app-shell">
      <section className="chat-window" aria-label={`Chat with ${hubProfile.name}`}>
        <Header profile={hubProfile} />
        {identity ? (
          <JoinedBar
            name={identity.name}
            canEdit={canEditCustomerName(identity)}
            onRename={(name) => void handleRename(name)}
          />
        ) : null}
        {syncError ? <p className="sync-error">{syncError}</p> : null}
        <div className="chat-content">
          {!hydrated ? (
            <div className="system-message" role="status">
              <span>Loading chat…</span>
            </div>
          ) : (
            <div className="messages">
              <div className="day-separator" role="separator">
                <span>Today</span>
              </div>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} hubProfile={hubProfile} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <Composer enabled={ready} onSend={(payload) => void handleSend(payload)} />
      </section>
    </main>
  )
}
