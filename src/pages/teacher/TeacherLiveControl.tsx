import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Users, Activity, MessageSquare, Play, Pause, SkipForward, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSessionById, getLiveGroupStats } from '@/services/sessionService'
import { sendMessage, getSessionMessages, subscribeToMessages } from '@/services/messageService'
import { getCurrentUser } from '@/services/authService'
import {
  getRotationState,
  rotateAllGroups,
  rotateGroup,
  startTimer,
  pauseTimer,
  endSessionFromLive,
  getTimeRemaining,
} from '@/services/rotationService'
import type { Session, Station, Task, Message } from '@/types/database'

export function TeacherLiveControl() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [liveGroups, setLiveGroups] = useState<any[]>([])
  const [taskResults, setTaskResults] = useState<any[]>([])
  const [teacherProfile, setTeacherProfile] = useState<any>(null)

  // Rotation & Timer State
  const [rotationState, setRotationState] = useState<any>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('15')

  // Chat State
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [selectedRecipientType, setSelectedRecipientType] = useState<'all_groups' | 'group'>('all_groups')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  useEffect(() => {
    fetchInitial()
  }, [sessionId])

  const fetchInitial = async () => {
    try {
      if (!sessionId) return
      
      const auth = await getCurrentUser()
      setTeacherProfile(auth)

      const { session: s, stations: st, tasks: t } = await getSessionById(sessionId)
      setSession(s)
      setStations(st.sort((a,b) => a.order_num - b.order_num))
      setTasks(t)

      const groups = await getLiveGroupStats(sessionId)
      setLiveGroups(groups || [])

      // Lấy All Task Results cho Phiên để tính %
      const { data: results } = await supabase
        .from('task_results')
        .select('task_id, group_id')
        .in('task_id', t.map(x => x.id))
      setTaskResults(results || [])

      // Fetch Messages
      const msgs = await getSessionMessages(sessionId)
      setMessages(msgs)

      // Fetch Rotation State
      try {
        const rotState = await getRotationState(sessionId)
        setRotationState(rotState)
        if (rotState.timerEndAt) {
          setTimeRemaining(getTimeRemaining(rotState.timerEndAt))
          setIsTimerRunning(true)
        } else {
          setTimeRemaining(0)
          setIsTimerRunning(false)
        }
      } catch (err) {
        console.error('Lấy rotation state thất bại:', err)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    if (!sessionId) return

    // Theo dõi thay đổi Nhóm (Chuyển Góc / Quick Switch)
    const grpSub = supabase.channel(`groups_live_${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `session_id=eq.${sessionId}` }, (payload) => {
        setLiveGroups(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g))
        // Re-fetch rotation state
        getRotationState(sessionId).then(setRotationState).catch(console.error)
      })
      .subscribe()

    // Theo dõi tiến độ bài làm
    const trSub = supabase.channel(`task_results_live_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_results' }, (payload) => {
         setTaskResults(prev => [...prev, payload.new])
      })
      .subscribe()

    // Theo dõi tin nhắn
    const msgSub = subscribeToMessages(sessionId, (msg) => {
      setMessages(prev => [...prev, msg])
    })

    // Theo dõi session changes (để update timer realtime)
    const sessionSub = supabase.channel(`session_timer_${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        const newSess = payload.new as Session
        setSession(prev => prev ? { ...prev, ...newSess } : null)
        if (newSess.timer_end_at) {
          setTimeRemaining(getTimeRemaining(newSess.timer_end_at))
          setIsTimerRunning(true)
        } else {
          setTimeRemaining(0)
          setIsTimerRunning(false)
        }
        // Đồng thời re-fetch rotation state
        getRotationState(sessionId).then(setRotationState).catch(console.error)
      })
      .subscribe()

    return () => {
      grpSub.unsubscribe()
      trSub.unsubscribe()
      msgSub.unsubscribe()
      sessionSub.unsubscribe()
    }
  }, [sessionId])

  const handleRotateAll = async () => {
    if (!sessionId) return
    setIsRotating(true)
    try {
      await rotateAllGroups(sessionId)
      // Re-fetch groups and rotation state
      const groups = await getLiveGroupStats(sessionId)
      setLiveGroups(groups || [])
      const rotState = await getRotationState(sessionId)
      setRotationState(rotState)
      alert('Đã xoay góc thành công cho tất cả các nhóm!')
    } catch (err: any) {
      alert('Xoay góc thất bại: ' + err.message)
    } finally {
      setIsRotating(false)
    }
  }

  // Local countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev > 1) {
          return prev - 1
        }
        if (prev === 1) {
          if (isTimerRunning && session?.rotation_mode === 'fixed') {
            setIsTimerRunning(false)
            setTimeout(() => {
              handleRotateAll()
            }, 0)
          }
          return 0
        }
        return 0
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isTimerRunning, session, handleRotateAll])

  const handleStartTimer = async () => {
    if (!sessionId) return
    const mins = parseInt(customMinutes) || 15
    try {
      await startTimer(sessionId, mins)
      alert(`Đã bắt đầu bộ đếm ngược ${mins} phút!`)
    } catch (err: any) {
      alert('Lỗi bắt đầu timer: ' + err.message)
    }
  }

  const handlePauseTimer = async () => {
    if (!sessionId) return
    try {
      await pauseTimer(sessionId)
      alert('Đã tạm dừng bộ đếm ngược!')
    } catch (err: any) {
      alert('Lỗi tạm dừng timer: ' + err.message)
    }
  }

  const handleEndSession = async () => {
    if (!sessionId) return
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc phiên học này không? Tất cả học sinh sẽ được chuyển hướng ra phòng chờ.')) return
    setIsEnding(true)
    try {
      await endSessionFromLive(sessionId)
      alert('Đã kết thúc phiên học thành công!')
      navigate('/teacher/dashboard')
    } catch (err: any) {
      alert('Kết thúc phiên thất bại: ' + err.message)
    } finally {
      setIsEnding(false)
    }
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !sessionId || !teacherProfile) return

    const input = chatInput
    setChatInput('')

    try {
      await sendMessage({
        sessionId,
        senderType: 'teacher',
        senderId: teacherProfile.user.id,
        recipientType: selectedRecipientType,
        recipientGroupId: selectedRecipientType === 'group' ? selectedGroupId : undefined,
        content: input
      })
    } catch(err: any) {
      alert("Lỗi gửi tin: " + err.message)
    }
  }

  if (loading || !session) return <div className="p-8 text-white">Đang tải Radar...</div>

  return (
    <div className="min-h-dvh bg-[#0B0C10] flex flex-col md:flex-row font-sans text-slate-200">
      
      {/* ── BẢN ĐỒ LỚP HỌC (RADAR) ── */}
      <div className="flex-[2] p-6 border-r border-white/10 flex flex-col relative h-dvh overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/teacher/dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Live Radar: {session.title}</h1>
            <p className="text-xs text-slate-400 flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-500" /> Hệ thống đang theo dõi thời gian thực</p>
          </div>
        </div>

        {/* CONTROL PANEL */}
        <div className="bg-[#1A1C23] border border-indigo-500/20 rounded-xl p-5 shadow-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Clock & Round info */}
            <div className={`flex flex-col items-center justify-center p-3 rounded-xl bg-black/40 border border-white/5 min-w-[100px] ${timeRemaining < 60 && timeRemaining > 0 ? 'border-red-500 bg-red-500/10 animate-pulse' : ''}`}>
              <span className="text-xs text-slate-400 font-medium tracking-wide uppercase mb-1">⏳ Vòng {rotationState?.currentRound || 0}/{rotationState?.totalRounds || 0}</span>
              <span className="text-2xl font-mono font-bold text-white">
                {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:
                {(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-200">Điều Khiển Bộ Đếm</span>
              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="number"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-14 bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-center text-white focus:outline-none focus:border-indigo-500"
                  min="1"
                  max="120"
                />
                <span className="text-xs text-slate-400">phút</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
            {isTimerRunning ? (
              <button 
                onClick={handlePauseTimer}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                <Pause className="w-4 h-4" /> Tạm Dừng
              </button>
            ) : (
              <button 
                onClick={handleStartTimer}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                <Play className="w-4 h-4" /> Bắt Đầu
              </button>
            )}

            <button 
              onClick={handleRotateAll}
              disabled={isRotating}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/20 transition-all"
            >
              <SkipForward className="w-4 h-4" /> {isRotating ? 'Đang xoay...' : 'Chuyển Góc'}
            </button>

            <button 
              onClick={handleEndSession}
              disabled={isEnding}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            >
              <XCircle className="w-4 h-4" /> Kết Thúc
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
           {stations.map(station => {
             // Tìm nhóm đang ở góc này
             const stationGroups = liveGroups.filter(g => g.current_station_id === station.id)
             const stationTasksCount = tasks.filter(t => t.station_id === station.id).length

             return (
               <div key={station.id} className="bg-[#1A1C23] border border-white/5 rounded-xl p-5 shadow-lg">
                 <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                   <h2 className="font-bold text-lg text-emerald-300">📍 {station.name}</h2>
                   <span className="text-xs bg-black/30 px-2 py-1 rounded text-slate-400">Total Tasks: {stationTasksCount}</span>
                 </div>
                 
                 {stationGroups.length === 0 ? (
                   <p className="text-sm text-slate-500 italic px-2">Khung cảnh vắng vẻ... Không có nhóm nào tại đây.</p>
                 ) : (
                   <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                     {stationGroups.map(grp => {
                       // Lấy số task đã nộp ở góc này bởi nhóm này
                       const completedAtStation = taskResults.filter(
                         tr => tr.group_id === grp.id && tasks.find(t => t.id === tr.task_id)?.station_id === station.id
                       ).length
                       const pct = stationTasksCount === 0 ? 100 : Math.round((completedAtStation / stationTasksCount) * 100)
                       
                       // Tìm người đang cầm máy
                       const activeMember = (grp.group_members as any[])?.find(m => m.student_id === grp.active_student_id)
                       
                       return (
                         <div key={grp.id} className="bg-black/20 p-4 rounded-lg border border-white/5">
                           <div className="flex justify-between items-center mb-2">
                             <h3 className="font-semibold text-white flex items-center gap-2">
                               <Users className="w-4 h-4 text-cyan-400" /> {grp.name}
                             </h3>
                             <span className="text-xs font-mono text-emerald-400">{pct}%</span>
                           </div>
                           
                           {/* Thanh Tiến Độ */}
                           <div className="w-full h-1.5 bg-slate-800 rounded-full mb-3 overflow-hidden">
                             <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                           </div>

                           {/* Ai đang cầm máy */}
                           {session.device_mode === 'shared' && activeMember && (
                             <div className="text-xs flex items-center gap-2 bg-indigo-500/10 text-indigo-300 w-fit px-2 py-1 rounded-md border border-indigo-500/20">
                               <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                               Đang cầm máy: <strong className="font-bold">{activeMember.students.display_name}</strong>
                             </div>
                           )}

                           {/* Chuyển trạm thủ công cho nhóm này */}
                           <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                             <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">Chuyển Góc Thủ Công:</span>
                             <select
                               value={grp.current_station_id || ''}
                               onChange={async (e) => {
                                 const destId = e.target.value
                                 if (!destId) return
                                 try {
                                   await rotateGroup(grp.id, destId)
                                   // Re-fetch groups and rotation state
                                   const groups = await getLiveGroupStats(sessionId!)
                                   setLiveGroups(groups || [])
                                   const rotState = await getRotationState(sessionId!)
                                   setRotationState(rotState)
                                   alert(`Đã chuyển nhóm ${grp.name} sang góc mới!`)
                                 } catch (err: any) {
                                   alert('Chuyển góc thất bại: ' + err.message)
                                 }
                               }}
                               className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
                             >
                               <option value="" disabled>-- Chọn góc --</option>
                               {stations.map(st => (
                                 <option key={st.id} value={st.id}>{st.name}</option>
                               ))}
                             </select>
                           </div>
                         </div>
                       )
                     })}
                   </div>
                 )}
               </div>
             )
           })}
        </div>
      </div>

      {/* ── HỘP THƯ 2 CHIỀU (BROADCAST / DIRECT) ── */}
      <div className="flex-1 bg-[#12141A] flex flex-col h-[50vh] md:h-dvh">
        <div className="p-5 border-b border-white/10 flex flex-col gap-3">
          <h2 className="font-bold flex items-center gap-2 text-indigo-300"><MessageSquare className="w-5 h-5" /> Trạm Chỉ Huy Lớp</h2>
          
          <div className="flex gap-2">
            <select 
              value={selectedRecipientType}
              onChange={(e) => setSelectedRecipientType(e.target.value as any)}
              className="bg-black/30 border border-white/10 rounded-lg text-sm p-2 text-white outline-none focus:border-indigo-500"
            >
              <option value="all_groups">📢 Tất cả nhóm (Broadcast)</option>
              <option value="group">🎯 Gửi riêng 1 nhóm</option>
            </select>

            {selectedRecipientType === 'group' && (
              <select 
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg text-sm p-2 text-white outline-none focus:border-indigo-500"
              >
                <option value="">-- Chọn nhóm --</option>
                {liveGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map(msg => (
             <div key={msg.id} className={`flex ${msg.sender_type === 'teacher' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                 msg.sender_type === 'teacher' 
                   ? 'bg-indigo-600 text-white rounded-tr-sm' 
                   : 'bg-white/10 text-slate-200 rounded-tl-sm'
               }`}>
                  <div className="text-[10px] uppercase font-bold mb-1 opacity-70">
                    {msg.sender_type === 'teacher' ? 'Bạn' : `Nhóm (ID: ${msg.sender_id.substring(0,4)})`}
                    {msg.recipient_type === 'all_groups' && msg.sender_type === 'teacher' && ' → 📢 Tất cả'}
                    {msg.recipient_type === 'group' && ' → 🎯 Nhóm riêng'}
                  </div>
                  {msg.content}
               </div>
             </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20">
           <form onSubmit={handleSendChat} className="flex gap-2">
             <input
               value={chatInput}
               onChange={e => setChatInput(e.target.value)}
               placeholder="Nhập thông báo/chỉ đạo..."
               className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 text-sm text-white focus:border-indigo-500 outline-none"
             />
             <button type="submit" disabled={!chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50">
               <Send className="w-4 h-4" />
             </button>
           </form>
        </div>
      </div>
    </div>
  )
}
