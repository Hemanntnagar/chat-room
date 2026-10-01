import { verifyStaffLogin } from '@/lib/staff-store'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as { id?: string; password?: string }
  const staff = await verifyStaffLogin(payload.id ?? '', payload.password ?? '')
  if (!staff) {
    return Response.json({ error: 'Invalid staff id or password' }, { status: 401 })
  }

  return Response.json({ staff })
}
