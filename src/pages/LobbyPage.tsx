/* ═══════════════════════════════════════
   LOBBY PAGE — GócHọc AI
   Phòng chờ: HS chờ GV bắt đầu phiên
   ═══════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Users,
  Clock,
  BookOpen,
  Layers,
  Wifi,
  WifiOff,
  CheckCircle2,
  Circle,
  Crown,
  LogOut,
  Copy,
  QrCode,
  X,
  PenLine,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import {
  findSessionByJoinCode, 
  getLobbyParticipants, 
  subscribeToLobby, 
  subscribeToSessionStatus,
  joinLobby,
  leaveLobby,
  createGroupsInLobby,
  getSessionById,
  startSession,
  getStudentCurrentStation,
  createEmptyGroups,
  joinGroupStudentChoice
} from '@/services/sessionService'
import type { Session } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

export function LobbyPage() {
  const { sessionId } = useParams() // this is actually joinCode
  const navigate = useNavigate()
  const { user, role } = useAuthStore()
  
  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [isGrouping, setIsGrouping] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [stationLoading, setStationLoading] = useState(false)
  const [targetStationId, setTargetStationId] = useState<string | null>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [showQr, setShowQr] = useState(false)

  const copyJoinLink = () => {
    if (!session) return
    const link = `${window.location.origin}/student/join?code=${session.join_code}`
    navigator.clipboard.writeText(link)
    alert('Đã copy link tham gia!')
  }

  useEffect(() => {
    if (!sessionId) return
    loadSession()
  }, [sessionId])

  useEffect(() => {
    if (!session?.id || !user?.id) return
    
    // 1. Participant join lobby
    if (role === 'student') {
      joinLobby({ sessionId: session.id, studentId: user.id }).catch(console.error)
    }

    loadParticipants()
    
    // 2. Subscribe to participant changes
    const participantChannel = subscribeToLobby(session.id, () => {
      loadParticipants()
    })

    // 3. Subscribe to session status changes (for students)
    const statusChannel = subscribeToSessionStatus(session.id, (newStatus) => {
       setSession(prev => prev ? { ...prev, status: newStatus as any } : null)
    })
    
    return () => {
      participantChannel.unsubscribe()
      statusChannel.unsubscribe()
      // Nếu là học sinh rời trang, set offline
      if (user && session.id && role !== 'teacher') {
         leaveLobby(session.id, user.id).catch(console.error)
      }
    }
  }, [session?.id, user?.id])

  const loadSession = async () => {
    try {
      const data = await findSessionByJoinCode(sessionId!)
      if (data) {
        setSession(data)
      } else {
        alert('Phiên học không tồn tại')
        navigate('/')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadParticipants = async () => {
    if (!session?.id) return
    try {
      const data = await getLobbyParticipants(session.id)
      setParticipants(data || [])

      if (session.grouping_mode === 'student_choice') {
        const { data: grps } = await supabase
          .from('groups')
          .select('id, name, group_members(id)')
          .eq('session_id', session.id)
        setGroups(grps || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  // Chuyển hướng HS khi phiên học Started
  useEffect(() => {
    if (session?.status === 'active' && role === 'student' && !stationLoading && !targetStationId) {
       handleStudentTransition()
    }
  }, [session?.status])

  const handleStudentTransition = async () => {
     if (!session?.id || !user?.id) return
     setStationLoading(true)
     try {
       const info = await getStudentCurrentStation(session.id, user.id)
       if (info?.stationId) {
          setTargetStationId(info.stationId)
          // Đợi 2 giây Loading mượt hiệu ứng hầm thời gian 
          setTimeout(() => {
             navigate(`/student/station/${session.id}/${info.stationId}`) 
          }, 2000)
       } else {
          alert('Bạn chưa được phân hành trình. Vui lòng liên hệ Giáo viên.')
          setStationLoading(false)
       }
     } catch(e) {
       console.error(e)
       setStationLoading(false)
     }
  }

  const handleCreateGroups = async () => {
    if (!session?.id) return
    setIsGrouping(true)
    try {
      const { stations } = await getSessionById(session.id)
      const stationIds = stations.map((s) => s.id)
      if (stationIds.length === 0) {
        alert('Phiên học chưa thiết lập Trạm. Đi tới Thiết kế nhiệm vụ.')
        setIsGrouping(false)
        return
      }

      const onlineParticipants = participants
         .filter(p => p.is_online)
         .map(p => ({
            student_id: p.student_id,
            nominated_role: p.nominated_role
         }))
      
      await createGroupsInLobby(session.id, onlineParticipants, session.group_size || 4, stationIds)
      
    } catch (e: any) {
      alert(e.message)
    } finally {
      setIsGrouping(false)
    }
  }

  const handleStartSession = async () => {
    if (!session?.id) return
    setIsStarting(true)
    try {
      await startSession(session.id)
      navigate(`/teacher/live/${session.id}`)
    } catch (e: any) {
      alert(e.message)
      setIsStarting(false)
    }
  }

  if (stationLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#1a1a2e]">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/30 mb-8 border border-emerald-500/30">
           <Layers className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 tracking-wide animate-fade-in text-center">
          Vào Trạm Trải Nghiệm
        </h1>
        <p className="text-slate-400 text-sm mb-12 animate-fade-in animate-delay-100 text-center max-w-sm">
          Đang tải dữ liệu trạm học, bạn chuẩn bị sẵn sàng nhé...
        </p>
        <div className="flex gap-2">
           <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
           <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
           <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    )
  }

  if (!session) return <div className="min-h-dvh flex items-center justify-center text-white"><span className="animate-pulse">Đang tải...</span></div>

  const onlineCount = participants.filter((p) => p.is_online).length

  return (
    <div className="min-h-dvh px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Session Header */}
        <div className="glass-card-static p-6 mb-6 animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                {session.title}
              </h1>
              <p className="text-sm text-slate-400 mt-1">{session.subject || 'Không có môn học'}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300">
                <Circle className="w-2 h-2 fill-current animate-pulse" />
                Đang chờ
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn rời khỏi sảnh chờ này không?')) {
                    navigate(role === 'teacher' ? '/teacher/dashboard' : '/');
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
                title="Thoát phiên"
              >
                <LogOut className="w-3.5 h-3.5" />
                Thoát
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-white/5 relative group">
              <div className="text-2xl font-bold text-indigo-400">
                {session.join_code}
              </div>
              <div className="text-xs text-slate-400 mt-1">Mã phiên</div>
              {role === 'teacher' && (
                <div className="absolute top-1 right-1 flex gap-1">
                  <button onClick={copyJoinLink} className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-indigo-300" title="Copy Link">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowQr(true)} className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-indigo-300" title="Mã QR">
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                {onlineCount}
              </div>
              <div className="text-xs text-slate-400 mt-1">Đã vào</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <div className="text-2xl font-bold text-purple-400 flex items-center justify-center gap-1">
                <Layers className="w-5 h-5" />
                {session.max_stations}
              </div>
              <div className="text-xs text-slate-400 mt-1">Góc học</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <div className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-1">
                <Clock className="w-5 h-5" />
                {session.rotation_time_minutes}
              </div>
              <div className="text-xs text-slate-400 mt-1">Phút/vòng</div>
            </div>
          </div>

          {session.device_mode === 'shared' && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>
                Chế độ nhóm chung thiết bị — Quick Switch sẽ được kích hoạt khi bắt đầu
              </span>
            </div>
          )}
        </div>

        {/* Cấu hình Teacher Controls (nếu là GV sở hữu) */}
        {user?.id === session.teacher_id && (
           <div className="glass-card-static p-6 mb-6 animate-fade-in border-indigo-500/30">
              <h2 className="font-semibold text-white mb-3">🛠️ Quyền điều khiển Giáo viên</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                 <button 
                   className="btn btn-primary flex-1"
                   onClick={handleStartSession}
                   disabled={isStarting}
                 >
                    {isStarting ? 'Đang kích hoạt...' : '▶ Bắt đầu phiên học ngay'}
                 </button>
                 {(session.grouping_mode === 'random' || session.grouping_mode === 'gender_balanced') && (
                    <button 
                       className="btn btn-ghost flex-1 border-dashed"
                       onClick={handleCreateGroups}
                       disabled={isGrouping}
                    >
                       {isGrouping ? 'Đang chia...' : session.grouping_mode === 'gender_balanced' ? '⚖️ Ghép cân bằng nam/nữ' : '🎲 Ghép nhóm ngẫu nhiên'}
                    </button>
                 )}
                 {session.grouping_mode === 'manual' && (
                    <button 
                       className="btn btn-ghost flex-1 border-dashed"
                       onClick={async () => {
                         if (window.confirm('Chế độ phân nhóm thủ công đang được chuẩn bị. Bạn có muốn sử dụng ghép nhóm ngẫu nhiên để tiếp tục nhanh không?')) {
                           await handleCreateGroups()
                         }
                       }}
                       disabled={isGrouping}
                    >
                       ✋ Phân nhóm thủ công (Bấm để ghép nhanh)
                    </button>
                 )}
                 {session.grouping_mode === 'student_choice' && (
                    <button 
                       className="btn btn-ghost flex-1 border-dashed"
                       onClick={async () => {
                         try {
                           setIsGrouping(true)
                           const { stations } = await getSessionById(session.id)
                           const stationIds = stations.map(s => s.id)
                           if (stationIds.length === 0) {
                             alert('Phiên chưa thiết lập trạm!')
                             return
                           }
                           const numGroups = Math.ceil(participants.length / (session.group_size || 4))
                           await createEmptyGroups(session.id, numGroups, stationIds)
                           alert('Đã mở đăng ký nhóm thành công! Học sinh đã có thể chọn nhóm.')
                         } catch (e: any) {
                           alert(e.message)
                         } finally {
                           setIsGrouping(false)
                         }
                       }}
                       disabled={isGrouping}
                    >
                       🙋 Mở cổng HS tự chọn nhóm
                    </button>
                 )}
              </div>
           </div>
        )}

        {/* Student Choice Group Selector */}
        {role === 'student' && session.grouping_mode === 'student_choice' && !(participants.find(p => p.student_id === user?.id)?.group_id) && groups.length > 0 && (
          <div className="glass-card-static p-6 mb-6 animate-fade-in border-emerald-500/30">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              🎯 Tự chọn nhóm học của bạn
            </h2>
            <p className="text-xs text-slate-400 mb-4">Hãy chọn một nhóm còn chỗ để gia nhập cùng các bạn khác nhé!</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((grp) => {
                const memberCount = grp.group_members?.length || 0
                const isFull = memberCount >= (session.group_size || 4)
                return (
                  <div key={grp.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">{grp.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Thành viên: {memberCount}/{session.group_size || 4}</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!user) {
                            alert('Vui lòng đăng nhập!')
                            return
                          }
                          await joinGroupStudentChoice(grp.id, user.id, 'member')
                          alert('Gia nhập nhóm thành công!')
                          loadParticipants()
                        } catch (err: any) {
                          alert('Lỗi gia nhập nhóm: ' + err.message)
                        }
                      }}
                      disabled={isFull}
                      className={`btn btn-sm ${isFull ? 'btn-ghost text-slate-500 cursor-not-allowed' : 'btn-primary'}`}
                    >
                      {isFull ? 'Đầy chỗ' : 'Gia nhập'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Students List */}
        <div className="glass-card-static p-6 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Học sinh ({onlineCount} online)
            </h2>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Wifi className="w-3 h-3 text-emerald-400" /> Realtime
            </div>
          </div>

          <div className="space-y-2">
            {isLoading ? (
               <div className="text-center py-4 text-slate-400 text-sm">Đang tải danh sách...</div>
            ) : participants.length === 0 ? (
               <div className="text-center py-4 text-slate-400 text-sm">Chưa có học sinh nào tham gia</div>
            ) : (
                participants.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all animate-fade-in ${
                      p.is_online ? 'bg-white/5' : 'bg-white/[0.02] opacity-60'
                    }`}
                    style={{ animationDelay: `${0.2 + i * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="text-2xl">{p.student?.avatar_url || '🧑'}</span>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1a2e] ${
                            p.is_online ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm flex items-center gap-1.5">
                          {p.student?.display_name || 'Học sinh'}
                          {p.nominated_role === 'leader' && (
                            <span title="Ứng cử Nhóm trưởng"><Crown className="w-3 h-3 text-amber-400" /></span>
                          )}
                          {p.nominated_role === 'secretary' && (
                            <span title="Ứng cử Thư ký"><PenLine className="w-3 h-3 text-blue-400" /></span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                           {p.group_id ? 'Đã có nhóm' : 'Đang chờ xếp nhóm'}
                           {p.student?.class_name ? ` • Lớp ${p.student.class_name}` : ''}
                        </div>
                      </div>
                    </div>
                    <div>
                      {p.is_online ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="inline-flex items-center gap-2 text-sm text-slate-400">
            <span className="flex gap-1">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </span>
            Đang chờ giáo viên bắt đầu phiên học
          </div>
        </div>
      </div>

      {/* Modal QR Code */}
      {showQr && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-[800px] w-full shadow-2xl relative my-8">
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <h3 className="text-4xl font-bold text-white mb-4 text-center mt-4">Quét mã để tham gia</h3>
            <p className="text-xl text-slate-400 mb-8 text-center">Học sinh dùng Zalo hoặc Camera để quét mã này</p>
            
            <div className="bg-white p-6 rounded-2xl flex items-center justify-center mb-8 w-fit mx-auto shadow-inner">
              <QRCode
                value={`${window.location.origin}/student/join?code=${session.join_code}`}
                size={640}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 640 640`}
              />
            </div>
            
            <div className="text-center mb-8">
               <p className="text-slate-400 mb-3 text-lg">Hoặc truy cập bằng link:</p>
               <div className="bg-black/50 p-4 rounded-xl border border-white/10 font-mono text-2xl md:text-3xl text-indigo-400 break-all">
                  {`${window.location.origin}/student/join?code=${session.join_code}`}
               </div>
            </div>

            <div className="flex justify-center">
               <button onClick={copyJoinLink} className="btn btn-secondary w-full max-w-md text-xl py-4">
                 <Copy className="w-6 h-6 mr-2" />
                 Copy Link
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
