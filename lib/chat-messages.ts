export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read'

export type MessagePreset = 'links' | 'welcome'

export type ChatMessage = {
  id: string
  from: 'them' | 'me' | 'system'
  type: 'text' | 'voice' | 'file' | 'system'
  senderName?: string
  content: string
  text?: string
  fileName?: string
  fileUrl?: string
  mimeType?: string
  audioUrl?: string
  durationSec?: number
  timestamp: string
  status?: MessageStatus
  createdAt: number
  preset?: MessagePreset
  customerId?: string
}

export type ConversationSummary = {
  customerId: string
  customerName: string
  updatedAt: number
  messageCount: number
  lastMessage: string
  unreadByAdmin: number
}

export type Conversation = {
  customerId: string
  customerName: string
  createdAt: number
  updatedAt: number
  unreadByAdmin: number
  messages: ChatMessage[]
}

export const HUB_NAME = 'Profit Online Hub'
export const ADMIN_SESSION_KEY = 'chat-room:admin'
/** Demo admin password — change for production use */
export const ADMIN_PASSWORD = 'admin'

/** Quick replies shown to visitors — admin can bind auto-replies to these. */
export const CUSTOMER_QUICK_REPLIES = [
  { id: 'need-id', label: '🤖 🆔 I Need ID.', text: 'I Need ID.' },
  { id: 'need-support', label: '🤖 💬 I Need Support', text: 'I Need Support' },
] as const

export type CustomerQuickReplyId = (typeof CUSTOMER_QUICK_REPLIES)[number]['id']

export type AutoReplyRule = {
  triggerId: CustomerQuickReplyId
  triggerText: string
  /** Ordered bot messages sent when this trigger matches. */
  replies: string[]
  enabled: boolean
}

export type AutoReplyConfig = {
  senderName: string
  rules: AutoReplyRule[]
}

export type AdminProfile = {
  name: string
  imageUrl: string | null
}

export const SEED_MESSAGES: ChatMessage[] = [
  {
    id: 'links',
    from: 'them',
    type: 'text',
    senderName: HUB_NAME,
    timestamp: '12:03',
    createdAt: 0,
    content: 'Promo links and demo IDs',
    preset: 'links',
  },
  {
    id: 'welcome',
    from: 'them',
    type: 'text',
    senderName: HUB_NAME,
    timestamp: '12:03',
    createdAt: 1,
    content: 'You can chat here or connect via WhatsApp',
    preset: 'welcome',
  },
  {
    id: 'voice',
    from: 'them',
    type: 'voice',
    senderName: HUB_NAME,
    text: 'Hello sir, Me apki kya help kr skti hu?',
    durationSec: 4,
    timestamp: '12:03',
    createdAt: 2,
    content: 'Hello sir, Me apki kya help kr skti hu?',
  },
]

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function messagePreview(message: ChatMessage): string {
  if (message.type === 'voice') return `🎤 Voice · ${message.text ?? message.content}`
  if (message.type === 'file') return `📎 ${message.fileName ?? message.content}`
  if (message.type === 'system') return String(message.content)
  if (message.preset === 'links') return 'Promo links shared'
  if (message.preset === 'welcome') return 'Welcome message'
  return String(message.content)
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'
}

export function setAdminAuthenticated(value: boolean) {
  if (typeof window === 'undefined') return
  if (value) window.sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
  else window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
}

export function withCustomerSeed(
  customerId: string,
  customerName: string,
  hubName = HUB_NAME,
): ChatMessage[] {
  const now = Date.now()
  const senderName = hubName.trim() || HUB_NAME
  return [
    ...SEED_MESSAGES.map((message, index) => ({
      ...message,
      id: `${customerId}-${message.id}`,
      customerId,
      senderName: message.from === 'them' ? senderName : message.senderName,
      createdAt: now + index,
    })),
    {
      id: `${customerId}-joined`,
      from: 'system',
      type: 'system',
      content: `${customerName} joined the chat`,
      timestamp: formatTime(),
      createdAt: now + SEED_MESSAGES.length,
      customerId,
    },
  ]
}
