import path from 'node:path'
import { randomBytes } from 'node:crypto'
import {
  getDataDir,
  readBinaryFile,
  writeBinaryFile,
} from '@/lib/runtime-fs'

const MAX_FILE_BYTES = 8 * 1024 * 1024
/** Prefer data-URL fallback under this size when disk is unavailable. */
const DATA_URL_FALLBACK_MAX = 1.5 * 1024 * 1024

export { MAX_FILE_BYTES }

function uploadDir() {
  return path.join(getDataDir(), 'uploads')
}

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

  const safeName = sanitizeBaseName(file.name || 'file')
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const storedName = `${id}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'application/octet-stream'

  const saved = await writeBinaryFile(path.join(uploadDir(), storedName), buffer)
  if (saved) {
    return {
      fileName: file.name || safeName,
      fileUrl: `/api/uploads/${encodeURIComponent(storedName)}`,
      mimeType,
      size: file.size,
    }
  }

  // Serverless/read-only FS: embed small files so chat still works.
  if (file.size <= DATA_URL_FALLBACK_MAX) {
    return {
      fileName: file.name || safeName,
      fileUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      mimeType,
      size: file.size,
    }
  }

  throw new Error(
    'Could not store that file on this host. Try a smaller image (under 1.5 MB).',
  )
}

export async function readUpload(storedName: string) {
  const safe = path.basename(storedName)
  if (!safe || safe !== storedName || storedName.includes('..')) {
    return null
  }
  const data = await readBinaryFile(path.join(uploadDir(), safe))
  if (!data) return null
  return { data, fileName: safe }
}
