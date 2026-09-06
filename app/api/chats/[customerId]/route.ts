import {
  clearConversation,
  deleteConversation,
  getConversation,
  markConversationRead,
} from '@/lib/chat-store'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ customerId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { customerId } = await context.params
  const conversation = await getConversation(customerId)
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 })
  }
  return Response.json({ conversation })
}

export async function PATCH(_request: Request, context: RouteContext) {
  const { customerId } = await context.params
  const conversation = await markConversationRead(customerId)
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 })
  }
  return Response.json({ conversation })
}

export async function PUT(_request: Request, context: RouteContext) {
  const { customerId } = await context.params
  const conversation = await clearConversation(customerId)
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 })
  }
  return Response.json({ conversation })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { customerId } = await context.params
  const deleted = await deleteConversation(customerId)
  if (!deleted) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 })
  }
  return Response.json({ ok: true })
}
