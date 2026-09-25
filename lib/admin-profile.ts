import path from 'node:path'
import { HUB_NAME, type AdminProfile } from '@/lib/chat-messages'
import { hasDatabase, readKv, writeKv } from '@/lib/db'
import { getDataDir, readTextFile, writeTextFile } from '@/lib/runtime-fs'

type GlobalAdminProfileStore = {
  adminProfileData?: AdminProfile
  adminProfileWriteQueue?: Promise<void>
}

const KV_KEY = 'admin-profile'
const globalStore = globalThis as typeof globalThis & GlobalAdminProfileStore

function dataFile() {
  return path.join(getDataDir(), 'admin-profile.json')
}

function normalizeProfile(input?: Partial<AdminProfile> | null): AdminProfile {
  const name = input?.name?.trim() || HUB_NAME
  const raw = input?.imageUrl
  const imageUrl = typeof raw === 'string' && raw.trim() ? raw.trim() : null
  return {
    name,
    imageUrl,
  }
}

async function readFromDisk(): Promise<AdminProfile> {
  const raw = await readTextFile(dataFile())
  if (!raw) return normalizeProfile()
  try {
    return normalizeProfile(JSON.parse(raw) as AdminProfile)
  } catch {
    return normalizeProfile()
  }
}

async function loadProfile(): Promise<AdminProfile> {
  if (hasDatabase()) {
    const fromDb = await readKv<AdminProfile>(KV_KEY)
    return normalizeProfile(fromDb)
  }

  if (!globalStore.adminProfileData) {
    globalStore.adminProfileData = await readFromDisk()
  }
  return globalStore.adminProfileData
}

async function persistProfile(profile: AdminProfile) {
  if (hasDatabase()) {
    await writeKv(KV_KEY, profile)
    globalStore.adminProfileData = profile
    return
  }

  globalStore.adminProfileData = profile
  const write = async () => {
    await writeTextFile(dataFile(), JSON.stringify(profile, null, 2))
  }

  globalStore.adminProfileWriteQueue = (globalStore.adminProfileWriteQueue ?? Promise.resolve())
    .then(write)
    .catch(() => {
      // Keep memory profile even if disk write fails.
    })

  await globalStore.adminProfileWriteQueue
}

export async function getAdminProfile(): Promise<AdminProfile> {
  return loadProfile()
}

export async function saveAdminProfile(
  input: Partial<AdminProfile>,
): Promise<AdminProfile> {
  const current = await loadProfile()
  const next = normalizeProfile({
    name: input.name ?? current.name,
    imageUrl:
      input.imageUrl === undefined ? current.imageUrl : input.imageUrl,
  })
  await persistProfile(next)
  return next
}
