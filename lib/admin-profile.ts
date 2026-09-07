import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { HUB_NAME, type AdminProfile } from '@/lib/chat-messages'

type GlobalAdminProfileStore = {
  adminProfileData?: AdminProfile
  adminProfileWriteQueue?: Promise<void>
}

const globalStore = globalThis as typeof globalThis & GlobalAdminProfileStore
const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'admin-profile.json')

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
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as AdminProfile
    return normalizeProfile(parsed)
  } catch {
    return normalizeProfile()
  }
}

async function ensureProfile(): Promise<AdminProfile> {
  if (!globalStore.adminProfileData) {
    globalStore.adminProfileData = await readFromDisk()
  }
  return globalStore.adminProfileData
}

async function persistProfile(profile: AdminProfile) {
  const write = async () => {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(DATA_FILE, JSON.stringify(profile, null, 2), 'utf8')
  }

  globalStore.adminProfileWriteQueue = (globalStore.adminProfileWriteQueue ?? Promise.resolve())
    .then(write)
    .catch(() => {
      // Keep memory profile even if disk write fails.
    })

  await globalStore.adminProfileWriteQueue
}

export async function getAdminProfile(): Promise<AdminProfile> {
  return ensureProfile()
}

export async function saveAdminProfile(
  input: Partial<AdminProfile>,
): Promise<AdminProfile> {
  const current = await ensureProfile()
  const next = normalizeProfile({
    name: input.name ?? current.name,
    imageUrl:
      input.imageUrl === undefined ? current.imageUrl : input.imageUrl,
  })
  globalStore.adminProfileData = next
  await persistProfile(next)
  return next
}
