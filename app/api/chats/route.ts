import {
  appendConversationMessage,
  ensureConversation,
  listConversations,
} from '@/lib/chat-store'
import { formatTime, type ChatMessage } from '@/lib/chat-messages'

export const dynamic = 'force-dynamic'

export async function GET() {
  const conversations = await listConversations()
  return Response.json({ conversations })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as {
    customerId?: string
    customerName?: string
    message?: Partial<ChatMessage>
    fromAdmin?: boolean
  }

  const customerId = payload.customerId?.trim()
  const customerName = payload.customerName?.trim()

  if (!customerId || !customerName) {
    return Response.json({ error: 'customerId and customerName are required' }, { status: 400 })
  }

  if (!payload.message) {
    const conversation = await ensureConversation(customerId, customerName)
    return Response.json({ conversation })
  }

  const message = payload.message
  const content = String(message.content ?? message.text ?? message.fileName ?? '').trim()
  if (!content && message.type !== 'voice' && message.type !== 'file') {
    return Response.json({ error: 'Message content is required' }, { status: 400 })
  }

  const fromAdmin = Boolean(payload.fromAdmin)
  const now = Date.now()
  const nextMessage: ChatMessage = {
    id: message.id || `${fromAdmin ? 'admin' : 'cust'}-${now}`,
    from: fromAdmin ? 'them' : message.from === 'system' ? 'system' : 'me',
    type: message.type ?? 'text',
    senderName: fromAdmin ? message.senderName : customerName,
    content: content || (message.type === 'voice' ? 'Voice message' : 'Attachment'),
    text: message.text,
    fileName: message.fileName,
    fileUrl: message.fileUrl,
    mimeType: message.mimeType,
    audioUrl: message.audioUrl,
    durationSec: message.durationSec,
    timestamp: message.timestamp || formatTime(new Date(now)),
    status: message.status ?? 'sent',
    createdAt: message.createdAt || now,
    preset: message.preset,
    customerId,
  }

  const conversation = await appendConversationMessage(
    customerId,
    customerName,
    nextMessage,
    { fromAdmin },
  )

  return Response.json({ conversation, message: nextMessage })
}
