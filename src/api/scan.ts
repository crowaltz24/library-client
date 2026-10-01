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

export function identifyImage(image: Blob): Promise<IdentificationResponse> {
  const form = new FormData()
  form.append('image', image, 'book-capture.jpg')
  return request<IdentificationResponse>('/api/scan/identify', { method: 'POST', body: form })
}
