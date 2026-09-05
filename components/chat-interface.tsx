'use client'

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import {
  Check,
  CheckCheck,
  Download,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Play,
  Send,
  Smile,
  UserRound,
  Volume2,
  X,
} from 'lucide-react'

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read'

type ChatMessage = {
  id: string
  from: 'them' | 'me'
  type: 'text' | 'voice' | 'file'
  content: ReactNode
  text?: string
  fileName?: string
  timestamp: string
  status?: MessageStatus
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'links',
    from: 'them',
    type: 'text',
    timestamp: '12:03',
    content: (
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
    ),
  },
  {
    id: 'welcome',
    from: 'them',
    type: 'text',
    timestamp: '12:03',
    content: (
      <div className="space-y-3">
        <p>
          <span aria-hidden="true">💬</span> You can chat here or click the WhatsApp button
          above to connect directly.
        </p>
        <p lang="hi">
          आप यहाँ चैट कर सकते हैं या ऊपर दिए WhatsApp button पर क्लिक करके सीधे जुड़ सकते हैं।
        </p>
        <a href="https://bio.wa.link/profit" className="chat-link" target="_blank" rel="noreferrer">
          https://bio.wa.link/profit
        </a>
      </div>
    ),
  },
  {
    id: 'voice',
    from: 'them',
    type: 'voice',
    text: 'Hello sir, Me apki kya help kr skti hu?',
    timestamp: '12:03',
    content: 'Hello sir, Me apki kya help kr skti hu?',
  },
]

const EMOJIS = ['🙂', '😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '🔥', '💬', '✅', '🤖']
const QUICK_REPLIES = [
  { label: '🤖 🆔 I Need ID.', text: 'I Need ID.' },
  { label: '🤖 💬 I Need Support', text: 'I Need Support' },
]

const AUTO_REPLIES: Record<string, string> = {
  'i need id.': 'Sure! Please share your name and preferred game. We will create your demo ID shortly.',
  'i need support': 'Our support team is here. Please describe your issue and we will help you right away.',
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function Avatar({ small = false }: { small?: boolean }) {
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

function NameBar({
  name,
  onNameChange,
}: {
  name: string
  onNameChange: (name: string) => void
}) {
  const [draft, setDraft] = useState(name)
  const [saved, setSaved] = useState(Boolean(name))

  return (
    <section className="name-bar">
      <label htmlFor="visitor-name">
        <UserRound size={24} />
        <span>Your name</span>
      </label>
      <input
        id="visitor-name"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setSaved(false)
        }}
        placeholder="Enter your name"
      />
      <button
        type="button"
        onClick={() => {
          onNameChange(draft.trim())
          setSaved(true)
        }}
      >
        {saved ? <Check size={19} /> : 'Save'}
      </button>
    </section>
  )
}

function VoiceBubble({
  caption,
  outgoing,
}: {
  caption: string
  outgoing?: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          setPlaying(false)
          return 0
        }
        return value + 4
      })
    }, 120)
    return () => window.clearInterval(id)
  }, [playing])

  return (
    <>
      <div className="voice-controls">
        <button
          aria-label={playing ? 'Pause voice message' : 'Play voice message'}
          className={`play-button ${outgoing ? 'play-button-out' : ''}`}
          type="button"
          onClick={() => setPlaying((value) => !value)}
        >
          <Play size={21} fill="currentColor" />
        </button>
        <div className="voice-track">
          <span style={{ width: `${Math.max(progress, 8)}%` }} />
        </div>
        <Volume2 size={17} className="volume-icon" />
      </div>
      <div className="voice-meta">
        <span>{playing ? `0:${String(Math.floor(progress / 4)).padStart(2, '0')}` : '0:00'}</span>
        <span>1x</span>
      </div>
      <p className="voice-caption">{caption}</p>
    </>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const outgoing = message.from === 'me'

  return (
    <article className={`message-row ${outgoing ? 'message-out' : 'message-in'} ${message.type === 'voice' ? 'voice-row' : ''}`}>
      {!outgoing && <Avatar small />}
      <div
        className={`message-bubble ${outgoing ? 'bubble-out' : 'bubble-in'} ${message.type === 'voice' ? 'voice-bubble' : ''} ${message.type === 'file' ? 'file-bubble' : ''}`}
      >
        {!outgoing && <div className="sender-name">Profit Online Hub</div>}
        {message.type === 'voice' ? (
          <VoiceBubble caption={String(message.text ?? message.content)} outgoing={outgoing} />
        ) : message.type === 'file' ? (
          <div className="file-card">
            <Paperclip size={18} />
            <span>{message.fileName ?? 'Attachment'}</span>
          </div>
        ) : (
          <div className="message-body">{message.content}</div>
        )}
        <div className="message-meta">
          <time>{message.timestamp}</time>
          {outgoing && <StatusTicks status={message.status} />}
        </div>
      </div>
    </article>
  )
}

function Composer({
  onSend,
}: {
  onSend: (payload: { text?: string; fileName?: string }) => void
}) {
  const [draft, setDraft] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasText = Boolean(draft.trim())

  const sendMessage = () => {
    const text = draft.trim()
    if (!text) return
    onSend({ text })
    setDraft('')
    setShowEmojiPicker(false)
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onSend({ fileName: file.name, text: `Attached: ${file.name}` })
      event.target.value = ''
    }
  }

  return (
    <>
      <div className="quick-replies" aria-label="Quick replies">
        {QUICK_REPLIES.map((reply) => (
          <button key={reply.text} type="button" onClick={() => onSend({ text: reply.text })}>
            {reply.label}
          </button>
        ))}
      </div>
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
            onClick={() => setShowEmojiPicker((value) => !value)}
          >
            <Smile size={22} />
          </button>
          {showEmojiPicker && (
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
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message"
          aria-label="Message"
        />
        {hasText ? (
          <button type="submit" aria-label="Send message" className="send-button send-button-visible">
            <Send size={20} />
          </button>
        ) : (
          <button type="button" aria-label="Record voice message" className="mic-button">
            <Mic size={21} />
          </button>
        )}
      </form>
    </>
  )
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [visitorName, setVisitorName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const replyTimers = useRef<number[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
          content: text,
          text,
          timestamp: formatTime(),
        },
      ])
    }, delay)
    replyTimers.current.push(timer)
  }

  const handleSend = ({ text, fileName }: { text?: string; fileName?: string }) => {
    if (!text && !fileName) return

    const id = `me-${Date.now()}`
    const outgoing: ChatMessage = {
      id,
      from: 'me',
      type: fileName ? 'file' : 'text',
      content: text ?? fileName ?? '',
      text,
      fileName,
      timestamp: formatTime(),
      status: 'sending',
    }

    setMessages((items) => [...items, outgoing])

    window.setTimeout(() => updateStatus(id, 'sent'), 350)
    window.setTimeout(() => updateStatus(id, 'delivered'), 900)
    window.setTimeout(() => updateStatus(id, 'read'), 1600)

    const normalized = (text ?? '').trim().toLowerCase()
    const autoReply = AUTO_REPLIES[normalized]
    if (autoReply) {
      pushReply(autoReply, 1800)
    } else if (fileName) {
      pushReply('Got your file. Our team will review it shortly.', 1600)
    } else if (text) {
      const greeting = visitorName ? `${visitorName}, t` : 'T'
      pushReply(
        `${greeting}hanks for your message. A Profit Online Hub agent will reply shortly.`,
        1800,
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="chat-window" aria-label="Chat with Profit Online Hub">
        <Header />
        <NameBar name={visitorName} onNameChange={setVisitorName} />
        <div className="chat-content">
          <div className="messages">
            <div className="day-separator" role="separator">
              <span>Today</span>
            </div>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
        <Composer onSend={handleSend} />
      </section>
    </main>
  )
}
