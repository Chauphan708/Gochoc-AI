/* ═══════════════════════════════════════
   STUDENT SERVICE — GócHọc AI
   CRUD học sinh + Import CSV hàng loạt
   Tương ứng Module 2.1 A trong kế hoạch NLM
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import type { Student, Gender } from '@/types/database'

// ─── QUẢN LÝ HỌC SINH ─────────────────────

/** Lấy danh sách HS của GV */
export async function getStudentsByTeacher(teacherId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('display_name')

  if (error) throw new Error(`Lấy danh sách HS thất bại: ${error.message}`)
  return data ?? []
}

/** Tạo 1 HS */
export async function createStudent(input: {
  displayName: string
  studentCode: string
  teacherId: string
  gender?: Gender
  className?: string
}): Promise<Student> {
  // Tạo anonymous user cho HS (không cần email)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: `${input.studentCode}@gochoc.local`,
    password: input.studentCode, // Mật khẩu mặc định = mã HS
    email_confirm: true,
    user_metadata: { display_name: input.displayName, role: 'student' },
  })

  // Nếu không có quyền admin, tạo trực tiếp vào bảng students
  // (dành cho MVP — sau này sẽ dùng Edge Function)
  const studentId = authData?.user?.id ?? crypto.randomUUID()

  const { data, error } = await supabase
    .from('students')
    .insert({
      id: studentId,
      display_name: input.displayName,
      student_code: input.studentCode,
      teacher_id: input.teacherId,
      gender: input.gender ?? null,
      class_name: input.className ?? null,
      total_xp: 0,
      total_points: 0,
      badges: [],
      total_sessions: 0,
      total_interactions: 0,
      total_group_interactions: 0,
      streak_days: 0,
    } as any)
    .select()
    .single()

  if (error) throw new Error(`Tạo HS thất bại: ${error.message}`)
  return data
}

/** Cập nhật thông tin HS */
export async function updateStudent(
  studentId: string,
  updates: Partial<Pick<Student, 'display_name' | 'student_code' | 'gender' | 'class_name'>>
): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .update(updates as any)
    .eq('id', studentId)
    .select()
    .single()

  if (error) throw new Error(`Cập nhật HS thất bại: ${error.message}`)
  return data
}

/** Xoá HS */
export async function deleteStudent(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', studentId)

  if (error) throw new Error(`Xoá HS thất bại: ${error.message}`)
}

// ─── IMPORT CSV ────────────────────────────

export interface CSVStudentRow {
  name: string
  code: string
  gender?: string
  class?: string
}

/**
 * Parse CSV text thành danh sách học sinh.
 * Hỗ trợ 2 format:
 *   1. Có header: name,code,gender,class
 *   2. Chỉ có tên (1 cột) → tự sinh mã
 */
export function parseCSV(csvText: string): CSVStudentRow[] {
  const lines = csvText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return []

  // Detect header
  const firstLine = lines[0].toLowerCase()
  const hasHeader =
    firstLine.includes('name') ||
    firstLine.includes('tên') ||
    firstLine.includes('họ tên') ||
    firstLine.includes('code')

  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line, index) => {
    const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''))

    if (parts.length >= 2) {
      return {
        name: parts[0],
        code: parts[1],
        gender: parts[2] || undefined,
        class: parts[3] || undefined,
      }
    }

    // Chỉ có tên → tự sinh mã
    return {
      name: parts[0],
      code: `HS${String(index + 1).padStart(3, '0')}`,
    }
  })
}

/**
 * Import danh sách HS từ CSV text.
 * Trả về kết quả: thành công / thất bại cho từng dòng.
 */
export async function importStudentsFromCSV(
  csvText: string,
  teacherId: string,
  className?: string
): Promise<{
  success: Student[]
  errors: { row: number; name: string; error: string }[]
}> {
  const rows = parseCSV(csvText)
  const success: Student[] = []
  const errors: { row: number; name: string; error: string }[] = []

  // Batch insert cho tốc độ
  const inserts = rows.map((row) => ({
    id: crypto.randomUUID(),
    display_name: row.name,
    student_code: row.code,
    teacher_id: teacherId,
    gender: normalizeGender(row.gender),
    class_name: row.class ?? className ?? null,
    total_xp: 0,
    total_points: 0,
    badges: [] as never[],
    total_sessions: 0,
    total_interactions: 0,
    total_group_interactions: 0,
    streak_days: 0,
  }))

  const { data, error } = await supabase
    .from('students')
    .insert(inserts as any)
    .select()

  if (error) {
    // Nếu batch thất bại, thử từng dòng
    for (let i = 0; i < inserts.length; i++) {
      try {
        const { data: single, error: singleError } = await supabase
          .from('students')
          .insert(inserts[i] as any)
          .select()
          .single()

        if (singleError) {
          errors.push({ row: i + 1, name: rows[i].name, error: singleError.message })
        } else if (single) {
          success.push(single)
        }
      } catch (e) {
        errors.push({ row: i + 1, name: rows[i].name, error: String(e) })
      }
    }
  } else {
    success.push(...(data ?? []))
  }

  return { success, errors }
}

/** Chuẩn hoá giới tính từ CSV */
function normalizeGender(raw?: string): 'male' | 'female' | 'other' | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  if (['nam', 'male', 'm', 'boy'].includes(lower)) return 'male'
  if (['nữ', 'nu', 'female', 'f', 'girl'].includes(lower)) return 'female'
  return 'other'
}

// ─── HỒ SƠ HỌC SINH ──────────────────────

/** Cộng XP cho HS */
export async function addXP(studentId: string, xp: number): Promise<void> {
  const { data: student } = await supabase
    .from('students')
    .select('total_xp')
    .eq('id', studentId)
    .single()

  if (!student) return

  await supabase
    .from('students')
    .update({ total_xp: (student as any).total_xp + xp } as any)
    .eq('id', studentId)
}

/** Cộng điểm cho HS */
export async function addPoints(studentId: string, points: number): Promise<void> {
  const { data: student } = await supabase
    .from('students')
    .select('total_points')
    .eq('id', studentId)
    .single()

  if (!student) return

  await supabase
    .from('students')
    .update({ total_points: (student as any).total_points + points } as any)
    .eq('id', studentId)
}
