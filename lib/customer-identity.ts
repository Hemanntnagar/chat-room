export type CustomerIdentity = {
  id: string
  name: string
  createdAt: number
  /** Once true, the visitor can no longer rename themselves. */
  nameEdited?: boolean
}

export const DEFAULT_CUSTOMER_NAME = 'Guest'
export const CUSTOMER_SESSION_KEY = 'chat-room:customer'
export const CUSTOMER_ID_COOKIE = 'chat_customer_id'
export const CUSTOMER_NAME_COOKIE = 'chat_customer_name'
export const CUSTOMER_NAME_EDITED_COOKIE = 'chat_customer_name_edited'

function canUseBrowser() {
  return typeof window !== 'undefined'
}

function readCookie(name: string): string | null {
  if (!canUseBrowser()) return null
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(name.length + 1))
}

function writeCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 365) {
  if (!canUseBrowser()) return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

function clearCookie(name: string) {
  if (!canUseBrowser()) return
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cust-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function loadCustomerIdentity(): CustomerIdentity | null {
  if (!canUseBrowser()) return null

  try {
    const fromSession = window.sessionStorage.getItem(CUSTOMER_SESSION_KEY)
    if (fromSession) {
      const parsed = JSON.parse(fromSession) as CustomerIdentity
      if (parsed?.id && parsed?.name) {
        const identity: CustomerIdentity = {
          ...parsed,
          nameEdited:
            parsed.nameEdited === true ||
            (parsed.nameEdited == null && parsed.name.trim() !== DEFAULT_CUSTOMER_NAME),
        }
        persistCustomerIdentity(identity)
        return identity
      }
    }
  } catch {
    // fall through to cookies
  }

  const id = readCookie(CUSTOMER_ID_COOKIE)
  const name = readCookie(CUSTOMER_NAME_COOKIE)
  if (id && name) {
    const nameEdited =
      readCookie(CUSTOMER_NAME_EDITED_COOKIE) === '1' || name !== DEFAULT_CUSTOMER_NAME
    const identity: CustomerIdentity = {
      id,
      name,
      createdAt: Date.now(),
      nameEdited,
    }
    try {
      window.sessionStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(identity))
    } catch {
      // ignore
    }
    return identity
  }

  return null
}

export function persistCustomerIdentity(identity: CustomerIdentity) {
  if (!canUseBrowser()) return
  try {
    window.sessionStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(identity))
  } catch {
    // ignore quota errors
  }
  writeCookie(CUSTOMER_ID_COOKIE, identity.id)
  writeCookie(CUSTOMER_NAME_COOKIE, identity.name)
  writeCookie(CUSTOMER_NAME_EDITED_COOKIE, identity.nameEdited ? '1' : '0')
}

export function createCustomerIdentity(name = DEFAULT_CUSTOMER_NAME): CustomerIdentity {
  const trimmed = name.trim() || DEFAULT_CUSTOMER_NAME
  const identity: CustomerIdentity = {
    id: createId(),
    name: trimmed,
    createdAt: Date.now(),
    nameEdited: false,
  }
  persistCustomerIdentity(identity)
  return identity
}

export function canEditCustomerName(identity: CustomerIdentity) {
  return identity.nameEdited !== true
}

export function updateCustomerName(
  identity: CustomerIdentity,
  name: string,
): CustomerIdentity {
  if (!canEditCustomerName(identity)) return identity
  const next: CustomerIdentity = {
    ...identity,
    name: name.trim() || DEFAULT_CUSTOMER_NAME,
    nameEdited: true,
  }
  persistCustomerIdentity(next)
  return next
}

export function clearCustomerIdentity() {
  if (!canUseBrowser()) return
  window.sessionStorage.removeItem(CUSTOMER_SESSION_KEY)
  clearCookie(CUSTOMER_ID_COOKIE)
  clearCookie(CUSTOMER_NAME_COOKIE)
  clearCookie(CUSTOMER_NAME_EDITED_COOKIE)
}
