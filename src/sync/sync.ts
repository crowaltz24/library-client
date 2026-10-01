import { pull, push, type RemoteChange } from '../api/sync'
import { deleteBook, deleteEntry, putBook, putEntry } from '../db/library'
import { listPending, markFailed, removePending } from '../db/outbox'
import { getSyncState, setSyncState } from '../db/syncState'
import { openDatabase, requestResult } from '../db/database'
import type { Book, LibraryEntry, SyncStatus } from '../types'

let current: SyncStatus = { state: 'idle', pending: 0 }
let listeners = new Set<(status: SyncStatus) => void>()

function publish(status: SyncStatus): void { current = status; listeners.forEach((listener) => listener(status)) }
export function getSyncStatus(): SyncStatus { return current }
export function subscribeSync(listener: (status: SyncStatus) => void): () => void { listeners.add(listener); return () => listeners.delete(listener) }

async function applyChange(change: RemoteChange, localEntryId?: string): Promise<void> {
  const data = change.payload
  const serverEntryId = String(data.id ?? change.entity_id)
  const localBookId = `${serverEntryId}:book`
  const authors = Array.isArray(data.authors) ? data.authors.filter((author): author is string => typeof author === 'string') : []
  const book: Book = {
    id: localBookId,
    title: typeof data.title === 'string' ? data.title : 'Untitled',
    author: authors.join(', '),
    isbn: typeof data.isbn13 === 'string' ? data.isbn13 : typeof data.isbn10 === 'string' ? data.isbn10 : undefined,
    coverUrl: typeof data.cover_url === 'string' ? data.cover_url : undefined,
    createdAt: String(data.created_at ?? change.created_at),
    updatedAt: String(data.updated_at ?? change.created_at),
    version: change.version,
  }
  const entry: LibraryEntry = {
    id: serverEntryId,
    bookId: localBookId,
    readingStatus: data.reading_status === 'read' ? 'finished' : data.reading_status === 'reading' ? 'reading' : 'unread',
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    dateStarted: typeof data.date_started === 'string' ? data.date_started : undefined,
    dateFinished: typeof data.date_finished === 'string' ? data.date_finished : undefined,
    updatedAt: String(data.updated_at ?? change.created_at),
    version: change.version,
    deletedAt: typeof data.deleted_at === 'string' ? data.deleted_at : undefined,
  }
  if (localEntryId && localEntryId !== serverEntryId) {
    await deleteEntry(localEntryId)
    await deleteBook(`${localEntryId}:book`)
  }
  await putBook(book)
  await putEntry(entry)
}

async function removeAcknowledged(changes: Awaited<ReturnType<typeof listPending>>): Promise<void> {
  for (const change of changes) {
    if (change.id !== undefined) await removePending(change.id)
  }
}

export async function sync(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    publish({ state: 'offline', pending: (await listPending()).length, message: 'Offline' })
    return
  }
  publish({ state: 'syncing', pending: (await listPending()).length })
  const pending = await listPending()
  try {
    const pushed = await push(pending)
    for (const [index, change] of pushed.results.entries()) await applyChange(change, pending[index]?.entityId)
    const state = await getSyncState()
    const response = await pull(state.revision)
    for (const change of response.changes) await applyChange(change)
    const revision = response.revision
    await setSyncState(revision)
    await removeAcknowledged(pending)
    publish({ state: 'idle', pending: (await listPending()).length, message: 'Synced' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    for (const change of pending) await markFailed(change, message)
    publish({ state: 'error', pending: (await listPending()).length, message: typeof navigator !== 'undefined' && navigator.onLine ? 'Sync error' : 'Offline' })
  }
}

export async function clearLocalDatabase(): Promise<void> {
  const database = await openDatabase()
  await Promise.all(['books', 'library_entries', 'pending_changes', 'sync_state'].map((store) => requestResult(database.transaction(store, 'readwrite').objectStore(store).clear())))
  database.close()
}
