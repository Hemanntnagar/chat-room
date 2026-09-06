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
  const decoded = decodeURIComponent(name)
  const file = await readUpload(decoded)
  if (!file) {
    return Response.json({ error: 'File not found' }, { status: 404 })
  }

  const originalName = decoded.replace(/^\d+-[a-f0-9]+-/, '')
  return new Response(file.data, {
    headers: {
      'Content-Type': guessContentType(decoded),
      'Content-Disposition': `inline; filename="${originalName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
