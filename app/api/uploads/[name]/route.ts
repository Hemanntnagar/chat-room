import { readUpload } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ name: string }>
}

function guessContentType(fileName: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.zip')) return 'application/zip'
  return 'application/octet-stream'
}

export async function GET(_request: Request, context: RouteContext) {
  const { name } = await context.params
  let decoded = name
  try {
    decoded = decodeURIComponent(name)
  } catch {
    decoded = name
  }
  // Prefer the decoded path; if that misses, try the raw param (some hosts double-encode).
  const file =
    (await readUpload(decoded)) ||
    (decoded !== name ? await readUpload(name) : null) ||
    (decoded.includes('%')
      ? await readUpload(decoded.replace(/%20/g, ' '))
      : null)
  if (!file) {
    return Response.json({ error: 'File not found' }, { status: 404 })
  }

  const originalName = decoded.replace(/^\d+-[a-f0-9]+-/, '').replace(/%20/g, ' ')
  const contentType =
    'mimeType' in file && typeof file.mimeType === 'string' && file.mimeType
      ? file.mimeType
      : guessContentType(decoded)

  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${originalName.replace(/"/g, '')}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
