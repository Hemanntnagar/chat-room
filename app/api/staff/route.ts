import { createStaff, listStaff } from '@/lib/staff-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const staff = await listStaff()
  return Response.json({ staff })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as { id?: string; name?: string; password?: string }

  try {
    const staff = await createStaff({
      id: payload.id ?? '',
      name: payload.name ?? '',
      password: payload.password ?? '',
    })
    return Response.json({ staff }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create staff'
    return Response.json({ error: message }, { status: 400 })
  }
}
