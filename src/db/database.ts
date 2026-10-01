import type { Book, LibraryEntry, PendingChange, SyncState } from '../types'

export const DB_NAME = 'library-client'
export const DB_VERSION = 1

export interface LibraryDatabase extends IDBDatabase {}

export function openDatabase(): Promise<LibraryDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      const books = database.createObjectStore('books', { keyPath: 'id' })
      books.createIndex('title', 'title')
      books.createIndex('author', 'author')
      database.createObjectStore('library_entries', { keyPath: 'id' }).createIndex('bookId', 'bookId')
      database.createObjectStore('pending_changes', { keyPath: 'id', autoIncrement: true })
      database.createObjectStore('sync_state', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function transaction<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const database = await openDatabase()
  const tx = database.transaction(stores, mode)
  const result = await work(tx)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  database.close()
  return result
}

export type StoreValue = Book | LibraryEntry | PendingChange | SyncState
