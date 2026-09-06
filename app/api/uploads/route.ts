import { saveUpload } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid upload body' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required' }, { status: 400 })
  }

  try {
    const uploaded = await saveUpload(file)
    return Response.json(uploaded)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    const status = message.includes('too large') ? 413 : 400
    return Response.json({ error: message }, { status })
  }
}
