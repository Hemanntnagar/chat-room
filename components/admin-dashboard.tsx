'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, LogOut, RefreshCw, Shield, Trash2 } from 'lucide-react'
import { MessageBubble, Avatar } from '@/components/message-bubble'
import {
  type ChatMessage,
  ADMIN_PASSWORD,
  clearMessages,
  isAdminAuthenticated,
  loadMessages,
  setAdminAuthenticated,
  subscribeToMessages,
} from '@/lib/chat-messages'

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
        <p>Sign in to view the full chat room conversation.</p>
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

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAuthed(isAdminAuthenticated())
    setMessages(loadMessages())
    setReady(true)
    return subscribeToMessages(() => setMessages(loadMessages()))
  }, [])

  useEffect(() => {
    if (!authed) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, authed])

  if (!ready) {
    return <main className="admin-shell admin-loading">Loading…</main>
  }

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />
  }

  return (
    <main className="app-shell">
      <section className="chat-window admin-chat-window" aria-label="Admin chat viewer">
        <header className="chat-header">
          <div className="header-profile">
            <div className="avatar-wrap">
              <Avatar />
              <span className="online-dot" />
            </div>
            <div>
              <h1>All chat messages</h1>
              <p>
                {messages.length} message{messages.length === 1 ? '' : 's'} · live view
              </p>
            </div>
          </div>
          <div className="header-actions admin-chat-actions">
            <Link href="/" className="save-chat-button" aria-label="Back to chat">
              <ArrowLeft size={18} />
              <span>Chat</span>
            </Link>
            <button
              type="button"
              className="save-chat-button"
              aria-label="Refresh messages"
              onClick={() => setMessages(loadMessages())}
            >
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="save-chat-button"
              aria-label="Clear chat"
              onClick={() => {
                if (!window.confirm('Reset chat to the default welcome messages?')) return
                clearMessages()
                setMessages(loadMessages())
              }}
            >
              <Trash2 size={18} />
              <span>Clear</span>
            </button>
            <button
              type="button"
              className="save-chat-button"
              aria-label="Sign out"
              onClick={() => {
                setAdminAuthenticated(false)
                setAuthed(false)
              }}
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <div className="joined-bar">
          <Shield size={18} />
          <p>
            Viewing as <strong>Admin</strong>
            <span> · full conversation from the chat room</span>
          </p>
        </div>

        <div className="chat-content">
          <div className="messages">
            <div className="day-separator" role="separator">
              <span>Full chat history</span>
            </div>
            {messages.length === 0 ? (
              <div className="system-message" role="status">
                <span>No messages yet</span>
              </div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </section>
    </main>
  )
}
