import { assignChatToStaff, deleteStaff, getStaff, updateStaff } from '@/lib/staff-store'

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

  return Response.json({
    staff: {
      id: member.id,
      name: member.name,
      assignedCustomerId: member.assignedCustomerId,
      createdAt: member.createdAt,
    },
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const { staffId } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as {
    name?: string
    password?: string
    assignedCustomerId?: string | null
  }

  try {
    if (payload.assignedCustomerId !== undefined) {
      const result = await assignChatToStaff(staffId, payload.assignedCustomerId)
      return Response.json(result)
    }

    const staff = await updateStaff(staffId, {
      name: payload.name,
      password: payload.password,
    })
    if (!staff) {
      return Response.json({ error: 'Staff not found' }, { status: 404 })
    }
    return Response.json({ staff })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed'
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { staffId } = await context.params
  const deleted = await deleteStaff(staffId)
  if (!deleted) {
    return Response.json({ error: 'Staff not found' }, { status: 404 })
  }
  return Response.json({ ok: true })
}
