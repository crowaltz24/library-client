import { request } from './client'
import type { PendingChange } from '../types'

export interface RemoteChange { revision: number; entity_type: 'library_entry'; entity_id: number; operation: 'create' | 'update' | 'delete'; version: number; payload: Record<string, unknown>; created_at: string }
export interface PullResponse { changes: RemoteChange[]; revision: number }
export interface PushResponse { results: RemoteChange[]; revision: number }

export async function push(changes: PendingChange[]): Promise<PushResponse> {
  if (!changes.length) return { results: [], revision: 0 }
  return request<PushResponse>('/api/sync/push', { method: 'POST', body: JSON.stringify({ mutations: changes.map(({ entityId, operation, payload, clientMutationId }) => ({ entity_type: 'library_entry', entity_id: Number(entityId) || null, operation, payload, client_mutation_id: clientMutationId })) }) })
}

export async function pull(revision: number): Promise<PullResponse> {
  return request<PullResponse>(`/api/sync/pull?since=${revision}`)
}
