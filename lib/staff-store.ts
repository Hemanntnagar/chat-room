import path from 'node:path'
import {
  getConversation,
  listConversationsForStaff,
  setConversationAssignedStaff,
} from '@/lib/chat-store'
import { hasDatabase, readKv, writeKv } from '@/lib/db'
import { getDataDir, readTextFile, writeTextFile } from '@/lib/runtime-fs'

export type StaffMember = {
  /** Login id (unique). */
  id: string
  name: string
  password: string
  assignedCustomerId: string | null
  createdAt: number
}

export type StaffPublic = {
  id: string
  name: string
  assignedCustomerId: string | null
  createdAt: number
}

type StaffStoreData = {
  staff: Record<string, StaffMember>
  /** Next index for round-robin auto-assignment of unassigned chats. */
  autoAssignIndex?: number
}

type GlobalStaffStore = {
  staffStoreData?: StaffStoreData
  staffStoreWriteQueue?: Promise<void>
}

const KV_KEY = 'staff'
const globalStore = globalThis as typeof globalThis & GlobalStaffStore

function dataFile() {
  return path.join(getDataDir(), 'staff.json')
}

function emptyStore(): StaffStoreData {
  return { staff: {}, autoAssignIndex: 0 }
}

function normalizeStaffId(id: string) {
  return id.trim().toLowerCase()
}

function normalizeStore(input: unknown): StaffStoreData {
  const parsed = input as StaffStoreData | null
  if (!parsed?.staff || typeof parsed.staff !== 'object') {
    return emptyStore()
  }
  return {
    staff: parsed.staff,
    autoAssignIndex:
      typeof parsed.autoAssignIndex === 'number' && parsed.autoAssignIndex >= 0
        ? parsed.autoAssignIndex
        : 0,
  }
}

function toPublic(member: StaffMember): StaffPublic {
  return {
    id: member.id,
    name: member.name,
    assignedCustomerId: member.assignedCustomerId,
    createdAt: member.createdAt,
  }
}

async function readFromDisk(): Promise<StaffStoreData> {
  const raw = await readTextFile(dataFile())
  if (!raw) return emptyStore()
  try {
    return normalizeStore(JSON.parse(raw))
  } catch {
    return emptyStore()
  }
}

async function loadStore(): Promise<StaffStoreData> {
  if (hasDatabase()) {
    const fromDb = await readKv<StaffStoreData>(KV_KEY)
    return normalizeStore(fromDb)
  }

  if (!globalStore.staffStoreData) {
    globalStore.staffStoreData = await readFromDisk()
  }
  return globalStore.staffStoreData
}

async function persistStore(data: StaffStoreData) {
  if (hasDatabase()) {
    await writeKv(KV_KEY, data)
    globalStore.staffStoreData = data
    return
  }

  globalStore.staffStoreData = data
  const write = async () => {
    await writeTextFile(dataFile(), JSON.stringify(data, null, 2))
  }

  globalStore.staffStoreWriteQueue = (globalStore.staffStoreWriteQueue ?? Promise.resolve())
    .then(write)
    .catch(() => {
      // Keep memory store even if disk write fails.
    })

  await globalStore.staffStoreWriteQueue
}

/** Pick the next staff id in stable id order (round-robin). */
export async function advanceStaffRoundRobin(): Promise<string | null> {
  const store = await loadStore()
  const staffIds = Object.keys(store.staff).sort((a, b) => a.localeCompare(b))
  if (staffIds.length === 0) return null

  const index = store.autoAssignIndex ?? 0
  const staffId = staffIds[index % staffIds.length] ?? null
  if (!staffId) return null

  store.autoAssignIndex = (index + 1) % staffIds.length
  await persistStore(store)
  return staffId
}

export async function listStaff(): Promise<StaffPublic[]> {
  const store = await loadStore()
  return Object.values(store.staff)
    .map(toPublic)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function getStaff(staffId: string): Promise<StaffMember | null> {
  const id = normalizeStaffId(staffId)
  if (!id) return null
  const store = await loadStore()
  return store.staff[id] ?? null
}

export async function verifyStaffLogin(
  staffId: string,
  password: string,
): Promise<StaffPublic | null> {
  const member = await getStaff(staffId)
  if (!member) return null
  if (member.password !== password) return null
  return toPublic(member)
}

export async function createStaff(input: {
  id: string
  name: string
  password: string
}): Promise<StaffPublic> {
  const id = normalizeStaffId(input.id)
  const name = input.name.trim()
  const password = input.password.trim()

  if (!id) throw new Error('Staff id is required')
  if (!/^[a-z0-9_-]{2,32}$/.test(id)) {
    throw new Error('Staff id must be 2–32 characters (letters, numbers, _ or -)')
  }
  if (!name) throw new Error('Display name is required')
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters')
  }

  const store = await loadStore()
  if (store.staff[id]) {
    throw new Error('A staff member with this id already exists')
  }

  const member: StaffMember = {
    id,
    name,
    password,
    assignedCustomerId: null,
    createdAt: Date.now(),
  }
  store.staff[id] = member
  await persistStore(store)
  return toPublic(member)
}

export async function updateStaff(
  staffId: string,
  input: Partial<{ name: string; password: string }>,
): Promise<StaffPublic | null> {
  const id = normalizeStaffId(staffId)
  const store = await loadStore()
  const current = store.staff[id]
  if (!current) return null

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('Display name is required')
    current.name = name
  }
  if (input.password !== undefined) {
    const password = input.password.trim()
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters')
    }
    current.password = password
  }

  store.staff[id] = current
  await persistStore(store)
  return toPublic(current)
}

export async function deleteStaff(staffId: string): Promise<boolean> {
  const id = normalizeStaffId(staffId)
  const store = await loadStore()
  const member = store.staff[id]
  if (!member) return false

  const assigned = await listConversationsForStaff(id)
  for (const summary of assigned) {
    await setConversationAssignedStaff(summary.customerId, null)
  }

  delete store.staff[id]
  await persistStore(store)
  return true
}

/** Assign a customer chat to a staff member (or unassign when customerId is null). */
export async function assignChatToStaff(
  staffId: string,
  customerId: string | null,
): Promise<{ staff: StaffPublic; previousCustomerId: string | null }> {
  const id = normalizeStaffId(staffId)
  const store = await loadStore()
  const member = store.staff[id]
  if (!member) throw new Error('Staff member not found')

  const nextCustomerId = customerId?.trim() || null
  const previousCustomerId = member.assignedCustomerId

  if (!nextCustomerId) {
    if (previousCustomerId) {
      const conversation = await getConversation(previousCustomerId)
      if (conversation?.assignedStaffId === id) {
        await setConversationAssignedStaff(previousCustomerId, null)
      }
      member.assignedCustomerId = null
      store.staff[id] = member
      await persistStore(store)
    }
    return { staff: toPublic(member), previousCustomerId }
  }

  const conversation = await getConversation(nextCustomerId)
  if (!conversation) throw new Error('Customer chat not found')

  if (conversation.assignedStaffId && conversation.assignedStaffId !== id) {
    const other = store.staff[conversation.assignedStaffId]
    if (other?.assignedCustomerId === nextCustomerId) {
      other.assignedCustomerId = null
      store.staff[other.id] = other
    }
  }

  await setConversationAssignedStaff(nextCustomerId, id)
  member.assignedCustomerId = nextCustomerId
  store.staff[id] = member
  await persistStore(store)
  return { staff: toPublic(member), previousCustomerId }
}

/** Assign by customer: set which staff owns this chat (admin reassignment). */
export async function assignStaffToCustomer(
  customerId: string,
  staffId: string | null,
): Promise<StaffPublic | null> {
  const trimmedCustomerId = customerId.trim()
  if (!trimmedCustomerId) throw new Error('customerId is required')

  if (!staffId?.trim()) {
    const store = await loadStore()
    const conversation = await getConversation(trimmedCustomerId)
    const previousStaffId = conversation?.assignedStaffId
    if (previousStaffId && store.staff[previousStaffId]) {
      const previous = store.staff[previousStaffId]
      if (previous.assignedCustomerId === trimmedCustomerId) {
        previous.assignedCustomerId = null
        store.staff[previousStaffId] = previous
        await persistStore(store)
      }
    }
    await setConversationAssignedStaff(trimmedCustomerId, null)
    return null
  }

  const { staff } = await assignChatToStaff(staffId, trimmedCustomerId)
  return staff
}
