import { getAdminProfile, saveAdminProfile } from '@/lib/admin-profile'
import { getAutoReplyConfig, saveAutoReplyConfig } from '@/lib/auto-replies'
import { updateHubSenderName } from '@/lib/chat-store'
import type { AdminProfile } from '@/lib/chat-messages'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
}

export async function GET() {
  const profile = await getAdminProfile()
  return Response.json({ profile }, { headers: NO_STORE_HEADERS })
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

  // Update every existing hub message so customers see the new name immediately.
  await updateHubSenderName(profile.name)

  return Response.json({ profile }, { headers: NO_STORE_HEADERS })
}
