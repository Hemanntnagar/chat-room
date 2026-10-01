import { getConversation, markConversationRead } from '@/lib/chat-store'
import { getStaff } from '@/lib/staff-store'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ staffId: string; customerId: string }>
}

async function loadStaffConversation(staffId: string, customerId: string) {
  const member = await getStaff(staffId)
  if (!member) {
    return { ok: false as const, status: 404, error: 'Staff not found' }
  }

  const conversation = await getConversation(customerId)
  if (!conversation) {
    return { ok: false as const, status: 404, error: 'Conversation not found' }
  }
  if (conversation.assignedStaffId !== member.id) {
    return { ok: false as const, status: 403, error: 'This chat is not assigned to you' }
  }

  return {
    ok: true as const,
    member: { id: member.id, name: member.name },
    conversation,
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { staffId, customerId } = await context.params
  const result = await loadStaffConversation(staffId, customerId)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json({
    staff: result.member,
    conversation: result.conversation,
  })
}

export async function PATCH(_request: Request, context: RouteContext) {
  const { staffId, customerId } = await context.params
  const result = await loadStaffConversation(staffId, customerId)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  const conversation = await markConversationRead(customerId)
  return Response.json({ conversation })
}
