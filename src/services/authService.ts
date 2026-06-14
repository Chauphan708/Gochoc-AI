/* ═══════════════════════════════════════
   AUTH SERVICE — GócHọc AI
   Xử lý đăng ký/đăng nhập GV via Supabase Auth
   Đăng nhập HS bằng mã phiên + mã PIN
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import type { Teacher, Student } from '@/types/database'

// ─── GIÁO VIÊN ────────────────────────────

/** Đăng ký GV bằng email + mật khẩu */
export async function registerTeacher(
  email: string,
  password: string,
  fullName: string,
  schoolName?: string,
  subject?: string
): Promise<Teacher> {
  // 1. Tạo tài khoản Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: 'teacher' } },
  })
  if (authError) throw new Error(`Đăng ký thất bại: ${authError.message}`)
  if (!authData.user) throw new Error('Không tạo được tài khoản')

  // 2. Tạo bản ghi trong bảng teachers
  const { data: teacher, error: dbError } = await supabase
    .from('teachers')
    .insert({
      id: authData.user.id,
      full_name: fullName,
      school_name: schoolName ?? null,
      subject: subject ?? null,
    })
    .select()
    .single()

  if (dbError) throw new Error(`Lưu thông tin GV thất bại: ${dbError.message}`)
  return teacher
}

/** Đăng nhập GV bằng email + mật khẩu */
export async function loginTeacher(
  email: string,
  password: string
): Promise<Teacher> {
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw new Error(`Đăng nhập thất bại: ${authError.message}`)

  const { data: teacher, error: dbError } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (dbError) throw new Error(`Không tìm thấy thông tin GV: ${dbError.message}`)
  return teacher
}

/** Đăng nhập GV bằng Google OAuth */
export async function loginTeacherWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/teacher/dashboard` },
  })
  if (error) throw new Error(`Đăng nhập Google thất bại: ${error.message}`)
}

// ─── HỌC SINH ─────────────────────────────

/**
 * Đăng nhập HS bằng mã phiên 4 số + mã PIN cá nhân.
 * Nếu chưa có tài khoản → tự tạo anonymous user.
 */
export async function loginStudent(
  joinCode: string,
  studentCode: string,
  pin: string
): Promise<{ student: Student; sessionId: string }> {
  // 1. Tìm phiên học theo join_code
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('join_code', joinCode)
    .single()

  if (sessionError || !session) throw new Error('Mã phiên không hợp lệ')
  if (session.status === 'ended') throw new Error('Phiên học đã kết thúc')

  // 2. Tìm HS theo student_code
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('student_code', studentCode)
    .single()

  if (studentError || !student) throw new Error('Mã học sinh không hợp lệ')

  // 3. Xác thực PIN
  if (student.pin && student.pin !== '0000' && student.pin !== pin) {
    throw new Error('Mã PIN không chính xác. Vui lòng liên hệ giáo viên.')
  }

  return { student, sessionId: session.id }
}

// ─── CHUNG ─────────────────────────────────

/** Đăng xuất */
export async function logout() {
  await supabase.auth.signOut()
}

/** Lấy phiên đăng nhập hiện tại */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Kiểm tra xem là GV hay HS
  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', user.id)
    .single()

  if (teacher) return { user: teacher as Teacher, role: 'teacher' as const }

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', user.id)
    .single()

  if (student) return { user: student as Student, role: 'student' as const }

  return null
}
