import path from 'node:path'
import { getAdminProfile } from '@/lib/admin-profile'
import { getAutoSetMessages } from '@/lib/auto-set-messages'
import {
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
  messagePreview,
  withCustomerSeed,
} from '@/lib/chat-messages'
import { hasDatabase, readKv, writeKv } from '@/lib/db'
import { getDataDir, readTextFile, writeTextFile } from '@/lib/runtime-fs'

type ChatStoreData = {
  conversations: Record<string, Conversation>
}

type GlobalChatStore = {
  chatStoreData?: ChatStoreData
  chatStoreWriteQueue?: Promise<void>
}

const KV_KEY = 'chats'
const globalStore = globalThis as typeof globalThis & GlobalChatStore

function dataFile() {
  return path.join(getDataDir(), 'chats.json')
}

function emptyStore(): ChatStoreData {
  return { conversations: {} }
}

function normalizeStore(input: unknown): ChatStoreData {
  const parsed = input as ChatStoreData | null
  if (!parsed?.conversations || typeof parsed.conversations !== 'object') {
    return emptyStore()
  }
  return { conversations: parsed.conversations }
}

async function readFromDisk(): Promise<ChatStoreData> {
  const raw = await readTextFile(dataFile())
  if (!raw) return emptyStore()
  try {
    return normalizeStore(JSON.parse(raw))
  } catch {
    return emptyStore()
  }
}

async function loadStore(): Promise<ChatStoreData> {
  if (hasDatabase()) {
    const fromDb = await readKv<ChatStoreData>(KV_KEY)
    return normalizeStore(fromDb)
  }

  if (!globalStore.chatStoreData) {
    globalStore.chatStoreData = await readFromDisk()
  }
  return globalStore.chatStoreData
}

async function persistStore(data: ChatStoreData) {
  if (hasDatabase()) {
    await writeKv(KV_KEY, data)
    globalStore.chatStoreData = data
    return
  }

  globalStore.chatStoreData = data
  const write = async () => {
    await writeTextFile(dataFile(), JSON.stringify(data, null, 2))
  }

  globalStore.chatStoreWriteQueue = (globalStore.chatStoreWriteQueue ?? Promise.resolve())
    .then(write)
    .catch(() => {
      // Keep memory store even if disk write fails (e.g. serverless).
    })

  await globalStore.chatStoreWriteQueue
}

function toSummary(conversation: Conversation): ConversationSummary {
  const last = conversation.messages[conversation.messages.length - 1]
  return {
    customerId: conversation.customerId,
    customerName: conversation.customerName,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    lastMessage: last ? messagePreview(last) : 'No messages yet',
    unreadByAdmin: conversation.unreadByAdmin,
  }
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const store = await loadStore()
  return Object.values(store.conversations)
    .map(toSummary)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getConversation(customerId: string): Promise<Conversation | null> {
  const store = await loadStore()
  return store.conversations[customerId] ?? null
}

export async function ensureConversation(
  customerId: string,
  customerName: string,
): Promise<Conversation> {
  const store = await loadStore()
  const existing = store.conversations[customerId]
  if (existing) {
    if (existing.customerName !== customerName && customerName.trim()) {
      existing.customerName = customerName.trim()
      existing.updatedAt = Date.now()
      await persistStore(store)
    }
    return existing
  }

  const now = Date.now()
  const [hubProfile, autoSet] = await Promise.all([
    getAdminProfile(),
    getAutoSetMessages(),
  ])
  const conversation: Conversation = {
    customerId,
    customerName: customerName.trim() || 'Guest',
    createdAt: now,
    updatedAt: now,
    unreadByAdmin: 0,
    messages: withCustomerSeed(
      customerId,
      customerName.trim() || 'Guest',
      hubProfile.name,
      autoSet,
    ),
  }
  store.conversations[customerId] = conversation
  await persistStore(store)
  return conversation
}

export async function appendConversationMessage(
  customerId: string,
  customerName: string,
  message: ChatMessage,
  options?: { fromAdmin?: boolean },
): Promise<Conversation> {
  const conversation = await ensureConversation(customerId, customerName)
  const store = await loadStore()
  const current = store.conversations[customerId] ?? conversation

  const nextMessage: ChatMessage = {
    ...message,
    customerId,
    id: message.id || `${options?.fromAdmin ? 'admin' : 'cust'}-${Date.now()}`,
    createdAt: message.createdAt || Date.now(),
  }

  current.messages = [...current.messages, nextMessage]
  current.updatedAt = nextMessage.createdAt
  if (customerName.trim()) current.customerName = customerName.trim()

  if (options?.fromAdmin) {
    current.unreadByAdmin = 0
  } else if (nextMessage.from === 'me') {
    current.unreadByAdmin += 1
  }

  store.conversations[customerId] = current
  await persistStore(store)
  return current
}

export async function markConversationRead(customerId: string): Promise<Conversation | null> {
  const store = await loadStore()
  const conversation = store.conversations[customerId]
  if (!conversation) return null
  conversation.unreadByAdmin = 0
  await persistStore(store)
  return conversation
}

export async function clearConversation(customerId: string): Promise<Conversation | null> {
  const store = await loadStore()
  const existing = store.conversations[customerId]
  if (!existing) return null

  const now = Date.now()
  const [hubProfile, autoSet] = await Promise.all([
    getAdminProfile(),
    getAutoSetMessages(),
  ])
  const conversation: Conversation = {
    customerId,
    customerName: existing.customerName,
    createdAt: existing.createdAt,
    updatedAt: now,
    unreadByAdmin: 0,
    messages: withCustomerSeed(
      customerId,
      existing.customerName,
      hubProfile.name,
      autoSet,
    ),
  }
  store.conversations[customerId] = conversation
  await persistStore(store)
  return conversation
}

export async function deleteConversation(customerId: string): Promise<boolean> {
  const store = await loadStore()
  if (!store.conversations[customerId]) return false
  delete store.conversations[customerId]
  await persistStore(store)
  return true
}

/** Keep stored hub message labels in sync when the admin display name changes. */
export async function updateHubSenderName(senderName: string): Promise<void> {
  const nextName = senderName.trim()
  if (!nextName) return

  const store = await loadStore()
  let changed = false

  for (const conversation of Object.values(store.conversations)) {
    let conversationChanged = false
    conversation.messages = conversation.messages.map((message) => {
      if (message.from !== 'them') return message
      if (message.senderName === nextName) return message
      conversationChanged = true
      return { ...message, senderName: nextName }
    })
    if (conversationChanged) {
      changed = true
      conversation.updatedAt = Date.now()
    }
  }

  if (changed) {
    await persistStore(store)
  }
}
