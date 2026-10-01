import type { IdentifiedMetadata } from './api/scan'
import { enqueue } from './db/outbox'
import { makeBook, makeEntry, putBook, putEntry } from './db/library'
import type { LibraryItem } from './types'

export interface ScannedBook {
  isbn: string
  metadata: IdentifiedMetadata
}

export function metadataToScannedBook(isbn: string, metadata: IdentifiedMetadata): ScannedBook {
  return { isbn, metadata }
}

export async function addScannedBook(scanned: ScannedBook): Promise<LibraryItem> {
  const metadata = scanned.metadata
  const authors = metadata.authors?.filter(Boolean) ?? []
  const book = makeBook(metadata.title?.trim() || `ISBN ${scanned.isbn}`, authors.join(', ') || 'Unknown author', {
    isbn: metadata.isbn13 ?? metadata.isbn10 ?? scanned.isbn,
    coverUrl: metadata.cover_url,
  })
  const entry = makeEntry(book.id)
  await putBook(book)
  await putEntry(entry)
  await enqueue({
    entityType: 'library_entry',
    entityId: entry.id,
    operation: 'create',
    payload: {
      isbn13: metadata.isbn13 ?? (scanned.isbn.length === 13 ? scanned.isbn : undefined),
      isbn10: metadata.isbn10 ?? (scanned.isbn.length === 10 ? scanned.isbn : undefined),
      title: metadata.title,
      authors,
      publisher: metadata.publisher,
      publication_date: metadata.publication_date,
      description: metadata.description,
      subjects: metadata.subjects ?? [],
      cover_url: metadata.cover_url,
      metadata_source: metadata.metadata_source,
      reading_status: 'unread',
    },
  })
  return { ...entry, book }
}
