import path from 'node:path'
import { getAdminProfile } from '@/lib/admin-profile'
import {
  CUSTOMER_QUICK_REPLIES,
  HUB_NAME,
  type AutoReplyConfig,
  type AutoReplyRule,
  type CustomerQuickReply,
} from '@/lib/chat-messages'
import { hasDatabase, readKv, writeKv } from '@/lib/db'
import { getDataDir, readTextFile, writeTextFile } from '@/lib/runtime-fs'

type GlobalAutoReplyStore = {
  autoReplyConfig?: AutoReplyConfig
  autoReplyWriteQueue?: Promise<void>
}

/** Older saved configs used a single `reply` string and fixed labels. */
type LegacyAutoReplyRule = Partial<AutoReplyRule> & {
  triggerId?: string
  reply?: string
  replies?: string[]
  label?: string
  triggerText?: string
}

type LegacyAutoReplyConfig = {
  senderName?: string
  rules?: LegacyAutoReplyRule[]
}

const KV_KEY = 'auto-replies'
const globalStore = globalThis as typeof globalThis & GlobalAutoReplyStore
const DEFAULT_IDS: Set<string> = new Set(CUSTOMER_QUICK_REPLIES.map((item) => item.id))

function dataFile() {
  return path.join(getDataDir(), 'auto-replies.json')
}

function defaultMeta(triggerId: string) {
  return CUSTOMER_QUICK_REPLIES.find((item) => item.id === triggerId)
}

function normalizeReplies(rule?: LegacyAutoReplyRule | null): string[] {
  const fromList = (rule?.replies ?? [])
    .map((item) => String(item ?? ''))
    .filter((item, index) => item.trim() || index === 0)

  if (fromList.length > 0) return fromList

  const legacy = rule?.reply
  if (typeof legacy === 'string') return [legacy]

  return ['']
}

function normalizeRule(
  rule: LegacyAutoReplyRule | null | undefined,
  fallback?: { id: string; label: string; text: string },
): AutoReplyRule | null {
  const triggerId = String(rule?.triggerId ?? fallback?.id ?? '').trim()
  if (!triggerId) return null

  const meta = fallback ?? defaultMeta(triggerId)
  const replies = normalizeReplies(rule)
  const hasContent = replies.some((reply) => reply.trim())
  const triggerText = String(rule?.triggerText ?? meta?.text ?? '').trim() || meta?.text || ''
  const label = String(rule?.label ?? meta?.label ?? triggerText).trim() || triggerText || 'Quick reply'

  return {
    triggerId,
    label,
    triggerText,
    replies,
    enabled: Boolean(rule?.enabled && hasContent && triggerText),
  }
}

function normalizeConfig(input?: LegacyAutoReplyConfig | null): AutoReplyConfig {
  const incoming = input?.rules ?? []
  const byId = new Map(
    incoming
      .filter((rule) => rule.triggerId)
      .map((rule) => [String(rule.triggerId), rule] as const),
  )

  const rules: AutoReplyRule[] = []

  for (const item of CUSTOMER_QUICK_REPLIES) {
    const normalized = normalizeRule(byId.get(item.id), item)
    if (normalized) rules.push(normalized)
  }

  for (const rule of incoming) {
    const id = String(rule.triggerId ?? '').trim()
    if (!id || DEFAULT_IDS.has(id)) continue
    const normalized = normalizeRule(rule)
    if (!normalized) continue
    // Drop empty custom drafts that have no customer message and no replies.
    if (
      !normalized.triggerText.trim() &&
      !normalized.replies.some((reply) => reply.trim())
    ) {
      continue
    }
    rules.push(normalized)
  }

  return {
    senderName: input?.senderName?.trim() || HUB_NAME,
    rules,
  }
}

async function readFromDisk(): Promise<AutoReplyConfig> {
  const raw = await readTextFile(dataFile())
  if (!raw) return normalizeConfig()
  try {
    return normalizeConfig(JSON.parse(raw) as LegacyAutoReplyConfig)
  } catch {
    return normalizeConfig()
  }
}

async function loadConfig(): Promise<AutoReplyConfig> {
  if (hasDatabase()) {
    const fromDb = await readKv<LegacyAutoReplyConfig>(KV_KEY)
    return normalizeConfig(fromDb)
  }

  if (!globalStore.autoReplyConfig) {
    globalStore.autoReplyConfig = await readFromDisk()
  }
  return globalStore.autoReplyConfig
}

async function persistConfig(config: AutoReplyConfig) {
  if (hasDatabase()) {
    await writeKv(KV_KEY, config)
    globalStore.autoReplyConfig = config
    return
  }

  globalStore.autoReplyConfig = config
  const write = async () => {
    await writeTextFile(dataFile(), JSON.stringify(config, null, 2))
  }

  globalStore.autoReplyWriteQueue = (globalStore.autoReplyWriteQueue ?? Promise.resolve())
    .then(write)
    .catch(() => {
      // Keep memory config even if disk write fails.
    })

  await globalStore.autoReplyWriteQueue
}

export async function getAutoReplyConfig(): Promise<AutoReplyConfig> {
  return loadConfig()
}

export async function getCustomerQuickReplies(): Promise<CustomerQuickReply[]> {
  const config = await loadConfig()
  return config.rules
    .filter((rule) => rule.triggerText.trim())
    .map((rule) => ({
      id: rule.triggerId,
      label: rule.label.trim() || rule.triggerText,
      text: rule.triggerText.trim(),
    }))
}

export async function saveAutoReplyConfig(
  input: Partial<AutoReplyConfig> & { rules?: LegacyAutoReplyRule[] },
): Promise<AutoReplyConfig> {
  const existing = await loadConfig()
  const next = normalizeConfig({
    senderName: input.senderName ?? existing.senderName,
    rules: (input.rules ?? existing.rules).map((rule) => ({
      triggerId: String(rule.triggerId ?? ''),
      label: rule.label,
      triggerText: rule.triggerText,
      replies: normalizeReplies(rule),
      enabled: rule.enabled,
    })),
  })
  await persistConfig(next)
  return next
}

export async function findAutoReplyForMessage(
  content: string,
): Promise<{ replies: string[]; senderName: string } | null> {
  const normalized = content.trim().toLowerCase()
  if (!normalized) return null

  const config = await loadConfig()
  const match = config.rules.find(
    (rule) =>
      rule.enabled &&
      rule.triggerText.trim() &&
      rule.replies.some((reply) => reply.trim()) &&
      rule.triggerText.trim().toLowerCase() === normalized,
  )

  if (!match) return null

  const profile = await getAdminProfile()
  return {
    replies: match.replies.map((reply) => reply.trim()).filter(Boolean),
    senderName: profile.name || config.senderName,
  }
}
