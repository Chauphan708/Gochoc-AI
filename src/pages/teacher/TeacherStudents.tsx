/* ═══════════════════════════════════════
   TEACHER STUDENTS — GócHọc AI
   Quản lý danh sách học sinh (Thêm/Sửa/Xóa/Import CSV)
   ═══════════════════════════════════════ */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Search, 
  UserPlus, 
  FileSpreadsheet, 
  MoreVertical,
  Shield,
  KeyRound,
  Trash2,
  Settings
} from 'lucide-react'
import { getStudentsByTeacher, importStudentsFromCSV, createStudent } from '@/services/studentService'
import { useAuthStore } from '@/stores/authStore'
import type { Student, Gender } from '@/types/database'

export function TeacherStudents() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // States for Add Student Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newStudent, setNewStudent] = useState({
    displayName: '',
    studentCode: '',
    className: '',
    gender: 'male' as Gender
  })
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    if (user?.id) {
      loadStudents()
    }
  }, [user])

  const loadStudents = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await getStudentsByTeacher(user.id)
      setStudents(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!newStudent.displayName.trim() || !newStudent.studentCode.trim()) {
      setModalError('Vui lòng điền đầy đủ Họ tên và Mã học sinh')
      return
    }

    setIsSaving(true)
    setModalError('')
    try {
      await createStudent({
        displayName: newStudent.displayName,
        studentCode: newStudent.studentCode,
        teacherId: user.id,
        className: newStudent.className || undefined,
        gender: newStudent.gender
      })
      
      // Reset state and close modal
      setNewStudent({
        displayName: '',
        studentCode: '',
        className: '',
        gender: 'male'
      })
      setIsAddModalOpen(false)
      await loadStudents()
    } catch (error: any) {
      console.error(error)
      setModalError(error.message || 'Tạo học sinh thất bại')
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const { success, errors } = await importStudentsFromCSV(text, user.id)
      
      if (errors.length > 0) {
        alert(`Đã nhập thành công ${success.length} học sinh. Có lỗi ở ${errors.length} dòng.`)
      } else {
        alert(`Đã nhập thành công ${success.length} học sinh.`)
      }
      
      await loadStudents()
    } catch (error) {
      console.error('Import failed', error)
      alert('Lỗi import CSV')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-dvh px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/teacher/dashboard')}
          className="btn btn-ghost btn-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
              <Shield className="w-6 h-6 text-emerald-400" />
              Quản lý Học sinh
            </h1>
            <p className="text-slate-400 text-sm">
              Xem danh sách, tạo tài khoản mới hoặc import hàng loạt từ Excel/CSV.
            </p>
          </div>
          <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.1s', opacity: 0 }}>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button 
              className="btn btn-ghost border-dashed border-white/20 text-slate-300"
              onClick={handleImportClick}
              disabled={isImporting}
            >
              {isImporting ? (
                <span className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              )}
              {isImporting ? 'Đang Import...' : 'Import CSV'}
            </button>
            <button 
              className="btn btn-primary cursor-pointer"
              onClick={() => setIsAddModalOpen(true)}
            >
              <UserPlus className="w-4 h-4" />
              Thêm Học sinh
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="glass-card-static p-4 mb-6 animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Tìm kiếm theo tên hoặc mã HS..." 
                className="input pl-10 w-full"
              />
            </div>
            <select className="input w-full sm:w-48">
              <option value="">Tất cả các lớp</option>
              <option value="8A">Lớp 8A</option>
              <option value="8B">Lớp 8B</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-sm font-medium text-slate-400">
                  <th className="p-4 pl-6">Họ và tên</th>
                  <th className="p-4">Mã tài khoản (MSSV)</th>
                  <th className="p-4">Mã PIN</th>
                  <th className="p-4">Lớp</th>
                  <th className="p-4 text-right pr-6">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Chưa có học sinh nào. Hãy import hoặc thêm mới!
                    </td>
                  </tr>
                ) : students.map((student) => (
                  <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                          {student.display_name[0]}
                        </div>
                        <span className="font-medium text-white">{student.display_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-sm text-slate-300">{student.student_code}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <KeyRound className="w-3.5 h-3.5" />
                        <span className="font-mono tracking-widest">{student.student_code}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="badge bg-white/5 text-slate-300">{student.class_name || 'N/A'}</span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="btn btn-ghost btn-icon text-slate-400 hover:text-white" title="Sửa thông tin">
                          <Settings className="w-4 h-4" />
                        </button>
                        <button className="btn btn-ghost btn-icon text-slate-400 hover:text-red-400" title="Xóa học sinh">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="btn btn-ghost btn-icon text-slate-400 md:hidden">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination (Trivial) */}
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-sm text-slate-400 bg-black/20">
            <div>Hiển thị {students.length} học sinh</div>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" disabled>Trước</button>
              <button className="btn btn-ghost btn-sm">Sau</button>
            </div>
          </div>
        </div>

      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card-static w-full max-w-md p-6 animate-scale-in relative border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Thêm học sinh mới
            </h2>

            <form onSubmit={handleAddStudent} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Họ và tên <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="input"
                  value={newStudent.displayName}
                  onChange={e => setNewStudent(prev => ({ ...prev, displayName: e.target.value }))}
                />
              </div>

              {/* Student Code */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Mã học sinh (MSSV) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: HS001"
                  className="input font-mono"
                  value={newStudent.studentCode}
                  onChange={e => setNewStudent(prev => ({ ...prev, studentCode: e.target.value }))}
                />
              </div>

              {/* Class & Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Lớp
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 8A"
                    className="input"
                    value={newStudent.className}
                    onChange={e => setNewStudent(prev => ({ ...prev, className: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Giới tính
                  </label>
                  <select
                    className="input"
                    value={newStudent.gender}
                    onChange={e => setNewStudent(prev => ({ ...prev, gender: e.target.value as Gender }))}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>

              {/* Error message */}
              {modalError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {modalError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setModalError('')
                  }}
                  className="btn btn-ghost text-slate-300 cursor-pointer"
                  disabled={isSaving}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary cursor-pointer"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Lưu lại'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
