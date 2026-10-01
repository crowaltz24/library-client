export type ReadingStatus = 'unread' | 'reading' | 'finished'

export interface Book {
  id: string
  title: string
  author: string
  isbn?: string
  coverUrl?: string
  createdAt: string
  updatedAt: string
  version?: number
  deletedAt?: string
}

export interface LibraryEntry {
  id: string
  bookId: string
  readingStatus: ReadingStatus
  rating?: number
  notes?: string
  dateStarted?: string
  dateFinished?: string
  updatedAt: string
  version?: number
  deletedAt?: string
}

export interface LibraryItem extends LibraryEntry {
  book: Book
}

export type MutationOperation = 'create' | 'update' | 'delete'

export interface PendingChange {
  id?: number
  entityType: 'book' | 'library_entry'
  entityId: string
  operation: MutationOperation
  payload: unknown
  clientMutationId: string
  createdAt: string
  retryCount: number
  lastError?: string
}

export interface SyncState {
  id: 'default'
  revision: number
  lastSyncedAt?: string
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error'
  pending: number
  message?: string
}
