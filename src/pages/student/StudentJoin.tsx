/* ═══════════════════════════════════════
   STUDENT JOIN PAGE — GócHọc AI
   HS nhập mã phiên 4 số để tham gia
   ═══════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GraduationCap, Hash, User, KeyRound } from 'lucide-react'
import { findSessionByJoinCode, joinLobby } from '@/services/sessionService'
import { loginStudent } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import type { Session } from '@/types/database'

export function StudentJoin() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [step, setStep] = useState(1) // 1: Join Code, 2: Student Login
  const [sessionInfo, setSessionInfo] = useState<Session | null>(null)
  
  // Step 1 states
  const [code, setCode] = useState(['', '', '', ''])
  
  // Step 2 states
  const [studentCode, setStudentCode] = useState('')
  const [pin, setPin] = useState('0000') // Default as per authService mockup
  const [nominatedRole, setNominatedRole] = useState<'leader' | 'secretary' | null>(null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    setError('')

    // Auto-focus next
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when complete
    if (index === 3 && value) {
      const fullCode = newCode.join('')
      if (fullCode.length === 4) {
        handleJoin(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    if (pasted.length === 4) {
      handleJoin(pasted)
    } else {
      inputRefs.current[pasted.length]?.focus()
    }
  }

  const handleJoin = async (fullCode: string) => {
    setIsLoading(true)
    setError('')

    try {
      const session = await findSessionByJoinCode(fullCode)
      if (!session) {
        throw new Error('Không tìm thấy phiên học')
      }
      setSessionInfo(session)
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Không tìm thấy phiên học. Kiểm tra lại mã.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStudentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentCode.trim()) return

    setIsLoading(true)
    setError('')
    try {
      const joinCodeStr = code.join('')
      const { student } = await loginStudent(joinCodeStr, studentCode, pin)
      setUser(student, 'student')
      
      // Join Lobby Logic (Realtime)
      if (sessionInfo?.id) {
         await joinLobby({
           sessionId: sessionInfo.id,
           studentId: student.id,
           nominatedRole: nominatedRole
         })
      }

      // Go to lobby
      navigate(`/lobby/${joinCodeStr}`)
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại ID.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center animate-scale-in">
        {/* Back */}
        <button
          id="btn-back-home-student"
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Trang chủ
        </button>

        {/* Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 animate-pulse-glow">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Tham gia phiên học</h1>
        <p className="text-slate-400 text-sm mb-8">
          {step === 1 ? 'Nhập mã phiên 4 số mà giáo viên cung cấp' : `Đã tìm thấy: ${sessionInfo?.title}`}
        </p>

        {step === 1 ? (
          <>
            {/* Code Input */}
            <div className="flex items-center justify-center gap-3 mb-6" onPaste={handlePaste}>
              <Hash className="w-5 h-5 text-slate-500" />
              {code.map((digit, i) => (
                <input
                  key={i}
                  id={`input-code-${i}`}
                  ref={(el) => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-14 h-16 text-center text-2xl font-bold rounded-xl transition-all outline-none ${
                    digit
                      ? 'bg-indigo-500/15 border-2 border-indigo-500/40 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 border-2 border-white/10 text-slate-400'
                  } focus:border-indigo-400 focus:bg-indigo-500/10 focus:shadow-lg focus:shadow-indigo-500/20`}
                  disabled={isLoading}
                />
              ))}
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-indigo-400 text-sm mb-4">
                <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                Đang tìm phiên học...
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleStudentLoginSubmit} className="space-y-4 text-left animate-fade-in">
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-indigo-300">Đang tham gia</div>
                <div className="font-bold text-white">{sessionInfo?.title}</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4" /> Mã Học Sinh (ID)
              </label>
              <input
                type="text"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                className="input"
                placeholder="VD: HS001"
                disabled={isLoading}
              />
            </div>
            
            {/* Optional PIN, hidden for MVP unless needed */}
            {/* 
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> PIN (Tùy chọn)
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="input"
                placeholder="Nhập PIN... (mặc định 0000)"
                disabled={isLoading}
              />
            </div>
            */}

            {/* Role Nomination Feature MVP */}
            {sessionInfo?.role_assignment === 'student_nominate' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2 mt-4 text-center">
                  Bạn có muốn tự ứng cử vai trò trong nhóm không?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${nominatedRole === 'leader' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                    <input type="radio" name="role" className="sr-only" checked={nominatedRole === 'leader'} onChange={() => setNominatedRole('leader')} />
                    <span className="text-2xl mb-1">👑</span>
                    <span className="text-xs font-semibold">Trưởng nhóm</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${nominatedRole === 'secretary' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                    <input type="radio" name="role" className="sr-only" checked={nominatedRole === 'secretary'} onChange={() => setNominatedRole('secretary')} />
                    <span className="text-2xl mb-1">✍️</span>
                    <span className="text-xs font-semibold">Thư ký</span>
                  </label>
                </div>
                {nominatedRole !== null && (
                  <div className="text-center mt-2">
                    <button type="button" onClick={() => setNominatedRole(null)} className="text-[10px] text-slate-500 underline hover:text-slate-300 transition-colors">Bỏ ứng cử</button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full mt-4"
              disabled={isLoading || !studentCode.trim()}
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                'Vào sảnh chờ'
              )}
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Link to teacher login */}
        <div className="mt-8">
          <button
            id="btn-teacher-login"
            onClick={() => navigate('/login')}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Giáo viên? Đăng nhập tại đây →
          </button>
        </div>
      </div>
    </div>
  )
}
