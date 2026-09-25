import postgres from 'postgres'

type GlobalDb = {
  chatRoomSql?: ReturnType<typeof postgres>
  chatRoomSchemaReady?: Promise<void>
}

const globalDb = globalThis as typeof globalThis & GlobalDb

export function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    ''
  )
}

export function hasDatabase() {
  return Boolean(getDatabaseUrl())
}

export function hasBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
}

function getSql() {
  const url = getDatabaseUrl()
  if (!url) {
    throw new Error('Database URL is not configured')
  }
  if (!globalDb.chatRoomSql) {
    globalDb.chatRoomSql = postgres(url, {
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    })
  }
  return globalDb.chatRoomSql
}

export async function ensureDbSchema() {
  if (!hasDatabase()) return
  if (!globalDb.chatRoomSchemaReady) {
    globalDb.chatRoomSchemaReady = (async () => {
      const sql = getSql()
      await sql`
        CREATE TABLE IF NOT EXISTS chat_room_kv (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`
        CREATE TABLE IF NOT EXISTS chat_room_uploads (
          name TEXT PRIMARY KEY,
          mime_type TEXT NOT NULL,
          data BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    })().catch((error) => {
      globalDb.chatRoomSchemaReady = undefined
      throw error
    })
  }
  await globalDb.chatRoomSchemaReady
}

export async function readKv<T>(key: string): Promise<T | null> {
  await ensureDbSchema()
  const sql = getSql()
  const rows = await sql<{ value: T }[]>`
    SELECT value FROM chat_room_kv WHERE key = ${key} LIMIT 1
  `
  return rows[0]?.value ?? null
}

export async function writeKv(key: string, value: unknown): Promise<void> {
  await ensureDbSchema()
  const sql = getSql()
  await sql`
    INSERT INTO chat_room_kv (key, value, updated_at)
    VALUES (${key}, ${sql.json(value as postgres.JSONValue)}, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = NOW()
  `
}

export async function saveUploadToDb(
  name: string,
  mimeType: string,
  data: Buffer,
): Promise<void> {
  await ensureDbSchema()
  const sql = getSql()
  await sql`
    INSERT INTO chat_room_uploads (name, mime_type, data, created_at)
    VALUES (${name}, ${mimeType}, ${data}, NOW())
    ON CONFLICT (name) DO UPDATE
    SET mime_type = EXCLUDED.mime_type,
        data = EXCLUDED.data,
        created_at = NOW()
  `
}

export async function readUploadFromDb(name: string): Promise<{
  data: Buffer
  mimeType: string
} | null> {
  await ensureDbSchema()
  const sql = getSql()
  const rows = await sql<{ data: Buffer; mime_type: string }[]>`
    SELECT data, mime_type FROM chat_room_uploads WHERE name = ${name} LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    data: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data),
    mimeType: row.mime_type,
  }
}
