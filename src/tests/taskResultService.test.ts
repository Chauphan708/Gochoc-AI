import { describe, it, expect } from 'vitest'

// We will mock supabase and studentService to avoid database calls
import { vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null })
        })
      })
    })
  }
}))

vi.mock('./studentService', () => ({
  addPoints: vi.fn(),
  addXP: vi.fn()
}))

// Import the fallback grading function (which we can test directly since it is synchronous)
// To test it, we can extract the test logic or import the module
import { submitTask } from '../services/taskResultService'
import type { Task } from '@/types/database'

describe('taskResultService.ts tests', () => {
  it('should fall back to keyword matching when API key is missing', async () => {
    const task: Task = {
      id: 'task-1',
      station_id: 'station-1',
      title: 'Câu hỏi tự luận ngắn',
      type: 'short_answer',
      content: {
        keywords: ['quang hợp', 'diệp lục', 'nước', 'ánh sáng'],
        question: 'Hãy mô tả quá trình quang hợp ở thực vật'
      },
      order_num: 1,
      xp_reward: 10,
      scoring_mode: 'individual',
      require_individual_login: false
    }

    const answer = { text: 'Quá trình quang hợp cần có ánh sáng và diệp lục.' }

    // Since localStorage is empty, it will fall back to keyword grading.
    // Let's call submitTask. It will try to insert to supabase and call studentService, 
    // which are mocked, so it will grade and complete.
    // Wait, let's mock fetch to return ok: false or similar so even if it tries API it falls back
    global.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error('Network error')))

    // Let's run a test by mocking the database calls inside submitTask
    // But since supabase.insert returns single(), let's make sure it returns a result
    const insertMock = vi.fn().mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'result-1', score: 5 }, error: null })
      })
    })
    
    const { supabase } = await import('@/lib/supabase')
    supabase.from = vi.fn().mockReturnValue({
      insert: insertMock,
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null })
        })
      })
    })

    const input = {
      taskId: 'task-1',
      groupId: 'group-1',
      submittedBy: 'student-1',
      answer,
      task
    }

    const result = await submitTask(input)
    expect(result).toBeDefined()
    expect(supabase.from).toHaveBeenCalledWith('task_results')
  })

  it('should fallback gracefully for photo_upload when API key is missing', async () => {
    const task: Task = {
      id: 'task-2',
      station_id: 'station-1',
      title: 'Chụp ảnh thí nghiệm',
      type: 'photo_upload',
      content: {
        rubric: 'Đầy đủ hiện tượng chuyển màu',
        question: 'Chụp ảnh ống nghiệm sau phản ứng'
      },
      order_num: 2,
      xp_reward: 15,
      scoring_mode: 'individual',
      require_individual_login: false
    }

    const answer = { url: 'https://example.com/experiment.jpg' }

    const insertMock = vi.fn().mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'result-2', score: 0 }, error: null })
      })
    })
    
    const { supabase } = await import('@/lib/supabase')
    supabase.from = vi.fn().mockReturnValue({
      insert: insertMock,
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null })
        })
      })
    })

    const input = {
      taskId: 'task-2',
      groupId: 'group-1',
      submittedBy: 'student-1',
      answer,
      task
    }

    const result = await submitTask(input)
    expect(result).toBeDefined()
    expect(supabase.from).toHaveBeenCalledWith('task_results')
  })
})

