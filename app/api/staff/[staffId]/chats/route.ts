import { listConversationsForStaff } from '@/lib/chat-store'
import { getStaff } from '@/lib/staff-store'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ staffId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { staffId } = await context.params
  const member = await getStaff(staffId)
  if (!member) {
    return Response.json({ error: 'Staff not found' }, { status: 404 })
  }

  const conversations = await listConversationsForStaff(member.id)
  return Response.json({
    staff: { id: member.id, name: member.name },
    conversations,
  })
}
