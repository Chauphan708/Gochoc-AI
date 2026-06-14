/* ═══════════════════════════════════════
   OFFLINE SERVICE — GócHọc AI
   IndexedDB caching + sync queue + auto-sync
   Tương ứng Module 4.4 trong kế hoạch NLM
   ═══════════════════════════════════════ */

import { openDB, type IDBPDatabase } from 'idb'
import { supabase } from '@/lib/supabase'

const DB_NAME = 'gochoc_offline_db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB() {
  if (typeof window === 'undefined') return null
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cached_data')) {
          db.createObjectStore('cached_data', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

// ─── CACHING ─────────────────────────────────

/** Lưu dữ liệu vào cache IndexedDB */
export async function cacheData(key: string, data: any): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.put('cached_data', { key, data, cached_at: new Date().toISOString() })
}

/** Lấy dữ liệu từ cache IndexedDB */
export async function getCachedData<T = any>(key: string): Promise<T | null> {
  const db = await getDB()
  if (!db) return null
  const record = await db.get('cached_data', key)
  return record ? (record.data as T) : null
}

// ─── SYNC QUEUE ──────────────────────────────

export interface OfflineAction {
  id?: number
  action: 'SUBMIT_TASK' | 'CHAT_MESSAGE'
  payload: any
  created_at: string
}

/** Đưa một hành động ngoại tuyến vào hàng đợi */
export async function queueOfflineAction(
  action: 'SUBMIT_TASK' | 'CHAT_MESSAGE',
  payload: any
): Promise<void> {
  const db = await getDB()
  if (!db) return

  const item: OfflineAction = {
    action,
    payload,
    created_at: new Date().toISOString(),
  }

  await db.add('sync_queue', item)
  console.log(`💾 Đã lưu hành động ${action} vào hàng đợi ngoại tuyến.`)

  // Nếu mạng vẫn có, tự động trigger sync ngay
  if (navigator.onLine) {
    syncOfflineQueue().catch(err => console.error('Trigger sync failed:', err))
  }
}

/** Đồng bộ toàn bộ hàng đợi ngoại tuyến lên server */
export async function syncOfflineQueue(): Promise<void> {
  const db = await getDB()
  if (!db) return

  const tx = db.transaction('sync_queue', 'readwrite')
  const store = tx.objectStore('sync_queue')
  const queue: OfflineAction[] = await store.getAll()

  if (queue.length === 0) return

  console.log(`🔄 Bắt đầu đồng bộ ${queue.length} hành động ngoại tuyến...`)

  for (const item of queue) {
    try {
      if (item.action === 'SUBMIT_TASK') {
        const { submitTask } = await import('./taskResultService')
        await submitTask(item.payload)
        console.log(`✅ Đồng bộ bài nộp thành công cho taskId: ${item.payload.taskId}`)
      } else if (item.action === 'CHAT_MESSAGE') {
        // Gọi Gemini để Bot trả lời (hàm sendMessage sẽ tự động lưu cả tin nhắn HS và bot vào database)
        const { sendMessage } = await import('./chatService')
        await sendMessage({
          stationId: item.payload.stationId,
          studentId: item.payload.studentId,
          groupId: item.payload.groupId,
          message: item.payload.content,
          station: item.payload.station,
          tasks: item.payload.tasks,
          sessionTitle: item.payload.sessionTitle,
          studentName: item.payload.studentName,
          apiKey: item.payload.apiKey,
        })
        console.log(`✅ Đồng bộ chat với bot thành công!`)
      }

      // Xóa hành động đã đồng bộ thành công
      if (item.id !== undefined) {
        await store.delete(item.id)
      }
    } catch (err: any) {
      console.error(`❌ Đồng bộ hành động ${item.action} thất bại:`, err.message)
      // Dừng đồng bộ để bảo toàn thứ tự tuyến tính của hành động tiếp theo
      break
    }
  }

  await tx.done
}

// ─── AUTO SYNC TRIGGER ───────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('🌐 Thiết bị đã kết nối mạng trở lại! Tự động đồng bộ hàng đợi...')
    syncOfflineQueue().catch(err => console.error('Auto sync failed:', err))
  })
}
