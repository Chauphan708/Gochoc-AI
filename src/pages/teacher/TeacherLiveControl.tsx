import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Users, Activity, MessageSquare, Play, Pause, SkipForward, XCircle, Copy, QrCode, X } from 'lucide-react'
import QRCode from 'react-qr-code'
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
import { gradeTaskResultByTeacher } from '@/services/taskResultService'
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
  const [showQr, setShowQr] = useState(false)

  const copyJoinLink = () => {
    if (!session) return
    const link = `${window.location.origin}/student/join?code=${session.join_code}`
    navigator.clipboard.writeText(link)
    alert('Đã copy link tham gia!')
  }

  // Chat State
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [selectedRecipientType, setSelectedRecipientType] = useState<'all_groups' | 'group'>('all_groups')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  // Submissions review states
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'submissions'>('chat')
  const [editingResultId, setEditingResultId] = useState<string | null>(null)
  const [editFeedback, setEditFeedback] = useState<string>('')
  const [isSavingGrade, setIsSavingGrade] = useState<boolean>(false)

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
      if (s.rotation_time_minutes) {
        setCustomMinutes(s.rotation_time_minutes.toString())
      }
      setStations(st.sort((a,b) => a.order_num - b.order_num))
      setTasks(t)

      const groups = await getLiveGroupStats(sessionId)
      setLiveGroups(groups || [])

      // Lấy All Task Results cho Phiên đầy đủ thông tin
      const { data: results } = await supabase
        .from('task_results')
        .select('*')
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

    // Theo dõi tiến độ bài làm và cập nhật kết quả mới nhất
    const trSub = supabase.channel(`task_results_live_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_results' }, (payload) => {
         setTaskResults(prev => [...prev, payload.new])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_results' }, (payload) => {
         setTaskResults(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
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
            <div className={`flex flex-col items-center justify-center p-3 rounded-xl bg-black/40 border border-white/5 min-w-[100px] ${timeRemaining < 60 && timeRemaining > 0 ? 'border-red-500 bg-red-500/10 animate-pulse' : ''}`}>
              <span className="text-xs text-slate-400 font-medium tracking-wide uppercase mb-1">⏳ Vòng {rotationState?.currentRound || 0}/{rotationState?.totalRounds || 0}</span>
              <span className="text-2xl font-mono font-bold text-white">
                {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:
                {(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
            
            {/* Join Code Display */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 relative ml-2">
              <span className="text-xs text-indigo-300 font-medium tracking-wide uppercase mb-1">Mã tham gia</span>
              <span className="text-2xl font-mono font-bold text-indigo-400">
                {session.join_code}
              </span>
              <div className="absolute -top-3 -right-3 flex gap-1">
                <button onClick={copyJoinLink} className="p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-transform hover:scale-110" title="Copy Link">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowQr(true)} className="p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-transform hover:scale-110" title="Mã QR">
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              </div>
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

      {/* ── HỘP THƯ 2 CHIỀU (BROADCAST / DIRECT) / BÀI LÀM HS ── */}
      <div className="flex-1 bg-[#12141A] flex flex-col h-[50vh] md:h-dvh">
        <div className="p-5 border-b border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2 text-indigo-300">
              <MessageSquare className="w-5 h-5" /> Trạm Chỉ Huy Lớp
            </h2>
            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10 text-xs">
              <button 
                onClick={() => setActiveRightTab('chat')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${activeRightTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                💬 Chỉ đạo & Chat
              </button>
              <button 
                onClick={() => setActiveRightTab('submissions')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer relative ${activeRightTab === 'submissions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                📝 Bài làm HS
                {taskResults.filter(r => r.grading_status === 'pending_teacher').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            </div>
          </div>
          
          {activeRightTab === 'chat' && (
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
          )}
        </div>

        {activeRightTab === 'chat' ? (
          <>
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
          </>
        ) : (
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span>Danh sách học sinh nộp bài trong phiên</span>
              <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-mono font-bold">Tổng nộp: {taskResults.length}</span>
            </div>

            {taskResults.length === 0 ? (
              <div className="text-center py-10 text-slate-500 italic text-sm">Chưa có học sinh nào nộp bài.</div>
            ) : (
              [...taskResults].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).map(result => {
                const task = tasks.find(t => t.id === result.task_id)
                const station = stations.find(s => s.id === task?.station_id)
                const group = liveGroups.find(g => g.id === result.group_id)
                if (!task) return null

                const isEditing = editingResultId === result.id

                return (
                  <div key={result.id} className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3 relative hover:border-white/10 transition-colors">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          📍 {station?.name || 'Trạm'} &gt; {task.title}
                        </span>
                        <span className="text-xs text-white font-semibold">
                          Nhóm: {group?.name || 'Chưa rõ'} • Người nộp: {result.submitted_by.substring(0, 5)}
                        </span>
                      </div>
                      {result.grading_status === 'pending_teacher' ? (
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/20 text-amber-400 animate-pulse border border-amber-500/30">
                          ⏳ Chờ GV chấm
                        </span>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${result.grading_status === 'graded' ? 'bg-emerald-500/10 text-emerald-400' : result.grading_status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {result.grading_status === 'graded' ? 'Đạt' : result.grading_status === 'rejected' ? 'Chưa đạt' : 'Đang chấm'}
                        </span>
                      )}
                    </div>

                    {/* Content Detail */}
                    <div className="text-xs bg-white/5 p-3 rounded-lg border border-white/5 space-y-2">
                      {task.type === 'quiz' && (
                        <div className="text-slate-400">Bài thi trắc nghiệm (Tự động chấm)</div>
                      )}
                      
                      {task.type === 'short_answer' && (
                        <div>
                          <span className="font-bold text-slate-400 block">Câu trả lời:</span>
                          <p className="text-slate-200 italic mt-0.5">"{result.answer?.text}"</p>
                        </div>
                      )}

                      {task.type === 'photo_upload' && (
                        <div className="space-y-2">
                          <span className="font-bold text-slate-400 block">Ảnh đã chụp:</span>
                          <a href={result.answer?.url} target="_blank" rel="noreferrer" className="block max-w-full">
                            <img src={result.answer?.url} alt="Nộp bài" className="max-h-32 rounded border border-white/10 object-cover" />
                          </a>
                        </div>
                      )}

                      {task.type === 'practice' && (
                        <div>
                          <span className="font-bold text-slate-400 block">Kết quả thực hành:</span>
                          <p className="text-slate-200 mt-0.5">"{result.answer?.text || 'Đã báo nộp trạm thực hành'}"</p>
                        </div>
                      )}

                      {/* Feedback AI */}
                      {result.feedback && (
                        <div className="pt-2 border-t border-white/5">
                          <span className="font-bold text-indigo-300 block">🤖 Nhận xét AI:</span>
                          <p className="text-slate-300 mt-0.5">{result.feedback}</p>
                        </div>
                      )}
                    </div>

                    {/* Teacher Override Grading Area */}
                    {task.type !== 'quiz' && (
                      <div className="pt-1">
                        {!isEditing ? (
                          <button 
                            onClick={() => {
                              setEditingResultId(result.id)
                              setEditFeedback(result.feedback || '')
                            }}
                            className="btn btn-ghost btn-sm text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                          >
                            📝 Chấm điểm / Duyệt lại
                          </button>
                        ) : (
                          <form 
                            onSubmit={(e) => e.preventDefault()}
                            className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-3"
                          >
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">Nhận xét của GV (Bắt buộc nếu Chưa đạt):</label>
                              <textarea 
                                value={editFeedback}
                                onChange={e => setEditFeedback(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded p-2 text-xs text-white focus:outline-none w-full"
                                rows={2}
                                placeholder="Gõ nhận xét khuyến khích hoặc yêu cầu sửa đổi..."
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                              <button 
                                type="button" 
                                onClick={() => setEditingResultId(null)}
                                className="px-3 py-1.5 bg-white/5 text-slate-400 text-xs font-medium rounded hover:bg-white/10 cursor-pointer"
                                disabled={isSavingGrade}
                              >
                                Hủy
                              </button>
                              <button 
                                type="button" 
                                onClick={async () => {
                                  if (!editFeedback.trim()) {
                                    alert('Vui lòng nhập nhận xét vì sao chưa đạt để HS biết cách sửa.')
                                    return
                                  }
                                  setIsSavingGrade(true)
                                  try {
                                    const updated = await gradeTaskResultByTeacher(result.id, 'rejected', editFeedback)
                                    setTaskResults(prev => prev.map(r => r.id === result.id ? updated : r))
                                    setEditingResultId(null)
                                  } catch (err: any) {
                                    alert('Đánh giá thất bại: ' + err.message)
                                  } finally {
                                    setIsSavingGrade(false)
                                  }
                                }}
                                className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded border border-red-500/30 hover:bg-red-500/30 cursor-pointer flex items-center gap-1"
                                disabled={isSavingGrade}
                              >
                                ❌ Chưa đạt
                              </button>
                              <button 
                                type="button"
                                onClick={async () => {
                                  setIsSavingGrade(true)
                                  try {
                                    const updated = await gradeTaskResultByTeacher(result.id, 'approved', editFeedback)
                                    setTaskResults(prev => prev.map(r => r.id === result.id ? updated : r))
                                    setEditingResultId(null)
                                  } catch (err: any) {
                                    alert('Đánh giá thất bại: ' + err.message)
                                  } finally {
                                    setIsSavingGrade(false)
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-500 cursor-pointer flex items-center gap-1"
                                disabled={isSavingGrade}
                              >
                                ✅ Đạt
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
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
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full">
              <div className="bg-white p-6 rounded-2xl flex items-center justify-center shadow-inner shrink-0 w-64 md:w-auto">
                <QRCode
                  value={`${window.location.origin}/student/join?code=${session.join_code}`}
                  size={400}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox={`0 0 400 400`}
                />
              </div>
              
              <div className="flex flex-col flex-1 w-full max-w-sm text-center md:text-left">
                 <p className="text-slate-400 mb-3 text-lg">Hoặc truy cập bằng link:</p>
                 <div className="bg-black/50 p-4 rounded-xl border border-white/10 font-mono text-2xl text-indigo-400 break-all mb-6">
                    {`${window.location.origin}/student/join?code=${session.join_code}`}
                 </div>

                 <button onClick={copyJoinLink} className="btn btn-secondary w-full text-xl py-4 flex items-center justify-center">
                   <Copy className="w-6 h-6 mr-2" />
                   Copy Link
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
