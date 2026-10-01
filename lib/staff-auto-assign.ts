import { getConversation } from '@/lib/chat-store'
import { advanceStaffRoundRobin, assignChatToStaff } from '@/lib/staff-store'

/** Assign an unassigned chat to the next staff member in rotation. */
export async function autoAssignConversationIfUnassigned(
  customerId: string,
): Promise<string | null> {
  const trimmedId = customerId.trim()
  if (!trimmedId) return null

  const conversation = await getConversation(trimmedId)
  if (!conversation) return null
  if (conversation.assignedStaffId) return conversation.assignedStaffId

  const staffId = await advanceStaffRoundRobin()
  if (!staffId) return null

  await assignChatToStaff(staffId, trimmedId)
  return staffId
}
