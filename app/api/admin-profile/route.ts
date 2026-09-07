import { getAdminProfile, saveAdminProfile } from '@/lib/admin-profile'
import { getAutoReplyConfig, saveAutoReplyConfig } from '@/lib/auto-replies'
import type { AdminProfile } from '@/lib/chat-messages'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getAdminProfile()
  return Response.json({ profile })
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as {
    name?: string
    imageUrl?: string | null
  }

  const name = payload.name?.trim()
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  const input: Partial<AdminProfile> = {
    name,
    imageUrl:
      payload.imageUrl === undefined
        ? undefined
        : payload.imageUrl?.trim() || null,
  }

  const profile = await saveAdminProfile(input)

  // Keep auto-reply sender name in sync with the public profile name.
  const autoReplies = await getAutoReplyConfig()
  await saveAutoReplyConfig({
    senderName: profile.name,
    rules: autoReplies.rules,
  })

  return Response.json({ profile })
}
