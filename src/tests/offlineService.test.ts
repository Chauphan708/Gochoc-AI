import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure the mock variables are hoisted before the vi.mock factory runs!
const { mockDb } = vi.hoisted(() => {
  const store = {
    put: vi.fn(),
    get: vi.fn(),
    add: vi.fn(),
    getAll: vi.fn(),
    delete: vi.fn()
  }
  const db = {
    put: vi.fn(),
    get: vi.fn(),
    add: vi.fn(),
    transaction: vi.fn().mockReturnValue({
      objectStore: () => store,
      done: Promise.resolve()
    })
  }
  return { mockDb: db, mockStore: store }
})

vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue(mockDb)
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null })
    })
  }
}))

import { cacheData, getCachedData, queueOfflineAction } from '../services/offlineService'

describe('offlineService.ts tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up standard browser mocks
    global.navigator = {
      onLine: false
    } as any
  })

  it('should successfully store cache records', async () => {
    mockDb.put.mockResolvedValue(undefined)
    await cacheData('test-key', { foo: 'bar' })
    expect(mockDb.put).toHaveBeenCalledWith('cached_data', expect.objectContaining({
      key: 'test-key',
      data: { foo: 'bar' }
    }))
  })

  it('should retrieve cached records', async () => {
    mockDb.get.mockResolvedValue({ key: 'test-key', data: { value: 123 } })
    const result = await getCachedData('test-key')
    expect(mockDb.get).toHaveBeenCalledWith('cached_data', 'test-key')
    expect(result).toEqual({ value: 123 })
  })

  it('should queue actions offline without crashing', async () => {
    mockDb.add.mockResolvedValue(1)
    await queueOfflineAction('SUBMIT_TASK', { taskId: '123' })
    expect(mockDb.add).toHaveBeenCalledWith('sync_queue', expect.objectContaining({
      action: 'SUBMIT_TASK',
      payload: { taskId: '123' }
    }))
  })
})
