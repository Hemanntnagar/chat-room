import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Local/dev: ./data
 * Vercel/Lambda: /tmp (the only writable path in serverless)
 */
export function getDataDir() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'chat-room-data')
  }
  return path.join(process.cwd(), 'data')
}

export async function ensureDir(dir: string): Promise<boolean> {
  try {
    await mkdir(dir, { recursive: true })
    return true
  } catch {
    return false
  }
}

export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

export async function writeTextFile(filePath: string, contents: string): Promise<boolean> {
  const ready = await ensureDir(path.dirname(filePath))
  if (!ready) return false
  try {
    await writeFile(filePath, contents, 'utf8')
    return true
  } catch {
    return false
  }
}

export async function writeBinaryFile(filePath: string, data: Buffer): Promise<boolean> {
  const ready = await ensureDir(path.dirname(filePath))
  if (!ready) return false
  try {
    await writeFile(filePath, data)
    return true
  } catch {
    return false
  }
}

export async function readBinaryFile(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath)
  } catch {
    return null
  }
}
