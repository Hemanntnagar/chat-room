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

/** Default quick replies — admin can edit label/text and add more. */
export const CUSTOMER_QUICK_REPLIES = [
  { id: 'need-id', label: '🤖 🆔 I Need ID.', text: 'I Need ID.' },
  { id: 'need-support', label: '🤖 💬 I Need Support', text: 'I Need Support' },
] as const

export type CustomerQuickReplyId = string

export type CustomerQuickReply = {
  id: string
  label: string
  text: string
}

export type AutoReplyRule = {
  triggerId: string
  /** Button label shown to the customer. */
  label: string
  /** Customer message text (button send + auto-reply match). */
  triggerText: string
  /** Ordered bot messages sent when this trigger matches. */
  replies: string[]
  enabled: boolean
}

export type AutoReplyConfig = {
  senderName: string
  rules: AutoReplyRule[]
}

/** Opening messages posted when a customer chat is created or cleared. */
export type AutoSetMessages = {
  linksText: string
  welcomeText: string
  voiceText: string
  voiceDurationSec: number
}

export type AdminProfile = {
  name: string
  imageUrl: string | null
}

export const DEFAULT_AUTO_SET_MESSAGES: AutoSetMessages = {
  linksText: [
    'https://777.us',
    'https://Cricxbet99.xyz',
    'https://9wicket.com',
    'https://gold.365.run',
    '(FOR DEMO Id - Just click on LOGIN WITH DEMO on our sites)👍',
    '',
    '♆ Profit Online HUB ♆',
    '╰┈➤ 🙏 HAPPY GAMING 🙏 ╰┈➤',
    '',
    '🚦FAST WITHDRAWALWITH IN 10 MINUTES 🚦',
  ].join('\n'),
  welcomeText: [
    '💬 You can chat here or click the WhatsApp button above to connect directly.',
    '',
    'आप यहाँ चैट कर सकते हैं या ऊपर दिए WhatsApp button पर क्लिक करके सीधे जुड़ सकते हैं।',
    '',
    'https://bio.wa.link/profit',
  ].join('\n'),
  voiceText: 'Hello sir, Me apki kya help kr skti hu?',
  voiceDurationSec: 4,
}

export function buildSeedMessages(
  autoSet: AutoSetMessages = DEFAULT_AUTO_SET_MESSAGES,
): ChatMessage[] {
  const linksText = autoSet.linksText.trim() || DEFAULT_AUTO_SET_MESSAGES.linksText
  const welcomeText = autoSet.welcomeText.trim() || DEFAULT_AUTO_SET_MESSAGES.welcomeText
  const voiceText = autoSet.voiceText.trim() || DEFAULT_AUTO_SET_MESSAGES.voiceText
  const voiceDurationSec = Math.max(
    1,
    Math.min(120, Math.round(autoSet.voiceDurationSec) || DEFAULT_AUTO_SET_MESSAGES.voiceDurationSec),
  )

  return [
    {
      id: 'links',
      from: 'them',
      type: 'text',
      senderName: HUB_NAME,
      timestamp: '12:03',
      createdAt: 0,
      content: linksText,
    },
    {
      id: 'welcome',
      from: 'them',
      type: 'text',
      senderName: HUB_NAME,
      timestamp: '12:03',
      createdAt: 1,
      content: welcomeText,
    },
    {
      id: 'voice',
      from: 'them',
      type: 'voice',
      senderName: HUB_NAME,
      text: voiceText,
      durationSec: voiceDurationSec,
      timestamp: '12:03',
      createdAt: 2,
      content: voiceText,
    },
  ]
}

/** @deprecated Prefer buildSeedMessages — kept for callers that expect a static list. */
export const SEED_MESSAGES: ChatMessage[] = buildSeedMessages()

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
  autoSet: AutoSetMessages = DEFAULT_AUTO_SET_MESSAGES,
): ChatMessage[] {
  const now = Date.now()
  const senderName = hubName.trim() || HUB_NAME
  const seedMessages = buildSeedMessages(autoSet)
  return [
    ...seedMessages.map((message, index) => ({
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
      createdAt: now + seedMessages.length,
      customerId,
    },
  ]
}
