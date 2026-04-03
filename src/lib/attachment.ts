export interface AttachmentData {
  fileName: string
  mimeType: string
  data: string
}

export function serializeAttachment(fileName: string, mimeType: string, data: string): string {
  return JSON.stringify({ fileName, mimeType, data })
}

export function parseAttachment(jsonString: string | null | undefined): AttachmentData | null {
  if (!jsonString) return null
  try {
    const parsed = JSON.parse(jsonString)
    if (
      typeof parsed.fileName === 'string' &&
      typeof parsed.mimeType === 'string' &&
      typeof parsed.data === 'string'
    ) {
      return parsed as AttachmentData
    }
    return null
  } catch {
    return null
  }
}
