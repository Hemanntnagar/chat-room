'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import {
  ArrowLeft,
  LogOut,
  MessageSquare,
  Send,
  Shield,
  UserRound,
  Users,
} from 'lucide-react'
import { ComposerTextarea } from '@/components/composer-textarea'
import { Avatar, MessageBubble } from '@/components/message-bubble'
import {
  type AdminProfile,
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
  HUB_NAME,
  formatTime,
  getStaffSessionId,
  setStaffSession,
} from '@/lib/chat-messages'

const POLL_MS = 2000
const MOBILE_INBOX_MQ = '(max-width: 860px)'
const SWIPE_BACK_RATIO = 0.28
const SWIPE_BACK_PX = 72
const SWIPE_BACK_VELOCITY = 0.45
const PANEL_EXIT_MS = 280

type StaffInfo = {
  id: string
  name: string
}

function formatRelative(updatedAt: number) {
  const diff = Date.now() - updatedAt
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(updatedAt).toLocaleDateString()
}

function StaffLogin({ onSuccess }: { onSuccess: (staff: StaffInfo) => void }) {
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <main className="admin-shell">
      <section className="admin-login-card" aria-label="Staff login">
        <div className="admin-login-icon">
          <UserRound size={28} />
        </div>
        <h1>Staff chat</h1>
        <p>Sign in with your staff id to view all chats assigned to you.</p>
        <form
          className="admin-login-form"
          onSubmit={(event) => {
            event.preventDefault()
            setLoading(true)
            setError('')
            void fetch('/api/staff/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: staffId, password }),
            })
              .then(async (response) => {
                const data = (await response.json()) as { staff?: StaffInfo; error?: string }
                if (!response.ok || !data.staff) {
                  setError(data.error ?? 'Login failed.')
                  return
                }
                setStaffSession(data.staff.id)
                onSuccess(data.staff)
              })
              .catch(() => setError('Could not sign in. Try again.'))
              .finally(() => setLoading(false))
          }}
        >
          <label htmlFor="staff-id" className="sr-only">
            Staff id
          </label>
          <input
            id="staff-id"
            type="text"
            value={staffId}
            autoFocus
            autoComplete="username"
            placeholder="Staff id"
            onChange={(event) => {
              setStaffId(event.target.value)
              setError('')
            }}
          />
          <label htmlFor="staff-password" className="sr-only">
            Password
          </label>
          <input
            id="staff-password"
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder="Password"
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
          />
          {error ? <p className="admin-error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default function StaffPortal() {
  const [ready, setReady] = useState(false)
  const [staff, setStaff] = useState<StaffInfo | null>(null)
  const [hubProfile, setHubProfile] = useState<AdminProfile>({ name: HUB_NAME, imageUrl: null })
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [active, setActive] = useState<Conversation | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)
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

  const loadHubProfile = async () => {
    const response = await fetch(`/api/admin-profile?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return
    const data = (await response.json()) as { profile: AdminProfile }
    if (data.profile) {
      setHubProfile({
        name: data.profile.name?.trim() || HUB_NAME,
        imageUrl: data.profile.imageUrl ?? null,
      })
    }
  }

  const loadStaffProfile = async (staffId: string) => {
    const response = await fetch(`/api/staff/${encodeURIComponent(staffId)}`, { cache: 'no-store' })
    if (!response.ok) return
    const data = (await response.json()) as { staff: StaffInfo }
    if (data.staff) setStaff(data.staff)
  }

  const loadList = async (staffId: string) => {
    const response = await fetch(`/api/staff/${encodeURIComponent(staffId)}/chats`, {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Failed to load chats')
    const data = (await response.json()) as {
      conversations: ConversationSummary[]
      staff: StaffInfo
    }
    setStaff(data.staff)
    setConversations(data.conversations)
    return data.conversations
  }

  const loadConversation = async (staffId: string, customerId: string, markRead = false) => {
    const response = await fetch(
      `/api/staff/${encodeURIComponent(staffId)}/chats/${encodeURIComponent(customerId)}`,
      { cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Failed to load chat')
    const data = (await response.json()) as { conversation: Conversation }
    setActive(data.conversation)

    if (markRead && data.conversation.unreadByAdmin > 0) {
      await fetch(
        `/api/staff/${encodeURIComponent(staffId)}/chats/${encodeURIComponent(customerId)}`,
        { method: 'PATCH' },
      )
      await loadList(staffId)
    }

    return data.conversation
  }

  useEffect(() => {
    const sessionId = getStaffSessionId()
    if (sessionId) {
      setStaff({ id: sessionId, name: sessionId })
      void loadHubProfile()
      void loadStaffProfile(sessionId)
      void loadList(sessionId).catch(() => setStaffSession(null))
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!staff?.id) return
    let cancelled = false

    const refresh = async () => {
      try {
        const list = await loadList(staff.id)
        if (cancelled) return
        setError('')

        const currentId = selectedIdRef.current
        if (currentId) {
          await loadConversation(staff.id, currentId)
          return
        }

        const mobile = window.matchMedia(MOBILE_INBOX_MQ).matches
        if (!mobile && list.length > 0) {
          setSelectedId(list[0].customerId)
        }
      } catch {
        if (!cancelled) setError('Could not refresh chats.')
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
  }, [staff?.id])

  useEffect(() => {
    if (!staff?.id || !selectedId) return
    void loadConversation(staff.id, selectedId, true).catch(() => {
      setError('Could not open this chat.')
    })
  }, [staff?.id, selectedId])

  useEffect(() => {
    if (!active) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages.length, active])

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

  const handleSend = async () => {
    if (!active || !staff?.id) return
    const text = draft.trim()
    if (!text) return

    const message: ChatMessage = {
      id: `staff-${Date.now()}`,
      from: 'them',
      type: 'text',
      senderName: hubProfile.name,
      content: text,
      text,
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
    setDraft('')

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
      await loadList(staff.id)
      setError('')
    } catch {
      setActive(previous)
      setDraft(text)
      setError('Reply failed to send. Try again.')
    }
  }

  const signOut = () => {
    setStaffSession(null)
    setStaff(null)
    setConversations([])
    setSelectedId(null)
    setActive(null)
  }

  if (!ready) {
    return <main className="admin-shell admin-loading">Loading…</main>
  }

  if (!staff) {
    return (
      <StaffLogin
        onSuccess={(loggedIn) => {
          setStaff(loggedIn)
          void loadHubProfile()
          void loadList(loggedIn.id).catch(() => {
            setError('Could not load your chats.')
          })
        }}
      />
    )
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
    <main className="admin-inbox-shell staff-portal-shell">
      <section
        className={`admin-inbox ${isMobile ? (mobileShowingThread ? 'admin-inbox-mobile-thread' : 'admin-inbox-mobile-list') : ''}`}
        aria-label="Staff inbox"
      >
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <div className="admin-sidebar-title-row">
              <div className="admin-sidebar-profile staff-portal-sidebar-icon" aria-hidden="true">
                <UserRound size={22} />
              </div>
              <div>
                <h1>My chats</h1>
                <p>
                  {conversations.length} assigned · <strong>{staff.name}</strong> ({staff.id})
                </p>
              </div>
            </div>
            <button
              type="button"
              className="icon-button admin-sidebar-menu-trigger"
              aria-label="Sign out"
              onClick={signOut}
            >
              <LogOut size={20} />
            </button>
          </div>

          <div className="admin-customer-list" role="list" aria-label="Assigned chats">
            {conversations.length === 0 ? (
              <div className="admin-empty-list">
                <Users size={28} />
                <p>No chats assigned yet</p>
                <span>Ask your admin to assign customer chats to your staff id.</span>
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
              <h2>{selectedId ? 'Opening chat…' : 'Select a chat'}</h2>
              <p>
                {selectedId
                  ? 'Loading messages for this customer.'
                  : 'Tap a customer from the list to read and reply.'}
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
                    <Avatar name={active.customerName} imageUrl={null} />
                    <span className="online-dot" />
                  </div>
                  <div>
                    <h1>{active.customerName}</h1>
                    <p>
                      {active.messages.length} message
                      {active.messages.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="joined-bar">
                <Shield size={18} />
                <p>
                  Replying as <strong>{hubProfile.name}</strong>
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

              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSend()
                }}
              >
                <ComposerTextarea
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => void handleSend()}
                  placeholder={`Reply as ${hubProfile.name}…`}
                  ariaLabel="Staff reply"
                  autoFocus={!isMobile}
                />
                <button
                  type="submit"
                  aria-label="Send reply"
                  className={`send-button${draft.trim() ? ' send-button-visible' : ''}`}
                  disabled={!draft.trim()}
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
