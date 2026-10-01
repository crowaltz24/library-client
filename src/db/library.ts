import { openDatabase, requestResult } from './database'
import type { Book, LibraryEntry, LibraryItem, ReadingStatus } from '../types'

export async function listLibrary(): Promise<LibraryItem[]> {
  const database = await openDatabase()
  const tx = database.transaction(['books', 'library_entries'], 'readonly')
  const [books, entries] = await Promise.all([
    requestResult<Book[]>(tx.objectStore('books').getAll()),
    requestResult<LibraryEntry[]>(tx.objectStore('library_entries').getAll()),
  ])
  database.close()
  const booksById = new Map(books.filter((book) => !book.deletedAt).map((book) => [book.id, book]))
  return entries.filter((entry) => !entry.deletedAt).flatMap((entry) => {
    const book = booksById.get(entry.bookId)
    return book ? [{ ...entry, book }] : []
  }).sort((a, b) => a.book.title.localeCompare(b.book.title))
}

export async function searchLibrary(query: string): Promise<LibraryItem[]> {
  const normalized = query.trim().toLocaleLowerCase()
  const items = await listLibrary()
  if (!normalized) return items
  return items.filter(({ book }) => [book.title, book.author, book.isbn].some((value) => value?.toLocaleLowerCase().includes(normalized)))
}

export async function getBook(bookId: string): Promise<Book | undefined> {
  const database = await openDatabase()
  const book = await requestResult<Book | undefined>(database.transaction('books').objectStore('books').get(bookId))
  database.close()
  return book
}

export async function getEntry(entryId: string): Promise<LibraryEntry | undefined> {
  const database = await openDatabase()
  const entry = await requestResult<LibraryEntry | undefined>(database.transaction('library_entries').objectStore('library_entries').get(entryId))
  database.close()
  return entry
}

export async function putBook(book: Book): Promise<void> {
  const database = await openDatabase()
  await requestResult(database.transaction('books', 'readwrite').objectStore('books').put(book))
  database.close()
}

export async function putEntry(entry: LibraryEntry): Promise<void> {
  const database = await openDatabase()
  await requestResult(database.transaction('library_entries', 'readwrite').objectStore('library_entries').put(entry))
  database.close()
}

export async function deleteBook(bookId: string): Promise<void> {
  const database = await openDatabase()
  await requestResult(database.transaction('books', 'readwrite').objectStore('books').delete(bookId))
  database.close()
}

export async function deleteEntry(entryId: string): Promise<void> {
  const database = await openDatabase()
  await requestResult(database.transaction('library_entries', 'readwrite').objectStore('library_entries').delete(entryId))
  database.close()
}

export async function updateEntry(entryId: string, changes: Partial<LibraryEntry>): Promise<LibraryEntry> {
  const current = await getEntry(entryId)
  if (!current) throw new Error('Library entry not found')
  const updated = { ...current, ...changes, updatedAt: new Date().toISOString() }
  await putEntry(updated)
  return updated
}

export async function tombstoneEntry(entryId: string): Promise<LibraryEntry> {
  return updateEntry(entryId, { deletedAt: new Date().toISOString() })
}

export function makeBook(title: string, author: string, extra: Partial<Book> = {}): Book {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title, author, createdAt: now, updatedAt: now, ...extra }
}

export function makeEntry(bookId: string, status: ReadingStatus = 'unread'): LibraryEntry {
  return { id: crypto.randomUUID(), bookId, readingStatus: status, updatedAt: new Date().toISOString() }
}
