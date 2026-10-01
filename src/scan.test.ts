import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { identifyImage } from './api/scan'
import { DB_NAME } from './db/database'
import { listPending } from './db/outbox'
import { listLibrary, searchLibrary } from './db/library'
import { addScannedBook, metadataToScannedBook } from './scan'

beforeEach(async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } })
  await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(DB_NAME); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) })
})

describe('scanned book workflow', () => {
  it('maps a successful identification response into local metadata', () => {
    const result = metadataToScannedBook('9780261103303', { title: 'The Hobbit', authors: ['J.R.R. Tolkien'] })
    expect(result.metadata.title).toBe('The Hobbit')
    expect(result.isbn).toBe('9780261103303')
  })

  it('does not save until confirmation, then creates local entry and outbox mutation', async () => {
    expect(await listLibrary()).toHaveLength(0)
    await addScannedBook(metadataToScannedBook('9780261103303', { title: 'The Hobbit', authors: ['J.R.R. Tolkien'], isbn13: '9780261103303' }))
    expect((await searchLibrary('Hobbit'))[0].book.author).toBe('J.R.R. Tolkien')
    expect((await listPending())).toHaveLength(1)
  })

  it('surfaces identification errors without persisting a book', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ detail: 'No barcode found' }), { status: 400 }))
    await expect(identifyImage(new Blob(['image']))).rejects.toThrow('No barcode found')
    expect(await listLibrary()).toHaveLength(0)
    fetchMock.mockRestore()
  })
})
