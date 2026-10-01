import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DB_NAME } from './database'
import { enqueue, listPending } from './outbox'
import { makeBook, makeEntry, putBook, putEntry, searchLibrary, tombstoneEntry, updateEntry } from './library'

describe('local library and outbox', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(DB_NAME); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) })
  })

  it('creates, updates, searches, and tombstones a local entry', async () => {
    const book = makeBook('The Left Hand of Darkness', 'Ursula K. Le Guin', { isbn: '0441478123' })
    const entry = makeEntry(book.id)
    await putBook(book); await putEntry(entry)
    expect((await searchLibrary('darkness'))[0].book.isbn).toBe('0441478123')
    await updateEntry(entry.id, { readingStatus: 'finished', rating: 5 })
    expect((await searchLibrary('ursula'))[0].readingStatus).toBe('finished')
    await tombstoneEntry(entry.id)
    expect(await searchLibrary('darkness')).toHaveLength(0)
  })

  it('keeps local mutations in the outbox', async () => {
    const change = await enqueue({ entityType: 'book', entityId: 'book-1', operation: 'create', payload: { title: 'Dune' } })
    const pending = await listPending()
    expect(change.clientMutationId).toBeTruthy()
    expect(pending).toHaveLength(1)
    expect(pending[0].payload).toEqual({ title: 'Dune' })
  })
})
