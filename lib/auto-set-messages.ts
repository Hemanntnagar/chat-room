import path from 'node:path'
import {
  DEFAULT_AUTO_SET_MESSAGES,
  type AutoSetMessages,
} from '@/lib/chat-messages'
import { hasDatabase, readKv, writeKv } from '@/lib/db'
import { getDataDir, readTextFile, writeTextFile } from '@/lib/runtime-fs'

type GlobalAutoSetStore = {
  autoSetMessages?: AutoSetMessages
  autoSetWriteQueue?: Promise<void>
}

const KV_KEY = 'auto-set-messages'
const globalStore = globalThis as typeof globalThis & GlobalAutoSetStore

function dataFile() {
  return path.join(getDataDir(), 'auto-set-messages.json')
}

function normalizeConfig(input?: Partial<AutoSetMessages> | null): AutoSetMessages {
  const linksText =
    typeof input?.linksText === 'string' && input.linksText.trim()
      ? input.linksText
      : DEFAULT_AUTO_SET_MESSAGES.linksText
  const welcomeText =
    typeof input?.welcomeText === 'string' && input.welcomeText.trim()
      ? input.welcomeText
      : DEFAULT_AUTO_SET_MESSAGES.welcomeText
  const voiceText =
    typeof input?.voiceText === 'string' && input.voiceText.trim()
      ? input.voiceText
      : DEFAULT_AUTO_SET_MESSAGES.voiceText
  const rawDuration = Number(input?.voiceDurationSec)
  const voiceDurationSec = Number.isFinite(rawDuration)
    ? Math.max(1, Math.min(120, Math.round(rawDuration)))
    : DEFAULT_AUTO_SET_MESSAGES.voiceDurationSec

  return {
    linksText,
    welcomeText,
    voiceText,
    voiceDurationSec,
  }
}

async function readFromDisk(): Promise<AutoSetMessages> {
  const raw = await readTextFile(dataFile())
  if (!raw) return normalizeConfig()
  try {
    return normalizeConfig(JSON.parse(raw) as Partial<AutoSetMessages>)
  } catch {
    return normalizeConfig()
  }
}

async function loadConfig(): Promise<AutoSetMessages> {
  if (hasDatabase()) {
    const fromDb = await readKv<Partial<AutoSetMessages>>(KV_KEY)
    return normalizeConfig(fromDb)
  }

  if (!globalStore.autoSetMessages) {
    globalStore.autoSetMessages = await readFromDisk()
  }
  return globalStore.autoSetMessages
}

async function persistConfig(config: AutoSetMessages) {
  if (hasDatabase()) {
    await writeKv(KV_KEY, config)
    globalStore.autoSetMessages = config
    return
  }

  globalStore.autoSetMessages = config
  const write = async () => {
    await writeTextFile(dataFile(), JSON.stringify(config, null, 2))
  }

  globalStore.autoSetWriteQueue = (globalStore.autoSetWriteQueue ?? Promise.resolve())
    .then(write)
    .catch(() => {
      // Keep memory config even if disk write fails.
    })

  await globalStore.autoSetWriteQueue
}

export async function getAutoSetMessages(): Promise<AutoSetMessages> {
  return loadConfig()
}

export async function saveAutoSetMessages(
  input: Partial<AutoSetMessages>,
): Promise<AutoSetMessages> {
  const existing = await loadConfig()
  const next = normalizeConfig({
    linksText: input.linksText ?? existing.linksText,
    welcomeText: input.welcomeText ?? existing.welcomeText,
    voiceText: input.voiceText ?? existing.voiceText,
    voiceDurationSec:
      input.voiceDurationSec === undefined
        ? existing.voiceDurationSec
        : input.voiceDurationSec,
  })
  await persistConfig(next)
  return next
}
