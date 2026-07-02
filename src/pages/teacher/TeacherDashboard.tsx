/* ═══════════════════════════════════════
   TEACHER DASHBOARD — GócHọc AI
   Trang quản lý phiên học cho GV
   ═══════════════════════════════════════ */

import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Clock,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  GraduationCap,
  Layers,
  ArrowRight,
  Loader2,
  Play,
  Zap
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { getTeacherSessions, startSession } from '@/services/sessionService'
import { useAuthStore } from '@/stores/authStore'
import type { Session } from '@/types/database'

export function TeacherDashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '')

  const handleSaveSettings = () => {
    localStorage.setItem('gemini_api_key', apiKey)
    setIsSettingsOpen(false)
    alert('Đã lưu cấu hình thành công!')
  }

  useEffect(() => {
    if (user?.id) {
      loadSessions()
    }
  }, [user])

  const loadSessions = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await getTeacherSessions(user.id)
      setRecentSessions(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    try {
      await startSession(sessionId)
      navigate(`/teacher/live/${sessionId}`)
    } catch(err) {
      console.error(err)
      alert('Không thể bắt đầu phiên.')
    }
  }

  return (
    <div className="min-h-dvh">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 px-6 py-4">
        <div className="glass-card-static mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">GócHọc AI</span>
            <span className="badge badge-primary text-xs">GV</span>
          </div>
          <div className="flex items-center gap-2">
            <button id="btn-settings" onClick={() => setIsSettingsOpen(true)} className="btn btn-ghost btn-icon">
              <Settings className="w-4 h-4" />
            </button>
            <button
              id="btn-logout"
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="btn btn-ghost btn-icon"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-white mb-1">
            Xin chào, Giáo viên 👋
          </h1>
          <p className="text-slate-400">
            Tạo phiên dạy học theo góc mới hoặc quản lý phiên hiện có.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            {
              icon: Plus,
              label: 'Tạo phiên mới',
              desc: 'Dạy học theo góc',
              color: 'from-indigo-500 to-purple-600',
              action: () => navigate('/teacher/create-session'),
              id: 'btn-create-session',
            },
            {
              icon: Users,
              label: 'Quản lý HS',
              desc: 'Danh sách & hồ sơ',
              color: 'from-emerald-500 to-teal-600',
              action: () => navigate('/teacher/students'),
              id: 'btn-manage-students',
            },
            {
              icon: BarChart3,
              label: 'Báo cáo',
              desc: 'Điểm & thống kê',
              color: 'from-amber-500 to-orange-600',
              action: () => alert('Tính năng Báo cáo chung đang được phát triển. Vui lòng xem báo cáo chi tiết ở từng Phiên học!'),
              id: 'btn-reports',
            },
            {
              icon: Layers,
              label: 'Kho mẫu',
              desc: 'Template phiên học',
              color: 'from-pink-500 to-rose-600',
              action: () => alert('Tính năng Kho mẫu đang được phát triển, sẽ ra mắt trong phiên bản sắp tới!'),
              id: 'btn-templates',
            },
          ].map((item, i) => (
            <button
              key={item.id}
              id={item.id}
              onClick={item.action}
              className="glass-card p-5 text-left group animate-fade-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div
                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <div className="font-semibold text-white text-sm">{item.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Recent Sessions */}
        <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Phiên học gần đây</h2>
            <button className="btn btn-ghost btn-sm text-xs">
              Xem tất cả
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : recentSessions.map((session) => (
              <div
                key={session.id}
                className="glass-card p-4 flex items-center justify-between cursor-pointer group"
                onClick={() => navigate(`/teacher/session/${session.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm">
                      {session.title}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(session.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-indigo-300 bg-indigo-500/10 px-1 rounded">
                        Mã: {session.join_code}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {session.max_stations} góc
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`badge ${
                      session.status === 'completed'
                        ? 'badge-accent'
                        : session.status === 'active'
                        ? 'badge-primary'
                        : 'badge-warning'
                    }`}
                  >
                    {session.status === 'completed' ? 'Hoàn thành' : session.status === 'active' ? 'Đang chạy' : 'Sảnh chờ'}
                  </span>
                  
                  {session.status !== 'completed' && (
                    <>
                      {session.status === 'active' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/teacher/live/${session.id}`);
                          }}
                          className="btn btn-primary btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Zap className="w-3 h-3" /> Điều khiển
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/lobby/${session.join_code}`);
                          }}
                          className="btn btn-primary btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Users className="w-3 h-3" /> Vào Sảnh
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {!isLoading && recentSessions.length === 0 && (
              <div className="glass-card-static p-12 text-center">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">
                  Chưa có phiên học nào. Hãy tạo phiên đầu tiên!
                </p>
                <button
                  onClick={() => navigate('/teacher/create-session')}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Tạo phiên học
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SETTINGS MODAL (GEMINI API KEY) ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card-static w-full max-w-md p-6 mx-4 relative">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" /> Cấu hình Giáo viên
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input font-mono"
                  placeholder="Nhập AI API Key (AI Trợ Giảng)..."
                />
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Key được lưu an toàn trực tiếp trên trình duyệt của bạn (localStorage) và sử dụng để chạy AI Bot Trợ Giảng + tạo Embeddings tại các góc.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="btn btn-ghost text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={handleSaveSettings}
                className="btn btn-primary text-sm"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
