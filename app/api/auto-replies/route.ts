import { getAutoReplyConfig, saveAutoReplyConfig } from '@/lib/auto-replies'
import type { AutoReplyConfig, AutoReplyRule, CustomerQuickReplyId } from '@/lib/chat-messages'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = await getAutoReplyConfig()
  return Response.json({ config })
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as {
    senderName?: string
    rules?: Array<
      Partial<AutoReplyRule> & {
        triggerId?: string
        reply?: string
        replies?: string[]
      }
    >
  }

  if (!Array.isArray(payload.rules)) {
    return Response.json({ error: 'rules array is required' }, { status: 400 })
  }

  const rules = payload.rules.map((rule) => ({
    triggerId: rule.triggerId as CustomerQuickReplyId,
    triggerText: String(rule.triggerText ?? ''),
    replies: Array.isArray(rule.replies)
      ? rule.replies.map((item) => String(item ?? ''))
      : typeof rule.reply === 'string'
        ? [rule.reply]
        : [''],
    enabled: Boolean(rule.enabled),
  }))

  const input: Partial<AutoReplyConfig> = {
    senderName: payload.senderName,
    rules,
  }

  const config = await saveAutoReplyConfig(input)
  return Response.json({ config })
}
