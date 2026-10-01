import { assignStaffToCustomer } from '@/lib/staff-store'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as { customerId?: string; staffId?: string | null }

  const customerId = payload.customerId?.trim()
  if (!customerId) {
    return Response.json({ error: 'customerId is required' }, { status: 400 })
  }

  try {
    const staff = await assignStaffToCustomer(customerId, payload.staffId ?? null)
    return Response.json({ staff })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assignment failed'
    return Response.json({ error: message }, { status: 400 })
  }
}
