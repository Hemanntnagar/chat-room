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
  audioUrl?: string
  durationSec?: number
  timestamp: string
  status?: MessageStatus
  createdAt: number
  preset?: MessagePreset
}

export const HUB_NAME = 'Profit Online Hub'
export const MESSAGES_STORAGE_KEY = 'chat-room:messages'
export const ADMIN_SESSION_KEY = 'chat-room:admin'
/** Demo admin password — change for production use */
export const ADMIN_PASSWORD = 'admin'

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

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadMessages(): ChatMessage[] {
  if (!canUseStorage()) return SEED_MESSAGES
  try {
    const raw = window.localStorage.getItem(MESSAGES_STORAGE_KEY)
    if (!raw) return SEED_MESSAGES
    const parsed = JSON.parse(raw) as ChatMessage[]
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED_MESSAGES
    return parsed
  } catch {
    return SEED_MESSAGES
  }
}

export function saveMessages(messages: ChatMessage[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages))
  window.dispatchEvent(new CustomEvent('chat-messages-updated'))
}

export function clearMessages() {
  saveMessages(SEED_MESSAGES)
}

export function subscribeToMessages(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event: StorageEvent) => {
    if (event.key === MESSAGES_STORAGE_KEY) onChange()
  }
  const handleCustom = () => onChange()

  window.addEventListener('storage', handleStorage)
  window.addEventListener('chat-messages-updated', handleCustom)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('chat-messages-updated', handleCustom)
  }
}

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
