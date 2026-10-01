import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pull, push } from './sync'

beforeEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } })
})

describe('sync API contract', () => {
  it('posts backend-shaped mutations', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [], revision: 4 }), { status: 200 }))
    await push([{ entityType: 'library_entry', entityId: 'local-entry', operation: 'create', payload: { title: 'Dune' }, clientMutationId: 'mutation-1', createdAt: '2026-10-01T00:00:00.000Z', retryCount: 0 }])
    const [, options] = fetchMock.mock.calls[0]
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sync/push')
    expect(JSON.parse(String(options?.body))).toEqual({ mutations: [{ entity_type: 'library_entry', entity_id: null, operation: 'create', payload: { title: 'Dune' }, client_mutation_id: 'mutation-1' }] })
  })

  it('uses the persisted revision in the pull query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ changes: [], revision: 9 }), { status: 200 }))
    await pull(8)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sync/pull?since=8')
  })
})
