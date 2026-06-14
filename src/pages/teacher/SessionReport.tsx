/* ═══════════════════════════════════════
   SESSION REPORT PAGE — GócHọc AI
   Báo cáo tổng kết phiên học cho GV
   ═══════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Download, 
  Award, 
  Users, 
  BookOpen, 
  Layers, 
  ChevronRight, 
  Loader2,
  TrendingUp,
  Sparkles
} from 'lucide-react'
import { getSessionReport, exportToCSV } from '@/services/reportService'
import type { SessionReportData } from '@/services/reportService'

export function SessionReport() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<SessionReportData | null>(null)

  useEffect(() => {
    fetchReport()
  }, [sessionId])

  const fetchReport = async () => {
    try {
      if (!sessionId) return
      setLoading(true)
      const data = await getSessionReport(sessionId)
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
    exportToCSV(report)
  }

  if (loading || !report) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0f111a]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Đang tải và tổng hợp kết quả học tập...</p>
        </div>
      </div>
    )
  }

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
              <h1 className="font-bold text-white text-sm sm:text-base">Báo Cáo Kết Quả Học Tập</h1>
              <p className="text-xs text-slate-400">Phiên: {report.sessionTitle}</p>
            </div>
          </div>
          
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel / CSV</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-6xl mx-auto px-6 mt-8 space-y-8">
        
        {/* HERO HEADER STATUS */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-[#08090f] border border-indigo-500/10 p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-indigo-500/10 to-transparent blur-3xl -z-10 rounded-full" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Đã Hoàn Thành Phiên Học
              </div>
              <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                {report.sessionTitle}
              </h2>
              <p className="text-sm text-slate-400">
                Môn học: <strong className="text-indigo-300 font-semibold">{report.subject}</strong> • Ngày dạy: {report.date}
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-black/30 border border-white/5 rounded-2xl px-5 py-3 text-center min-w-[100px]">
                <div className="text-2xl font-bold text-white font-mono">{report.students.length}</div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">Học sinh tham gia</div>
              </div>
              <div className="bg-black/30 border border-white/5 rounded-2xl px-5 py-3 text-center min-w-[100px]">
                <div className="text-2xl font-bold text-indigo-400 font-mono">{report.groups.length}</div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">Nhóm học tập</div>
              </div>
              <div className="bg-black/30 border border-white/5 rounded-2xl px-5 py-3 text-center min-w-[100px]">
                <div className="text-2xl font-bold text-emerald-400 font-mono">{report.totalTasks}</div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">Tổng nhiệm vụ</div>
              </div>
            </div>
          </div>
        </div>

        {/* TWO SECTION GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT: GROUP PROGRESS */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Tiến Độ Nhóm
            </h3>
            
            <div className="space-y-3">
              {report.groups.map(grp => (
                <div key={grp.groupId} className="glass-card-static p-4 border border-white/5 shadow-md">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" /> {grp.groupName}
                    </h4>
                    <span className="text-xs text-indigo-300 font-semibold">{grp.pointsEarned} Pts</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-3">
                    <span>Thành viên: {grp.membersCount}</span>
                    <span>Hoàn thành: {grp.tasksCompleted}/{report.totalTasks}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all"
                      style={{ width: `${report.totalTasks > 0 ? (grp.tasksCompleted / report.totalTasks) * 100 : 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: STUDENT LEADERBOARD */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Bảng Vàng Cá Nhân (Rankings)
            </h3>
            
            <div className="glass-card-static overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-xs text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-5 font-bold">Hạng</th>
                      <th className="py-4 px-4 font-bold">Học sinh</th>
                      <th className="py-4 px-4 font-bold">Nhóm</th>
                      <th className="py-4 px-4 font-bold">Vai trò</th>
                      <th className="py-4 px-4 font-bold text-center">Nhiệm vụ</th>
                      <th className="py-4 px-4 font-bold text-right">Tổng XP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {report.students.map((student, index) => {
                      const isTop3 = index < 3
                      const rankColors = [
                        'text-amber-400 bg-amber-400/10 border-amber-400/20', // Vàng
                        'text-slate-300 bg-slate-300/10 border-slate-300/20', // Bạc
                        'text-amber-600 bg-amber-600/10 border-amber-600/20'  // Đồng
                      ]
                      
                      return (
                        <tr key={student.studentId} className="hover:bg-white/[0.01] transition-colors group">
                          {/* Rank */}
                          <td className="py-4 px-5">
                            {isTop3 ? (
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border ${rankColors[index]}`}>
                                {index + 1}
                              </div>
                            ) : (
                              <span className="font-mono text-slate-500 pl-2">{index + 1}</span>
                            )}
                          </td>
                          
                          {/* Profile */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold">{student.displayName}</span>
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                                Lớp {student.className}
                              </span>
                            </div>
                          </td>
                          
                          {/* Group */}
                          <td className="py-4 px-4">
                            <span className="text-slate-300 text-xs">{student.groupName}</span>
                          </td>
                          
                          {/* Role */}
                          <td className="py-4 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              student.role === 'Nhóm trưởng'
                                ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                                : student.role === 'Thư ký'
                                ? 'bg-blue-400/10 text-blue-400 border-blue-400/20'
                                : 'bg-slate-500/10 text-slate-400 border-white/5'
                            }`}>
                              {student.role}
                            </span>
                          </td>
                          
                          {/* Tasks Completed */}
                          <td className="py-4 px-4 text-center">
                            <span className="font-mono font-medium text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-white/5 text-xs">
                              {student.tasksCompleted} / {report.totalTasks}
                            </span>
                          </td>
                          
                          {/* XP */}
                          <td className="py-4 px-4 text-right">
                            <span className="font-bold text-emerald-400 font-mono flex items-center justify-end gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              {student.xpEarned}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
        </div>

      </main>
      
    </div>
  )
}
