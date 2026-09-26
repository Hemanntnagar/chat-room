import { getAutoSetMessages, saveAutoSetMessages } from '@/lib/auto-set-messages'
import type { AutoSetMessages } from '@/lib/chat-messages'

export const dynamic = 'force-dynamic'

export async function GET() {
  const messages = await getAutoSetMessages()
  return Response.json({ messages })
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as Partial<AutoSetMessages>

  const messages = await saveAutoSetMessages({
    linksText: typeof payload.linksText === 'string' ? payload.linksText : undefined,
    welcomeText: typeof payload.welcomeText === 'string' ? payload.welcomeText : undefined,
    voiceText: typeof payload.voiceText === 'string' ? payload.voiceText : undefined,
    voiceDurationSec:
      typeof payload.voiceDurationSec === 'number'
        ? payload.voiceDurationSec
        : typeof payload.voiceDurationSec === 'string'
          ? Number(payload.voiceDurationSec)
          : undefined,
    voiceAudioUrl:
      payload.voiceAudioUrl === null
        ? null
        : typeof payload.voiceAudioUrl === 'string'
          ? payload.voiceAudioUrl
          : undefined,
    attachmentFileName:
      payload.attachmentFileName === null
        ? null
        : typeof payload.attachmentFileName === 'string'
          ? payload.attachmentFileName
          : undefined,
    attachmentFileUrl:
      payload.attachmentFileUrl === null
        ? null
        : typeof payload.attachmentFileUrl === 'string'
          ? payload.attachmentFileUrl
          : undefined,
    attachmentMimeType:
      payload.attachmentMimeType === null
        ? null
        : typeof payload.attachmentMimeType === 'string'
          ? payload.attachmentMimeType
          : undefined,
  })

  return Response.json({ messages })
}
