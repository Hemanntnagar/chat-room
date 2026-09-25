import path from 'node:path'
import { getAdminProfile } from '@/lib/admin-profile'
import {
  CUSTOMER_QUICK_REPLIES,
  HUB_NAME,
  type AutoReplyConfig,
  type AutoReplyRule,
  type CustomerQuickReplyId,
} from '@/lib/chat-messages'
import { hasDatabase, readKv, writeKv } from '@/lib/db'
import { getDataDir, readTextFile, writeTextFile } from '@/lib/runtime-fs'

type GlobalAutoReplyStore = {
  autoReplyConfig?: AutoReplyConfig
  autoReplyWriteQueue?: Promise<void>
}

/** Older saved configs used a single `reply` string. */
type LegacyAutoReplyRule = Partial<AutoReplyRule> & {
  triggerId?: string
  reply?: string
  replies?: string[]
}

type LegacyAutoReplyConfig = {
  senderName?: string
  rules?: LegacyAutoReplyRule[]
}

const KV_KEY = 'auto-replies'
const globalStore = globalThis as typeof globalThis & GlobalAutoReplyStore

function dataFile() {
  return path.join(getDataDir(), 'auto-replies.json')
}

function defaultRules(): AutoReplyRule[] {
  return CUSTOMER_QUICK_REPLIES.map((item) => ({
    triggerId: item.id,
    triggerText: item.text,
    replies: [''],
    enabled: false,
  }))
}

function normalizeReplies(rule?: LegacyAutoReplyRule | null): string[] {
  const fromList = (rule?.replies ?? [])
    .map((item) => String(item ?? ''))
    .filter((item, index, list) => item.trim() || index === 0)

  if (fromList.length > 0) return fromList

  const legacy = rule?.reply
  if (typeof legacy === 'string') return [legacy]

  return ['']
}

function normalizeConfig(input?: LegacyAutoReplyConfig | null): AutoReplyConfig {
  const byId = new Map(
    (input?.rules ?? []).map((rule) => [rule.triggerId, rule] as const),
  )

  return {
    senderName: input?.senderName?.trim() || HUB_NAME,
    rules: CUSTOMER_QUICK_REPLIES.map((item) => {
      const existing = byId.get(item.id)
      const replies = normalizeReplies(existing)
      const hasContent = replies.some((reply) => reply.trim())
      return {
        triggerId: item.id,
        triggerText: item.text,
        replies,
        enabled: Boolean(existing?.enabled && hasContent),
      }
    }),
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

export async function saveAutoReplyConfig(
  input: Partial<AutoReplyConfig> & { rules?: LegacyAutoReplyRule[] },
): Promise<AutoReplyConfig> {
  const existing = await loadConfig()
  const next = normalizeConfig({
    senderName: input.senderName ?? existing.senderName,
    rules: (input.rules ?? existing.rules).map((rule) => ({
      triggerId: rule.triggerId as CustomerQuickReplyId,
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
