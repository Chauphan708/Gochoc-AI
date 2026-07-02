/* ═══════════════════════════════════════
   TEACHER REPORTS PAGE — GócHọc AI
   Báo cáo Tổng hợp — Aggregate tất cả phiên
   ═══════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, BarChart3, Users, BookOpen, Sparkles, Loader2, TrendingUp, Calendar, Layers, ChevronRight } from 'lucide-react'
import { getOverallReport, exportOverallCSV } from '@/services/reportService'
import type { OverallReportData } from '@/services/reportService'
import { useAuthStore } from '@/stores/authStore'

type FilterTab = 'all' | 'active' | 'ended'

export function TeacherReports() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<OverallReportData | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')

  useEffect(() => {
    if (!user?.id) return
    fetchReport()
  }, [user?.id])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const data = await getOverallReport(user!.id)
      setReport(data)
    } catch (err: any) {
      alert('Không thể tải báo cáo: ' + err.message)
      navigate('/teacher/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!report) return
    exportOverallCSV(report)
  }

  const filteredSessions = report?.sessions.filter(s => {
    if (filter === 'all') return true
    if (filter === 'active') return s.status === 'active'
    return s.status === 'ended' || s.status === 'completed'
  }) ?? []

  const getStatusBadge = (status: string) => {
    if (status === 'ended' || status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Hoàn thành
        </span>
      )
    }
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Đang chạy
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Sảnh chờ
      </span>
    )
  }

  if (loading || !report) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0f111a]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Đang tổng hợp dữ liệu báo cáo...</p>
        </div>
      </div>
    )
  }

  const heroStats = [
    { label: 'Tổng phiên dạy', value: report.totalSessions, icon: BookOpen, color: 'text-indigo-400' },
    { label: 'Phiên đã hoàn thành', value: report.completedSessions, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Tổng HS tham gia', value: report.totalStudents, icon: Users, color: 'text-sky-400' },
    { label: 'Tổng XP đã thưởng', value: report.totalXpAwarded, icon: Sparkles, color: 'text-amber-400' },
  ]

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tất cả', count: report.sessions.length },
    { key: 'active', label: 'Đang chạy', count: report.activeSessions },
    { key: 'ended', label: 'Đã kết thúc', count: report.completedSessions },
  ]

  return (
    <div className="min-h-dvh bg-[#08090f] text-slate-200 font-sans pb-12">

      {/* ── TOP NAV ── */}
      <header className="sticky top-0 z-40 px-6 py-4 bg-[#08090f]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/teacher/dashboard')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-white/5"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-bold text-white text-sm sm:text-base">Báo Cáo Tổng Hợp</h1>
              <p className="text-xs text-slate-400">Tổng quan tất cả phiên dạy</p>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Xuất CSV</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-6xl mx-auto px-6 mt-8 space-y-8">

        {/* HERO HEADER */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-[#08090f] border border-indigo-500/10 p-6 sm:p-8 animate-fade-in">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-indigo-500/10 to-transparent blur-3xl -z-10 rounded-full" />
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-gradient-to-tr from-emerald-500/5 to-transparent blur-3xl -z-10 rounded-full" />

          <div className="space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <BarChart3 className="w-3 h-3" />
              Báo Cáo Tổng Hợp
            </div>
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Kết Quả Giảng Dạy
            </h2>
            <p className="text-sm text-slate-400">
              Tổng hợp dữ liệu từ <strong className="text-indigo-300 font-semibold">{report.totalSessions} phiên học</strong> trên hệ thống GócHọc AI
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {heroStats.map((stat, i) => (
              <div
                key={stat.label}
                className="bg-black/30 border border-white/5 rounded-2xl px-5 py-3 text-center min-w-[120px] flex-1"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1.5`} />
                <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value.toLocaleString('vi-VN')}</div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SESSION LIST */}
        <section className="space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Danh Sách Phiên Học
            </h3>

            {/* Filter Tabs */}
            <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filter === tab.key
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="glass-card-static border border-white/5 p-8 text-center">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Không có phiên học nào</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredSessions.map((sess, i) => (
                <button
                  key={sess.id}
                  onClick={() => navigate(`/teacher/report/${sess.id}`)}
                  className="glass-card-static p-4 sm:p-5 border border-white/5 shadow-md hover:border-indigo-500/20 hover:bg-white/[0.02] transition-all text-left group animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="font-bold text-white text-sm truncate">{sess.title}</h4>
                        {getStatusBadge(sess.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {sess.subject}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {sess.date}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:flex gap-4 text-center">
                        <div>
                          <div className="text-sm font-bold text-white font-mono">{sess.studentsCount}</div>
                          <div className="text-[9px] text-slate-500 uppercase">HS</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-indigo-400 font-mono">{sess.groupsCount}</div>
                          <div className="text-[9px] text-slate-500 uppercase">Nhóm</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-0.5">
                            <Sparkles className="w-3 h-3" />
                            {sess.totalXp}
                          </div>
                          <div className="text-[9px] text-slate-500 uppercase">XP</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* TOP STUDENTS LEADERBOARD */}
        {report.topStudents.length > 0 && (
          <section className="space-y-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Bảng Xếp Hạng Học Sinh
            </h3>

            <div className="glass-card-static overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-xs text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-5 font-bold">Hạng</th>
                      <th className="py-4 px-4 font-bold">Học sinh</th>
                      <th className="py-4 px-4 font-bold">Lớp</th>
                      <th className="py-4 px-4 font-bold text-center">Phiên tham gia</th>
                      <th className="py-4 px-4 font-bold text-center">Nhiệm vụ</th>
                      <th className="py-4 px-4 font-bold text-right">Tổng XP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {report.topStudents.map((student, index) => {
                      const isTop3 = index < 3
                      const rankColors = [
                        'text-amber-400 bg-amber-400/10 border-amber-400/20',
                        'text-slate-300 bg-slate-300/10 border-slate-300/20',
                        'text-amber-600 bg-amber-600/10 border-amber-600/20',
                      ]

                      return (
                        <tr key={student.studentId} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-4 px-5">
                            {isTop3 ? (
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border ${rankColors[index]}`}>
                                {index + 1}
                              </div>
                            ) : (
                              <span className="font-mono text-slate-500 pl-2">{index + 1}</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-white font-semibold">{student.displayName}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                              {student.className || 'Tự do'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="font-mono font-medium text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-white/5 text-xs">
                              {student.sessionsJoined}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="font-mono font-medium text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-white/5 text-xs">
                              {student.tasksCompleted}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="font-bold text-emerald-400 font-mono flex items-center justify-end gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              {student.totalXp.toLocaleString('vi-VN')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

      </main>

    </div>
  )
}
