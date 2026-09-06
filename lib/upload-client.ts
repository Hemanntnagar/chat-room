export async function uploadChatFile(file: File) {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: form,
  })

  const data = (await response.json().catch(() => null)) as
    | { fileName?: string; fileUrl?: string; mimeType?: string; error?: string }
    | null

  if (!response.ok || !data?.fileUrl) {
    throw new Error(data?.error || 'Upload failed. Try another file.')
  }

  return {
    fileName: data.fileName || file.name,
    fileUrl: data.fileUrl,
    mimeType: data.mimeType || file.type || 'application/octet-stream',
  }
}
