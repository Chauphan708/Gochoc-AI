/* ═══════════════════════════════════════
   COLLABORATOR INVITE PAGE — GócHọc AI
   Mời Giáo viên phụ hoặc Người dự giờ
   ═══════════════════════════════════════ */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Copy, Check, Eye, ShieldAlert } from 'lucide-react'

export function CollaboratorInvite() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [role, setRole] = useState<'co_teacher' | 'observer'>('observer')

  const inviteLink = `${window.location.origin}/lobby/${sessionId}?role=${role}`

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-dvh bg-[#08090f] text-slate-200 font-sans flex items-center justify-center px-6">
      <div className="glass-card-static w-full max-w-md p-6 relative">
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-6 left-6 p-2 hover:bg-white/5 rounded-lg border border-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        
        <div className="text-center mt-12 mb-6">
          <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Mời Giáo Viên Phụ / Dự Giờ</h1>
          <p className="text-xs text-slate-400 mt-1">Phiên học: {sessionId}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Chọn vai trò mời
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole('co_teacher')}
                className={`p-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  role === 'co_teacher'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-white/5 hover:border-white/10 text-slate-400'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Giáo viên phụ</span>
              </button>
              <button
                onClick={() => setRole('observer')}
                className={`p-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  role === 'observer'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-white/5 hover:border-white/10 text-slate-400'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Người dự giờ</span>
              </button>
            </div>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1.5">Liên kết mời tham gia</div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost w-full mt-6 text-sm"
        >
          Xong
        </button>
      </div>
    </div>
  )
}
