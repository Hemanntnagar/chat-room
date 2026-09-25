'use client'

import Link from 'next/link'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import {
  ArrowLeft,
  Bot,
  Camera,
  LogOut,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Send,
  Shield,
  Smile,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { MessageBubble, Avatar } from '@/components/message-bubble'
import {
  type AdminProfile,
  type AutoReplyConfig,
  type AutoReplyRule,
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
  ADMIN_PASSWORD,
  CUSTOMER_QUICK_REPLIES,
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

function AdminComposer({
  displayName,
  onSend,
}: {
  displayName: string
  onSend: (payload: AdminSendPayload) => void
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
          placeholder={`Reply as ${displayName}…`}
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

async function persistAdminProfile(name: string, imageUrl: string | null) {
  const response = await fetch('/api/admin-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, imageUrl }),
  })
  if (!response.ok) throw new Error('save failed')
  const data = (await response.json()) as { profile: AdminProfile }
  return data.profile
}

function isImageFile(file: File) {
  if (file.type.startsWith('image/')) return true
  // Some OS/browsers leave type empty for local photos.
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(file.name)
}

function AdminProfilePanel({
  profile,
  onSave,
  onClose,
}: {
  profile: AdminProfile
  onSave: (profile: AdminProfile) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(profile.name)
  const [imageUrl, setImageUrl] = useState<string | null>(profile.imageUrl)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadingRef = useRef(false)

  useEffect(() => {
    // Don't clobber an in-progress local preview / upload.
    if (uploadingRef.current) return
    setDraft(profile.name)
    setImageUrl(profile.imageUrl)
    setError('')
  }, [profile.name, profile.imageUrl])

  const saveProfile = async (nextName: string, nextImageUrl: string | null, closeAfter: boolean) => {
    const name = nextName.trim()
    if (!name) {
      setError('Enter a display name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = await persistAdminProfile(name, nextImageUrl)
      setDraft(saved.name)
      setImageUrl(saved.imageUrl)
      onSave(saved)
      if (closeAfter) onClose()
    } catch {
      setError('Could not save profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || uploadingRef.current) {
      input.value = ''
      return
    }

    if (!isImageFile(file)) {
      input.value = ''
      setError('Please choose an image file (JPG, PNG, WebP, etc.).')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      input.value = ''
      setError('Photo is too large. Please keep it under 8 MB.')
      return
    }

    const nameForSave = draft.trim() || profile.name || HUB_NAME
    const localPreview = URL.createObjectURL(file)
    setImageUrl(localPreview)
    uploadingRef.current = true
    setUploading(true)
    setError('')

    void uploadChatFile(file)
      .then(async (uploaded) => {
        const saved = await persistAdminProfile(nameForSave, uploaded.fileUrl)
        URL.revokeObjectURL(localPreview)
        setDraft(saved.name)
        setImageUrl(saved.imageUrl)
        onSave(saved)
      })
      .catch((uploadError: unknown) => {
        URL.revokeObjectURL(localPreview)
        setImageUrl(profile.imageUrl)
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : 'Could not upload that image. Try another file.',
        )
      })
      .finally(() => {
        // Reset after upload so the same file can be chosen again.
        input.value = ''
        uploadingRef.current = false
        setUploading(false)
      })
  }

  const handleRemovePhoto = () => {
    const nameForSave = draft.trim() || profile.name || HUB_NAME
    setImageUrl(null)
    setError('')
    void saveProfile(nameForSave, null, false)
  }

  const initial = (draft.trim() || profile.name || '?').slice(0, 1).toUpperCase()
  const busy = uploading || saving
  const photoLabel = imageUrl ? 'Change profile photo' : 'Add profile photo from computer'
  const photoAccept =
    'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.avif'

  return (
    <div className="admin-profile-overlay" role="presentation" onClick={onClose}>
      <section
        className="admin-profile-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-profile-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-profile-header">
          <div>
            <h2 id="admin-profile-title">Admin profile</h2>
            <p>Name and photo are shown to customers in their chat.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close profile" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="admin-profile-photo-wrap">
          {/*
            File input overlays the click target (opacity 0). Users click the real
            <input type="file">, which browsers always allow — unlike programmatic .click()
            on a 1px clipped input, or clearing value in an onClick handler.
          */}
          <div className={`admin-profile-avatar-button${busy ? ' is-busy' : ''}`}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="admin-profile-avatar admin-profile-avatar-photo" />
            ) : (
              <span className="admin-profile-avatar" aria-hidden="true">
                {initial}
              </span>
            )}
            <span className="admin-profile-avatar-camera" aria-hidden="true">
              <Camera size={16} />
            </span>
            <input
              className="admin-profile-file-overlay"
              type="file"
              accept={photoAccept}
              disabled={busy}
              aria-label={photoLabel}
              onChange={handleImage}
            />
          </div>
          <div className="admin-profile-photo-actions">
            <div className={`admin-profile-secondary admin-profile-photo-pick${busy ? ' is-busy' : ''}`}>
              <Camera size={16} aria-hidden="true" />
              <span>{uploading ? 'Uploading…' : imageUrl ? 'Change photo' : 'Add photo'}</span>
              <input
                className="admin-profile-file-overlay"
                type="file"
                accept={photoAccept}
                disabled={busy}
                aria-label={photoLabel}
                onChange={handleImage}
              />
            </div>
            {imageUrl ? (
              <button
                type="button"
                className="admin-profile-secondary"
                disabled={busy}
                onClick={handleRemovePhoto}
              >
                Remove
              </button>
            ) : null}
          </div>
          {error ? <p className="admin-error">{error}</p> : null}
          <p className="admin-profile-photo-hint">
            Pick a photo from your computer. It saves automatically and appears in every chat.
          </p>
        </div>

        <form
          className="admin-profile-form"
          onSubmit={(event) => {
            event.preventDefault()
            void saveProfile(draft, imageUrl?.startsWith('blob:') ? profile.imageUrl : imageUrl, true)
          }}
        >
          <label htmlFor="admin-display-name">Display name</label>
          <input
            id="admin-display-name"
            value={draft}
            autoFocus
            maxLength={48}
            autoComplete="nickname"
            placeholder={HUB_NAME}
            onChange={(event) => {
              setDraft(event.target.value)
              setError('')
            }}
          />
          <div className="admin-profile-actions">
            <button type="button" className="admin-profile-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function emptyAutoReplyRules(): AutoReplyRule[] {
  return CUSTOMER_QUICK_REPLIES.map((item) => ({
    triggerId: item.id,
    label: item.label,
    triggerText: item.text,
    replies: [''],
    enabled: false,
  }))
}

function newAutoReplyRule(): AutoReplyRule {
  return {
    triggerId: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    triggerText: '',
    replies: [''],
    enabled: false,
  }
}

function withRuleDefaults(rule: AutoReplyRule): AutoReplyRule {
  return {
    ...rule,
    label: rule.label ?? '',
    triggerText: rule.triggerText ?? '',
    replies: rule.replies?.length ? rule.replies : [''],
  }
}

function AdminAutoReplyPanel({
  senderName,
  onClose,
}: {
  senderName: string
  onClose: () => void
}) {
  const [rules, setRules] = useState<AutoReplyRule[]>(emptyAutoReplyRules)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetch('/api/auto-replies', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load')
        const data = (await response.json()) as { config: AutoReplyConfig }
        if (!cancelled) {
          setRules(data.config.rules.map(withRuleDefaults))
          setError('')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load auto-replies.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateRule = (triggerId: string, patch: Partial<AutoReplyRule>) => {
    setRules((current) =>
      current.map((rule) => (rule.triggerId === triggerId ? { ...rule, ...patch } : rule)),
    )
    setSavedNote('')
  }

  const updateReplyText = (triggerId: string, index: number, text: string) => {
    setRules((current) =>
      current.map((rule) => {
        if (rule.triggerId !== triggerId) return rule
        const replies = rule.replies.map((reply, replyIndex) =>
          replyIndex === index ? text : reply,
        )
        const hasContent = replies.some((reply) => reply.trim())
        return {
          ...rule,
          replies,
          enabled: Boolean(hasContent && rule.triggerText.trim()),
        }
      }),
    )
    setSavedNote('')
  }

  const addBotReply = (triggerId: string) => {
    setRules((current) =>
      current.map((rule) =>
        rule.triggerId === triggerId
          ? { ...rule, replies: [...rule.replies, ''] }
          : rule,
      ),
    )
    setSavedNote('')
  }

  const removeBotReply = (triggerId: string, index: number) => {
    setRules((current) =>
      current.map((rule) => {
        if (rule.triggerId !== triggerId) return rule
        const replies =
          rule.replies.length <= 1
            ? ['']
            : rule.replies.filter((_, replyIndex) => replyIndex !== index)
        return {
          ...rule,
          replies,
          enabled: Boolean(
            rule.enabled &&
              replies.some((reply) => reply.trim()) &&
              rule.triggerText.trim(),
          ),
        }
      }),
    )
    setSavedNote('')
  }

  const addMessagePair = () => {
    setRules((current) => [...current, newAutoReplyRule()])
    setSavedNote('')
  }

  const removeRule = (triggerId: string) => {
    const isDefault = CUSTOMER_QUICK_REPLIES.some((item) => item.id === triggerId)
    if (isDefault) return
    setRules((current) => current.filter((rule) => rule.triggerId !== triggerId))
    setSavedNote('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSavedNote('')
    try {
      const response = await fetch('/api/auto-replies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName,
          rules: rules.map((rule) => {
            const triggerText = rule.triggerText.trim()
            const replies = rule.replies.map((reply) => reply.trim()).filter(Boolean)
            const label = rule.label.trim() || triggerText
            return {
              ...rule,
              label,
              triggerText,
              replies: replies.length > 0 ? replies : [''],
              enabled: Boolean(rule.enabled && triggerText && replies.length > 0),
            }
          }),
        }),
      })
      if (!response.ok) throw new Error('save failed')
      const data = (await response.json()) as { config: AutoReplyConfig }
      setRules(data.config.rules.map(withRuleDefaults))
      setSavedNote('Auto-replies saved.')
    } catch {
      setError('Could not save auto-replies. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-profile-overlay" role="presentation" onClick={onClose}>
      <section
        className="admin-profile-panel admin-auto-reply-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-auto-reply-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-profile-header">
          <div>
            <h2 id="admin-auto-reply-title">Auto replies</h2>
            <p>
              Edit the customer message and bot reply for each option. Add a new message to
              create another customer message + auto reply pair.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close auto replies"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="admin-auto-reply-status">Loading…</p>
        ) : (
          <div className="admin-auto-reply-list">
            {rules.map((rule) => {
              const hasContent =
                Boolean(rule.triggerText.trim()) &&
                rule.replies.some((reply) => reply.trim())
              const isDefault = CUSTOMER_QUICK_REPLIES.some(
                (item) => item.id === rule.triggerId,
              )
              return (
                <div key={rule.triggerId} className="admin-auto-reply-card">
                  <div className="admin-auto-reply-card-top">
                    <strong>{rule.label.trim() || 'New message'}</strong>
                    <div className="admin-auto-reply-card-actions">
                      {!isDefault ? (
                        <button
                          type="button"
                          className="admin-auto-reply-remove"
                          onClick={() => removeRule(rule.triggerId)}
                        >
                          Delete
                        </button>
                      ) : null}
                      <label className="admin-auto-reply-toggle">
                        <input
                          type="checkbox"
                          checked={rule.enabled && hasContent}
                          disabled={!hasContent}
                          onChange={(event) => {
                            updateRule(rule.triggerId, { enabled: event.target.checked })
                          }}
                        />
                        On
                      </label>
                    </div>
                  </div>

                  <label className="admin-auto-reply-field">
                    <span>Button label</span>
                    <input
                      type="text"
                      value={rule.label}
                      placeholder="🤖 🆔 I Need ID."
                      onChange={(event) => {
                        updateRule(rule.triggerId, { label: event.target.value })
                      }}
                    />
                  </label>

                  <label className="admin-auto-reply-field">
                    <span>Customer message</span>
                    <input
                      type="text"
                      value={rule.triggerText}
                      placeholder="I Need ID."
                      onChange={(event) => {
                        const triggerText = event.target.value
                        const repliesHaveContent = rule.replies.some((reply) => reply.trim())
                        updateRule(rule.triggerId, {
                          triggerText,
                          enabled: Boolean(triggerText.trim() && repliesHaveContent),
                        })
                      }}
                    />
                  </label>

                  <div className="admin-auto-reply-messages">
                    {rule.replies.map((reply, index) => (
                      <div
                        key={`${rule.triggerId}-reply-${index}`}
                        className="admin-auto-reply-message"
                      >
                        <div className="admin-auto-reply-message-head">
                          <span>Auto reply {index + 1}</span>
                          {rule.replies.length > 1 ? (
                            <button
                              type="button"
                              className="admin-auto-reply-remove"
                              aria-label={`Remove auto reply ${index + 1}`}
                              onClick={() => removeBotReply(rule.triggerId, index)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <label className="sr-only" htmlFor={`auto-reply-${rule.triggerId}-${index}`}>
                          Auto reply {index + 1}
                        </label>
                        <textarea
                          id={`auto-reply-${rule.triggerId}-${index}`}
                          rows={3}
                          value={reply}
                          placeholder="Write the bot reply…"
                          onChange={(event) => {
                            updateReplyText(rule.triggerId, index, event.target.value)
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="admin-auto-reply-add admin-auto-reply-add-secondary"
                      onClick={() => addBotReply(rule.triggerId)}
                    >
                      Add another auto reply
                    </button>
                  </div>
                </div>
              )
            })}

            <button type="button" className="admin-auto-reply-add" onClick={addMessagePair}>
              Add message
            </button>
          </div>
        )}

        {error ? <p className="admin-error">{error}</p> : null}
        {savedNote ? <p className="admin-auto-reply-saved">{savedNote}</p> : null}

        <div className="admin-profile-actions">
          <button type="button" className="admin-profile-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" disabled={loading || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save auto replies'}
          </button>
        </div>
      </section>
    </div>
  )
}

const MOBILE_INBOX_MQ = '(max-width: 860px)'
const SWIPE_BACK_RATIO = 0.28
const SWIPE_BACK_PX = 72
const SWIPE_BACK_VELOCITY = 0.45
const PANEL_EXIT_MS = 280

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [hubProfile, setHubProfile] = useState<AdminProfile>({
    name: HUB_NAME,
    imageUrl: null,
  })
  const [showProfile, setShowProfile] = useState(false)
  const [showAutoReplies, setShowAutoReplies] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [active, setActive] = useState<Conversation | null>(null)
  const [error, setError] = useState('')
  const [swipeX, setSwipeX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [panelExiting, setPanelExiting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef<string | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const swipeXRef = useRef(0)
  const touchRef = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    tracking: false,
    locked: false as false | 'h' | 'v',
  })

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const media = window.matchMedia(MOBILE_INBOX_MQ)
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
      }
    }
  }, [])

  // Non-passive touchmove so horizontal swipe can prevent vertical scroll.
  useEffect(() => {
    const node = threadRef.current
    if (!node || !isMobile || !selectedId) return

    const onMove = (event: TouchEvent) => {
      const state = touchRef.current
      if (!state.tracking || panelExiting) return

      const touch = event.touches[0]
      const dx = touch.clientX - state.startX
      const dy = touch.clientY - state.startY
      const now = Date.now()
      const dt = Math.max(1, now - state.lastTime)
      state.velocity = (touch.clientX - state.lastX) / dt
      state.lastX = touch.clientX
      state.lastTime = now

      if (!state.locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        state.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        if (state.locked === 'v') {
          state.tracking = false
          swipeXRef.current = 0
          setIsDragging(false)
          setSwipeX(0)
          return
        }
        setIsDragging(true)
      }

      if (state.locked !== 'h') return
      event.preventDefault()
      const next = Math.max(0, dx)
      swipeXRef.current = next
      setSwipeX(next)
    }

    node.addEventListener('touchmove', onMove, { passive: false })
    return () => node.removeEventListener('touchmove', onMove)
  }, [isMobile, selectedId, panelExiting])

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

  const openConversation = (customerId: string) => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    setPanelExiting(false)
    swipeXRef.current = 0
    setSwipeX(0)
    setIsDragging(false)
    setSelectedId(customerId)
  }

  const finishBackToList = () => {
    setSelectedId(null)
    setActive(null)
    setPanelExiting(false)
    swipeXRef.current = 0
    setSwipeX(0)
    setIsDragging(false)
  }

  const backToList = () => {
    if (!isMobile) {
      finishBackToList()
      return
    }
    if (panelExiting) return
    setIsDragging(false)
    swipeXRef.current = 0
    setSwipeX(0)
    setPanelExiting(true)
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
    }
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null
      finishBackToList()
    }, PANEL_EXIT_MS)
  }

  const onThreadTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isMobile || panelExiting || !selectedId) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, button, a, .composer, .emoji-picker')) return

    const touch = event.touches[0]
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastTime: Date.now(),
      velocity: 0,
      tracking: true,
      locked: false,
    }
  }

  const onThreadTouchEnd = () => {
    const state = touchRef.current
    const offset = swipeXRef.current
    const wasHorizontal = state.locked === 'h' || isDragging

    if (!state.tracking && !wasHorizontal) {
      touchRef.current.tracking = false
      touchRef.current.locked = false
      return
    }

    const width = typeof window !== 'undefined' ? window.innerWidth : 360
    const shouldClose =
      wasHorizontal &&
      (offset > Math.max(SWIPE_BACK_PX, width * SWIPE_BACK_RATIO) ||
        (offset > 40 && state.velocity > SWIPE_BACK_VELOCITY))

    touchRef.current.tracking = false
    touchRef.current.locked = false
    setIsDragging(false)

    if (shouldClose) {
      backToList()
      return
    }
    swipeXRef.current = 0
    setSwipeX(0)
  }

  useEffect(() => {
    setAuthed(isAdminAuthenticated())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!authed) return
    let cancelled = false
    void fetch(`/api/admin-profile?t=${Date.now()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load profile')
        const data = (await response.json()) as { profile: AdminProfile }
        if (!cancelled && data.profile) {
          setHubProfile({
            name: data.profile.name?.trim() || HUB_NAME,
            imageUrl: data.profile.imageUrl ?? null,
          })
        }
      })
      .catch(() => {
        // keep defaults
      })
    return () => {
      cancelled = true
    }
  }, [authed])

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

        // Desktop: open the first chat. Mobile: stay on the list until tapped.
        const mobile = window.matchMedia(MOBILE_INBOX_MQ).matches
        if (!mobile && list.length > 0) {
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
      senderName: hubProfile.name,
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

  const mobileShowingThread = isMobile && Boolean(selectedId)
  const threadStyle: CSSProperties | undefined =
    isMobile && mobileShowingThread
      ? {
          transform: panelExiting
            ? 'translate3d(100%, 0, 0)'
            : `translate3d(${swipeX}px, 0, 0)`,
        }
      : undefined

  return (
    <main className="admin-inbox-shell">
      {showProfile ? (
        <AdminProfilePanel
          profile={hubProfile}
          onClose={() => setShowProfile(false)}
          onSave={(profile) => {
            setHubProfile(profile)
          }}
        />
      ) : null}
      {showAutoReplies ? (
        <AdminAutoReplyPanel
          senderName={hubProfile.name}
          onClose={() => setShowAutoReplies(false)}
        />
      ) : null}
      <section
        className={`admin-inbox ${isMobile ? (mobileShowingThread ? 'admin-inbox-mobile-thread' : 'admin-inbox-mobile-list') : ''}`}
        aria-label="Admin customer inbox"
      >
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <div className="admin-sidebar-title-row">
              <button
                type="button"
                className="admin-sidebar-profile"
                aria-label="Admin profile"
                onClick={() => setShowProfile(true)}
              >
                <Avatar name={hubProfile.name} imageUrl={hubProfile.imageUrl} small />
              </button>
              <div>
                <h1>Customer chats</h1>
                <p>
                  {conversations.length} customer{conversations.length === 1 ? '' : 's'}
                  <span className="admin-sidebar-as"> · {hubProfile.name}</span>
                </p>
              </div>
            </div>
            <div className="admin-sidebar-actions">
              <button
                type="button"
                className="icon-button"
                aria-label="Auto replies"
                onClick={() => setShowAutoReplies(true)}
              >
                <Bot size={18} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Admin profile"
                onClick={() => setShowProfile(true)}
              >
                <UserRound size={18} />
              </button>
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
                    onClick={() => openConversation(item.customerId)}
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

        <div
          ref={threadRef}
          className={`admin-thread${isDragging ? ' admin-thread-dragging' : ''}${panelExiting ? ' admin-thread-exiting' : ''}`}
          style={threadStyle}
          onTouchStart={onThreadTouchStart}
          onTouchEnd={onThreadTouchEnd}
          onTouchCancel={onThreadTouchEnd}
        >
          {!active ? (
            <div className="admin-thread-empty">
              <MessageSquare size={36} />
              <h2>{selectedId ? 'Opening chat…' : 'Select a customer'}</h2>
              <p>
                {selectedId
                  ? 'Loading messages for this customer.'
                  : 'Choose a chat from the list to view messages and reply.'}
              </p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="header-profile">
                  {isMobile ? (
                    <button
                      type="button"
                      className="admin-back-button"
                      aria-label="Back to chats"
                      onClick={backToList}
                    >
                      <ArrowLeft size={22} />
                    </button>
                  ) : null}
                  <div className="avatar-wrap">
                    <Avatar name={hubProfile.name} imageUrl={hubProfile.imageUrl} />
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
                  Replying as <strong>{hubProfile.name}</strong>
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
                    <MessageBubble
                      key={message.id}
                      message={message}
                      perspective="admin"
                      hubProfile={hubProfile}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>

              <AdminComposer
                displayName={hubProfile.name}
                onSend={(payload) => void handleSend(payload)}
              />
            </>
          )}
        </div>
      </section>
    </main>
  )
}
