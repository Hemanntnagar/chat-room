import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads')
const MAX_FILE_BYTES = 8 * 1024 * 1024

export { MAX_FILE_BYTES }

function sanitizeBaseName(name: string) {
  const base = path.basename(name).replace(/[^\w.\- ()[\]]+/g, '_')
  return base.slice(0, 120) || 'file'
}

export async function saveUpload(file: File) {
  if (file.size <= 0) {
    throw new Error('Empty file')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File is too large. Please keep attachments under 8 MB.')
  }

  await mkdir(UPLOAD_DIR, { recursive: true })
  const safeName = sanitizeBaseName(file.name || 'file')
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const storedName = `${id}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer)

  return {
    fileName: file.name || safeName,
    fileUrl: `/api/uploads/${encodeURIComponent(storedName)}`,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  }
}

export async function readUpload(storedName: string) {
  const safe = path.basename(storedName)
  if (!safe || safe !== storedName || storedName.includes('..')) {
    return null
  }
  try {
    const data = await readFile(path.join(UPLOAD_DIR, safe))
    return { data, fileName: safe }
  } catch {
    return null
  }
}
