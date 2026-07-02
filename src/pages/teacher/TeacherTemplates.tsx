import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Layers, Plus, Copy, Trash2, BookOpen, Loader2, ChevronDown, ChevronUp, Sparkles, Search } from 'lucide-react'
import { getTemplates, deleteTemplate, createSessionFromTemplate } from '@/services/templateService'
import { getTeacherSessions } from '@/services/sessionService'
import { saveAsTemplate } from '@/services/templateService'
import type { SessionTemplate } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'

interface Session {
  id: string
  title: string
  status: string
  created_at: string
}

function getStationsFromConfig(config: any) {
  if (!config) return []
  if (Array.isArray(config.stations)) return config.stations
  return []
}

function getTotalTasks(config: any): number {
  const stations = getStationsFromConfig(config)
  return stations.reduce((sum: number, s: any) => sum + (Array.isArray(s.tasks) ? s.tasks.length : 0), 0)
}

export function TeacherTemplates() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [templates, setTemplates] = useState<SessionTemplate[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Save-from-session modal
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Use template modal
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (user?.id) loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [tplData, sessData] = await Promise.all([
        getTemplates(user.id),
        getTeacherSessions(user.id),
      ])
      setTemplates(tplData)
      setSessions(sessData as Session[])
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!user || !selectedSessionId || !templateName.trim()) return
    setIsSaving(true)
    try {
      await saveAsTemplate(selectedSessionId, user.id, templateName.trim(), templateDesc.trim() || undefined)
      setShowSaveModal(false)
      setSelectedSessionId('')
      setTemplateName('')
      setTemplateDesc('')
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Lưu mẫu thất bại')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUseTemplate = async () => {
    if (!user || !useTemplateId || !newSessionTitle.trim()) return
    setIsCreating(true)
    try {
      await createSessionFromTemplate(useTemplateId, user.id, newSessionTitle.trim())
      setUseTemplateId(null)
      setNewSessionTitle('')
      navigate('/teacher/create-session')
    } catch (err: any) {
      alert(err.message || 'Tạo phiên thất bại')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa mẫu này?')) return
    try {
      await deleteTemplate(templateId)
      setTemplates(prev => prev.filter(t => t.id !== templateId))
    } catch (err: any) {
      alert(err.message || 'Xóa thất bại')
    }
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.subject ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-dvh">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 px-6 py-4">
        <div className="glass-card-static mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/teacher/dashboard')} className="btn btn-ghost btn-icon">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">Kho Mẫu</span>
            <span className="badge badge-primary text-xs">Templates</span>
          </div>
          <button
            onClick={() => setShowSaveModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4" />
            Lưu phiên làm mẫu
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Kho Mẫu Phiên Học</h1>
              <p className="text-slate-400 text-sm">Lưu và tái sử dụng cấu hình phiên dạy học theo góc</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mẫu theo tên hoặc môn học..."
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <span className="text-sm">Đang tải kho mẫu...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="glass-card-static p-16 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-600/10 border border-pink-500/20 flex items-center justify-center mx-auto mb-5">
              <Layers className="w-10 h-10 text-pink-400/50" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {searchQuery ? 'Không tìm thấy mẫu nào' : 'Chưa có mẫu nào'}
            </h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              {searchQuery
                ? 'Thử tìm kiếm với từ khóa khác.'
                : 'Hãy tạo một phiên học, sau đó lưu lại làm mẫu để tái sử dụng cho các lớp học sau!'}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowSaveModal(true)} className="btn btn-primary">
                <Plus className="w-4 h-4" />
                Lưu phiên làm mẫu
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((tpl, i) => {
              const stations = getStationsFromConfig(tpl.config)
              const totalTasks = getTotalTasks(tpl.config)
              const isExpanded = expandedId === tpl.id

              return (
                <div
                  key={tpl.id}
                  className="glass-card-static group animate-fade-in overflow-hidden"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  {/* Pink accent bar */}
                  <div className="h-1 bg-gradient-to-r from-pink-500 to-rose-600" />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{tpl.name}</h3>
                        {tpl.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{tpl.description}</p>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500/10 to-rose-600/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0 ml-3">
                        <BookOpen className="w-4 h-4 text-pink-400" />
                      </div>
                    </div>

                    {/* Meta badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tpl.subject && (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-300 border border-pink-500/20">
                          {tpl.subject}
                        </span>
                      )}
                      {tpl.grade_level && (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {tpl.grade_level}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-white/10">
                        <Layers className="w-3 h-3" />
                        {stations.length} góc
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-white/10">
                        {totalTasks} nhiệm vụ
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-slate-500 mb-4">
                      Tạo ngày {new Date(tpl.created_at).toLocaleDateString('vi-VN')}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUseTemplateId(tpl.id)}
                        className="btn btn-primary btn-sm flex-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Sử dụng
                      </button>
                      <button
                        onClick={() => handleDelete(tpl.id)}
                        className="btn btn-ghost btn-sm btn-icon text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                        className="btn btn-ghost btn-sm btn-icon text-slate-400 hover:text-white"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Preview */}
                  {isExpanded && (
                    <div className="border-t border-white/5 bg-slate-900/30 px-5 py-4 animate-fade-in">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Chi tiết các góc học tập
                      </p>
                      {stations.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Không có dữ liệu góc</p>
                      ) : (
                        <div className="space-y-2">
                          {stations.map((station: any, si: number) => (
                            <div key={si} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center text-xs font-bold text-pink-300 flex-shrink-0">
                                {si + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{station.name || `Góc ${si + 1}`}</p>
                                <p className="text-xs text-slate-500">
                                  {Array.isArray(station.tasks) ? station.tasks.length : 0} nhiệm vụ
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SAVE-FROM-SESSION MODAL ── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card-static w-full max-w-lg p-6 mx-4 relative">
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              Lưu phiên làm mẫu
            </h2>
            <p className="text-sm text-slate-400 mb-6">Chọn một phiên học để lưu cấu hình thành mẫu tái sử dụng.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Chọn phiên học</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-colors appearance-none"
                >
                  <option value="">— Chọn phiên —</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({new Date(s.created_at).toLocaleDateString('vi-VN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Tên mẫu</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="VD: Mẫu Toán 10 — Hàm số bậc 2"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Mô tả <span className="text-slate-500">(tùy chọn)</span></label>
                <input
                  type="text"
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="Ghi chú thêm về mẫu này..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setSelectedSessionId('')
                  setTemplateName('')
                  setTemplateDesc('')
                }}
                className="btn btn-ghost text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={!selectedSessionId || !templateName.trim() || isSaving}
                className="btn btn-primary text-sm disabled:opacity-40"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Lưu mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── USE TEMPLATE MODAL ── */}
      {useTemplateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card-static w-full max-w-md p-6 mx-4 relative">
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Copy className="w-5 h-5 text-pink-400" />
              Tạo phiên từ mẫu
            </h2>
            <p className="text-sm text-slate-400 mb-6">Đặt tên cho phiên học mới được tạo từ mẫu.</p>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tên phiên mới</label>
              <input
                type="text"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="VD: Toán 10A1 — Tiết 25"
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSessionTitle.trim()) handleUseTemplate()
                }}
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setUseTemplateId(null)
                  setNewSessionTitle('')
                }}
                className="btn btn-ghost text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleUseTemplate}
                disabled={!newSessionTitle.trim() || isCreating}
                className="btn btn-primary text-sm disabled:opacity-40"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Tạo phiên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
