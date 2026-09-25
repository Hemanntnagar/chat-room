import {
  getAutoReplyConfig,
  getCustomerQuickReplies,
  saveAutoReplyConfig,
} from '@/lib/auto-replies'
import type { AutoReplyConfig, AutoReplyRule } from '@/lib/chat-messages'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('view') === 'quick-replies') {
    const quickReplies = await getCustomerQuickReplies()
    return Response.json({ quickReplies })
  }

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
        label?: string
        triggerText?: string
      }
    >
  }

  if (!Array.isArray(payload.rules)) {
    return Response.json({ error: 'rules array is required' }, { status: 400 })
  }

  const rules = payload.rules.map((rule) => ({
    triggerId: String(rule.triggerId ?? ''),
    label: String(rule.label ?? ''),
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
