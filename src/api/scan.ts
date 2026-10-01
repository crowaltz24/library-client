import { request } from './client'

export interface IdentifiedMetadata {
  isbn10?: string
  isbn13?: string
  title?: string
  authors?: string[]
  publisher?: string
  publication_date?: string
  description?: string
  subjects?: string[]
  cover_url?: string
  metadata_source?: string
  [key: string]: unknown
}

export interface IdentifiedBook {
  isbn: string
  format: string
  metadata_found: boolean
  metadata?: IdentifiedMetadata
  error?: string
}

export interface IdentificationResponse {
  detected: boolean
  books: IdentifiedBook[]
}

export function identifyImage(image: Blob, filename?: string): Promise<IdentificationResponse> {
  const form = new FormData()
  const resolvedFilename = filename || (image instanceof File ? image.name : 'book-capture.jpg')
  form.append('image', image, resolvedFilename)
  return request<IdentificationResponse>('/api/scan/identify', { method: 'POST', body: form })
}
