import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getAdminProfile } from '@/lib/admin-profile'
import {
  CUSTOMER_QUICK_REPLIES,
  HUB_NAME,
  type AutoReplyConfig,
  type AutoReplyRule,
  type CustomerQuickReplyId,
} from '@/lib/chat-messages'

type GlobalAutoReplyStore = {
  autoReplyConfig?: AutoReplyConfig
  autoReplyWriteQueue?: Promise<void>
}

const globalStore = globalThis as typeof globalThis & GlobalAutoReplyStore
const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'auto-replies.json')

function defaultRules(): AutoReplyRule[] {
  return CUSTOMER_QUICK_REPLIES.map((item) => ({
    triggerId: item.id,
    triggerText: item.text,
    reply: '',
    enabled: false,
  }))
}

function normalizeConfig(input?: Partial<AutoReplyConfig> | null): AutoReplyConfig {
  const byId = new Map(
    (input?.rules ?? []).map((rule) => [rule.triggerId, rule] as const),
  )

  return {
    senderName: input?.senderName?.trim() || HUB_NAME,
    rules: CUSTOMER_QUICK_REPLIES.map((item) => {
      const existing = byId.get(item.id)
      return {
        triggerId: item.id,
        triggerText: item.text,
        reply: existing?.reply?.trim() ?? '',
        enabled: Boolean(existing?.enabled && existing.reply?.trim()),
      }
    }),
  }
}

async function readFromDisk(): Promise<AutoReplyConfig> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as AutoReplyConfig
    return normalizeConfig(parsed)
  } catch {
    return normalizeConfig()
  }
}

async function ensureConfig(): Promise<AutoReplyConfig> {
  if (!globalStore.autoReplyConfig) {
    globalStore.autoReplyConfig = await readFromDisk()
  }
  return globalStore.autoReplyConfig
}

async function persistConfig(config: AutoReplyConfig) {
  const write = async () => {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(DATA_FILE, JSON.stringify(config, null, 2), 'utf8')
  }

  globalStore.autoReplyWriteQueue = (globalStore.autoReplyWriteQueue ?? Promise.resolve())
    .then(write)
    .catch(() => {
      // Keep memory config even if disk write fails.
    })

  await globalStore.autoReplyWriteQueue
}

export async function getAutoReplyConfig(): Promise<AutoReplyConfig> {
  return ensureConfig()
}

export async function saveAutoReplyConfig(
  input: Partial<AutoReplyConfig>,
): Promise<AutoReplyConfig> {
  const next = normalizeConfig({
    senderName: input.senderName,
    rules: (input.rules ?? defaultRules()).map((rule) => ({
      triggerId: rule.triggerId as CustomerQuickReplyId,
      triggerText: rule.triggerText,
      reply: rule.reply,
      enabled: rule.enabled,
    })),
  })
  globalStore.autoReplyConfig = next
  await persistConfig(next)
  return next
}

export async function findAutoReplyForMessage(
  content: string,
): Promise<{ reply: string; senderName: string } | null> {
  const normalized = content.trim().toLowerCase()
  if (!normalized) return null

  const config = await ensureConfig()
  const match = config.rules.find(
    (rule) =>
      rule.enabled &&
      rule.reply.trim() &&
      rule.triggerText.trim().toLowerCase() === normalized,
  )

  if (!match) return null

  const profile = await getAdminProfile()
  return {
    reply: match.reply.trim(),
    senderName: profile.name || config.senderName,
  }
}
