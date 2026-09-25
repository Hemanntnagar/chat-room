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

const KV_KEY = 'auto-replies'
const globalStore = globalThis as typeof globalThis & GlobalAutoReplyStore

function dataFile() {
  return path.join(getDataDir(), 'auto-replies.json')
}

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
  const raw = await readTextFile(dataFile())
  if (!raw) return normalizeConfig()
  try {
    return normalizeConfig(JSON.parse(raw) as AutoReplyConfig)
  } catch {
    return normalizeConfig()
  }
}

async function loadConfig(): Promise<AutoReplyConfig> {
  if (hasDatabase()) {
    const fromDb = await readKv<AutoReplyConfig>(KV_KEY)
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
  await persistConfig(next)
  return next
}

export async function findAutoReplyForMessage(
  content: string,
): Promise<{ reply: string; senderName: string } | null> {
  const normalized = content.trim().toLowerCase()
  if (!normalized) return null

  const config = await loadConfig()
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
