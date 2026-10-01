import { openDatabase, requestResult } from './database'
import type { SyncState } from '../types'

const DEFAULT_STATE: SyncState = { id: 'default', revision: 0 }

export async function getSyncState(): Promise<SyncState> {
  const database = await openDatabase()
  const state = await requestResult<SyncState | undefined>(database.transaction('sync_state').objectStore('sync_state').get('default'))
  database.close()
  return state ?? DEFAULT_STATE
}

export async function setSyncState(revision: number): Promise<void> {
  const database = await openDatabase()
  await requestResult(database.transaction('sync_state', 'readwrite').objectStore('sync_state').put({ id: 'default', revision, lastSyncedAt: new Date().toISOString() }))
  database.close()
}
