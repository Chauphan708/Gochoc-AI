import { describe, it, expect, vi } from 'vitest'
import { initializeRotation, rotateAllGroups } from '../services/rotationService'
import { submitTask } from '../services/taskResultService'
import type { Task, Session } from '@/types/database'

// Giả lập cơ sở dữ liệu Supabase cho luồng tích hợp
const mockSession: Session = {
  id: 'sess-integration-1',
  teacher_id: 'teacher-1',
  title: 'Tiết học tích hợp Vật Lý',
  subject: 'Physics',
  grade_level: '10',
  join_code: '9999',
  rotation_mode: 'fixed',
  rotation_time_minutes: 10,
  max_stations: 2,
  device_mode: 'shared',
  status: 'lobby',
  created_at: new Date().toISOString()
}

const mockGroups = [
  { id: 'group-1', session_id: 'sess-integration-1', name: 'Nhóm Tốc Độ', current_station_id: null, current_rotation: 0 }
]

const mockStations = [
  { id: 'station-1', session_id: 'sess-integration-1', name: 'Trạm Lý Thuyết', order_num: 1, bot_persona: 'friendly' },
  { id: 'station-2', session_id: 'sess-integration-1', name: 'Trạm Thực Hành', order_num: 2, bot_persona: 'patient' }
]

// Mocking Supabase Client
vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => ({
              order: vi.fn().mockImplementation(() => Promise.resolve({ data: table === 'groups' ? mockGroups : mockStations })),
              single: vi.fn().mockImplementation(() => Promise.resolve({ data: mockSession }))
            })),
            in: vi.fn().mockImplementation(() => Promise.resolve({ data: [] })),
            single: vi.fn().mockImplementation(() => Promise.resolve({ data: mockSession }))
          })),
          update: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => Promise.resolve({ data: { status: 'active' }, error: null }))
          })),
          insert: vi.fn().mockImplementation(() => ({
            select: vi.fn().mockImplementation(() => ({
              single: vi.fn().mockImplementation(() => Promise.resolve({ data: { id: 'result-mocked', score: 10 } }))
            }))
          }))
        }
      })
    }
  }
})

vi.mock('../services/studentService', () => ({
  addPoints: vi.fn().mockResolvedValue(true),
  addXP: vi.fn().mockResolvedValue(true)
}))

describe('GóiHọc AI - Kịch Bản Kiểm Thử Tích Hợp (Teacher & Student Flow)', () => {
  it('giả lập trọn vẹn luồng hoạt động từ GV đến HS', async () => {
    // 1. [VAI TRÒ GV] Khởi tạo luân chuyển trạm từ Lobby
    // Hàm này sẽ thiết lập rotation_order và gán trạm ban đầu cho các nhóm
    await expect(initializeRotation('sess-integration-1')).resolves.not.toThrow()
    
    // 2. [VAI TRÒ HS] Nộp bài tập trắc nghiệm (Quiz Task) ở chế độ Shared Device
    const quizTask: Task = {
      id: 'task-quiz-1',
      station_id: 'station-1',
      title: 'Trắc nghiệm nhiệt lượng',
      type: 'quiz',
      content: {
        questions: [{ correctAnswer: 1 }]
      },
      order_num: 1,
      xp_reward: 10,
      scoring_mode: 'individual',
      require_individual_login: false
    }

    const quizInput = {
      taskId: quizTask.id,
      groupId: 'group-1',
      submittedBy: 'student-an', // Học sinh An làm bài
      answer: { answers: [1] }, // Đáp án đúng
      task: quizTask
    }

    const quizResult = await submitTask(quizInput)
    expect(quizResult).toBeDefined()
    expect(quizResult.score).toBe(10) // Đạt điểm tối đa do đáp án khớp

    // 3. [VAI TRÒ HS] Quick Switch sang học sinh Bình để nộp ảnh bài tập thực hành
    const photoTask: Task = {
      id: 'task-photo-1',
      station_id: 'station-2',
      title: 'Ảnh chụp thí nghiệm',
      type: 'photo_upload',
      content: { question: 'Chụp ảnh ống nghiệm' },
      order_num: 2,
      xp_reward: 15,
      scoring_mode: 'group_equal', // Chế độ nhóm chia đều
      require_individual_login: false
    }

    const photoInput = {
      taskId: photoTask.id,
      groupId: 'group-1',
      submittedBy: 'student-binh', // Học sinh Bình nộp bài
      answer: { url: 'https://supabase.co/storage/v1/object/public/uploads/experiment.jpg' },
      task: photoTask,
      groupMemberIds: ['student-an', 'student-binh'] // Cả nhóm được chia đều điểm
    }

    // Vì chưa có API key trong test environment, hệ thống sẽ fallback an toàn
    const photoResult = await submitTask(photoInput)
    expect(photoResult).toBeDefined()

    // 4. [VAI TRÒ GV / HỆ THỐNG] Timer hết giờ -> Tự động chuyển góc cho tất cả nhóm
    await expect(rotateAllGroups('sess-integration-1')).resolves.not.toThrow()
  })
})
