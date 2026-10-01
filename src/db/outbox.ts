import { openDatabase, requestResult } from './database'
import type { PendingChange } from '../types'

export async function enqueue(change: Omit<PendingChange, 'id' | 'createdAt' | 'retryCount' | 'clientMutationId'>): Promise<PendingChange> {
  const pending: PendingChange = { ...change, clientMutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), retryCount: 0 }
  const database = await openDatabase()
  const id = Number(await requestResult<IDBValidKey>(database.transaction('pending_changes', 'readwrite').objectStore('pending_changes').add(pending)))
  database.close()
  return { ...pending, id }
}

export async function listPending(): Promise<PendingChange[]> {
  const database = await openDatabase()
  const changes = await requestResult<PendingChange[]>(database.transaction('pending_changes').objectStore('pending_changes').getAll())
  database.close()
  return changes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function pendingCount(): Promise<number> {
  const database = await openDatabase()
  const count = await requestResult<number>(database.transaction('pending_changes').objectStore('pending_changes').count())
  database.close()
  return count
}

export async function removePending(id: number): Promise<void> {
  const database = await openDatabase()
  await requestResult(database.transaction('pending_changes', 'readwrite').objectStore('pending_changes').delete(id))
  database.close()
}

export async function markFailed(change: PendingChange, error: string): Promise<void> {
  const database = await openDatabase()
  await requestResult(database.transaction('pending_changes', 'readwrite').objectStore('pending_changes').put({ ...change, retryCount: change.retryCount + 1, lastError: error }))
  database.close()
}
