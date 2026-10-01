import { listConversationsForStaff } from '@/lib/chat-store'
import { getStaff } from '@/lib/staff-store'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ staffId: string }>
}

/** @deprecated Prefer GET /api/staff/[staffId]/chats */
export async function GET(_request: Request, context: RouteContext) {
  const { staffId } = await context.params
  const member = await getStaff(staffId)
  if (!member) {
    return Response.json({ error: 'Staff not found' }, { status: 404 })
  }

  const conversations = await listConversationsForStaff(member.id)
  const conversation =
    conversations.length > 0
      ? await import('@/lib/chat-store').then((m) =>
          m.getConversation(conversations[0].customerId),
        )
      : null

  return Response.json({
    conversation,
    staff: { id: member.id, name: member.name },
    conversations,
  })
}
