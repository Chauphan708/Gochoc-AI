/* ═══════════════════════════════════════
   STUDENT STATION VIEW — GócHọc AI
   Giao diện HS tại Góc học (Hỗ trợ Quick Switch, Quiz UI)
   ═══════════════════════════════════════ */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Crown, PenLine, ChevronDown, Loader2, ArrowRight, Camera, CheckCircle2, Send, MessageSquare, Award, WifiOff, Users, Clock } from 'lucide-react'
import { AIChatWindow } from '@/components/Student/AIChatWindow'
import { StudentProfileDrawer } from '@/components/Student/StudentProfileDrawer'
import { getCurrentUser } from '@/services/authService'
import { getSessionById, getStudentCurrentStation, getGroupMembers, updateGroupActiveStudent } from '@/services/sessionService'
import { cacheData, getCachedData, queueOfflineAction } from '@/services/offlineService'
import { supabase } from '@/lib/supabase'
import { submitTask } from '@/services/taskResultService'
import { subscribeToRotation, subscribeToSessionStatus, getTimeRemaining } from '@/services/rotationService'
import { uploadTaskImage, createCameraInput } from '@/services/storageService'
import type { Station, Task } from '@/types/database'

export function StudentStation() {
  const { sessionId, stationId } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [submitting, setSubmitting] = useState<string | null>(null) // taskId đang submit
  const [station, setStation] = useState<Station | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [group, setGroup] = useState<any>(null)
  const [groupMembers, setGroupMembers] = useState<any[]>([])
  const [sessionTitle, setSessionTitle] = useState('')
  const [deviceMode, setDeviceMode] = useState<string>('individual')

  // Quick Switch state
  const [activeStudentId, setActiveStudentId] = useState('')
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  // Answers State
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({})
  const [taskTags, setTaskTags] = useState<Record<string, string[]>>({})
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({})
  const [taskResults, setTaskResults] = useState<Record<string, any>>({})
  
  // Timer state (server-synced)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [timerEndAt, setTimerEndAt] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Photo upload state
  const [uploadingTask, setUploadingTask] = useState<string | null>(null)
  const [uploadedPhotos, setUploadedPhotos] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchData()
  }, [sessionId, stationId])

  const fetchData = async () => {
    try {
      setLoading(true)
      if (!sessionId || !stationId) throw new Error("Thiếu URL Params")

      // 1. Phải đăng nhập
      const auth = await getCurrentUser()
      if (!auth || auth.role !== 'student') throw new Error("Chưa đăng nhập")
      setActiveStudentId(auth.user.id)

      let currentStationInfo: any = null
      let members: any[] = []
      let sessionData: any = null
      const isOnline = navigator.onLine

      if (isOnline) {
        // 2. Lấy Group của HS
        currentStationInfo = await getStudentCurrentStation(sessionId, auth.user.id)
        if (!currentStationInfo) throw new Error("Bạn chưa được phân nhóm trong phiên này")
        await cacheData(`student_station_${sessionId}_${auth.user.id}`, currentStationInfo)

        // 3. Lấy members của Group
        members = await getGroupMembers(currentStationInfo.groupId)
        await cacheData(`group_members_${currentStationInfo.groupId}`, members)

        // 4. Lấy dữ liệu Phiên & Trạm & Task
        sessionData = await getSessionById(sessionId)
        await cacheData(`session_${sessionId}`, sessionData)
      } else {
        // Đọc từ Cache ngoại tuyến
        currentStationInfo = await getCachedData(`student_station_${sessionId}_${auth.user.id}`)
        if (!currentStationInfo) throw new Error("Không có dữ liệu offline của trạm này. Vui lòng kết nối mạng để tải dữ liệu.")

        members = await getCachedData(`group_members_${currentStationInfo.groupId}`) || []
        sessionData = await getCachedData(`session_${sessionId}`)
        if (!sessionData) throw new Error("Không tìm thấy dữ liệu phiên học được lưu offline.")
      }

      setGroupMembers(members)
      setGroup({ id: currentStationInfo.groupId })

      const { session, stations, tasks: allTasks } = sessionData
      setSessionTitle(session.title)
      setDeviceMode(session.device_mode || 'individual')
      setTimerEndAt(session.timer_end_at ?? null)
      setTimeRemaining(getTimeRemaining(session.timer_end_at ?? null))
      
      const currentDbStation = stations.find((s: any) => s.id === stationId)
      if (!currentDbStation) throw new Error("Không tìm thấy trạm hiện tại")
      setStation(currentDbStation)

      const dbTasks = allTasks.filter((t: any) => t.station_id === stationId)
      setTasks(dbTasks)

      // Query existing task results to recover state
      if (isOnline) {
        const { data: resultsData } = await supabase
          .from('task_results')
          .select('*')
          .eq('group_id', currentStationInfo.groupId)
          .order('completed_at', { ascending: true })
        
        const completedMap: Record<string, boolean> = {}
        const resultMap: Record<string, any> = {}
        
        // Restore answers to state so if rejected, student can edit them
        const restoredText: Record<string, string> = {}
        const restoredPhotos: Record<string, string> = {}
        const restoredQuiz: Record<string, number[]> = {}
        
        ;(resultsData ?? []).forEach((res: any) => {
          const taskObj = dbTasks.find((t: any) => t.id === res.task_id)
          if (taskObj) {
            let isMyResult = false
            if (taskObj.scoring_mode === 'individual') {
              if (res.submitted_by === auth.user.id) {
                isMyResult = true
              }
            } else {
              isMyResult = true
            }

            if (isMyResult) {
              completedMap[res.task_id] = res.grading_status !== 'rejected'
              resultMap[res.task_id] = res

              // Restore answers
              if (taskObj.type === 'short_answer' && res.answer?.text) {
                restoredText[res.task_id] = res.answer.text
              } else if (taskObj.type === 'photo_upload' && res.answer?.url) {
                restoredPhotos[res.task_id] = res.answer.url
              } else if (taskObj.type === 'quiz' && res.answer?.answers) {
                restoredQuiz[res.task_id] = res.answer.answers
              }
            }
          }
        })
        
        setCompletedTasks(completedMap)
        setTaskResults(resultMap)
        setTextAnswers(restoredText)
        setUploadedPhotos(restoredPhotos)
        setQuizAnswers(restoredQuiz)
      }
    } catch (err: any) {
      alert(err.message)
      navigate('/student/join')
    } finally {
      setLoading(false)
    }
  }

  // ─── REALTIME: Lắng nghe GV chuyển góc ────
  useEffect(() => {
    if (!sessionId || !group) return

    const rotationChannel = subscribeToRotation(sessionId, (payload) => {
      const newRow = payload.new as any
      // Chỉ xử lý nếu đây là group của mình
      if (newRow?.id === group.id && newRow.current_station_id && newRow.current_station_id !== stationId) {
        setIsRotating(true)
        // Delay 2s cho animation rồi navigate
        setTimeout(() => {
          navigate(`/student/station/${sessionId}/${newRow.current_station_id}`, { replace: true })
        }, 2000)
      }
    })

    const statusChannel = subscribeToSessionStatus(sessionId, (newStatus) => {
      if (newStatus === 'completed' || newStatus === 'ended') {
        alert('Phiên học đã kết thúc. Cảm ơn các em!')
        navigate('/student/join')
      }
    })

    return () => {
      rotationChannel.unsubscribe()
      statusChannel.unsubscribe()
    }
  }, [sessionId, group?.id, stationId])

  // ─── SERVER-SYNCED COUNTDOWN TIMER ───────────
  useEffect(() => {
    // Tick every second locally
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    // Re-sync from server every 30s
    syncRef.current = setInterval(async () => {
      if (!sessionId) return
      try {
        const { data } = await supabase
          .from('sessions')
          .select('timer_end_at')
          .eq('id', sessionId)
          .single()
        if (data?.timer_end_at) {
          setTimerEndAt(data.timer_end_at)
          setTimeRemaining(getTimeRemaining(data.timer_end_at))
        }
      } catch { /* soft fail */ }
    }, 30000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (syncRef.current) clearInterval(syncRef.current)
    }
  }, [sessionId])

  // Re-calc remaining when timerEndAt changes (from Realtime)
  useEffect(() => {
    if (timerEndAt) {
      setTimeRemaining(getTimeRemaining(timerEndAt))
    }
  }, [timerEndAt])

  // Offline status tracking
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const activeStudent = groupMembers.find(m => m.student_id === activeStudentId)

  const switchStudent = async (id: string) => {
    setActiveStudentId(id)
    setIsQuickSwitchOpen(false)
    if (group?.id) {
       updateGroupActiveStudent(group.id, id).catch(e => console.error(e))

       // Re-evaluate completed tasks for the newly active student
       try {
         const { data: resultsData } = await supabase
           .from('task_results')
           .select('*')
           .eq('group_id', group.id)
         
         const completedMap: Record<string, boolean> = {}
         const resultMap: Record<string, any> = {}
         
         ;(resultsData ?? []).forEach((res: any) => {
           const taskObj = tasks.find((t: any) => t.id === res.task_id)
           if (taskObj) {
             if (taskObj.scoring_mode === 'individual') {
               if (res.submitted_by === id) {
                 completedMap[res.task_id] = true
                 resultMap[res.task_id] = res
               }
             } else {
               completedMap[res.task_id] = true
               resultMap[res.task_id] = res
             }
           }
         })
         
         setCompletedTasks(completedMap)
         setTaskResults(resultMap)
       } catch (err) {
         console.error('Failed to switch student tasks state:', err)
       }
    }
  }

  // --- TASK SUBMISSION ---
  const handleQuizChange = (taskId: string, qIndex: number, optionIndex: number) => {
    setQuizAnswers(prev => {
      const current = prev[taskId] || []
      const updated = [...current]
      updated[qIndex] = optionIndex
      return { ...prev, [taskId]: updated }
    })
  }

  const handleTaskTagToggle = (taskId: string, memberId: string) => {
    setTaskTags(prev => {
      const current = prev[taskId] || []
      if (current.includes(memberId)) return { ...prev, [taskId]: current.filter(id => id !== memberId) }
      else return { ...prev, [taskId]: [...current, memberId] }
    })
  }

  const submitCurrentTask = async (task: Task) => {
    if (!group) return
    setSubmitting(task.id)
    
    try {
      let answerData: any = {}
      
      if (task.type === 'quiz') {
        answerData = { answers: quizAnswers[task.id] || [] }
      } else if (task.type === 'short_answer') {
        answerData = { text: textAnswers[task.id] || '' }
      } else if (task.type === 'photo_upload') {
        const photoUrl = uploadedPhotos[task.id]
        answerData = { url: photoUrl || '' }
        if (!photoUrl) {
          alert('Vui lòng chụp ảnh trước khi nộp bài!')
          setSubmitting(null)
          return
        }
      }

      const input = {
        taskId: task.id,
        groupId: group.id,
        submittedBy: activeStudentId,
        answer: answerData,
        task: task,
        taggedStudentIds: taskTags[task.id] || [activeStudentId],
        groupMemberIds: groupMembers.map(m => m.student_id)
      }

      if (!navigator.onLine) {
        await queueOfflineAction('SUBMIT_TASK', input)
        setCompletedTasks(prev => ({ ...prev, [task.id]: true }))
        alert("🌐 Thiết bị đang ngoại tuyến. Bài làm của em đã được lưu vào hàng đợi và sẽ tự động nộp khi có mạng trở lại!")
      } else {
        const result = await submitTask(input)
        setCompletedTasks(prev => ({ ...prev, [task.id]: true }))
        setTaskResults(prev => ({ ...prev, [task.id]: result }))
      }
    } catch (err: any) {
      alert("Nộp bài thất bại: " + err.message)
    } finally {
      setSubmitting(null)
    }
  }

  if (loading || !station) {
    return <div className="h-dvh flex items-center justify-center bg-[#0f111a]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  }

  // Overlay khi đang chuyển góc
  if (isRotating) {
    return (
      <div className="h-dvh flex items-center justify-center bg-[#0f111a]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center animate-pulse">
            <ArrowRight className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Đang chuyển góc...</h2>
          <p className="text-slate-400">Chuẩn bị sang góc tiếp theo!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#0f111a] font-sans text-slate-200 overflow-hidden relative">
      <StudentProfileDrawer 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        student={activeStudent?.student} 
      />
      
      {/* Offline Toast */}
      {isOffline && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-bold">Mất kết nối mạng! Ứng dụng đang chạy offline.</span>
        </div>
      )}

      {/* ── LEFT PANEL: Nhiệm vụ & Nộp bài ── */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header Mobile Quick Switch */}
          <div className="md:hidden glass-card p-3 flex items-center justify-between mb-4 relative z-50">
            <button onClick={() => setIsQuickSwitchOpen(!isQuickSwitchOpen)} className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30">
              <Users className="w-4 h-4" />
              <span className="font-semibold">{activeStudent?.student.display_name}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          
          {isQuickSwitchOpen && (
            <div className="md:hidden absolute top-20 left-6 right-6 glass-card-static p-2 z-50 animate-fade-in shadow-2xl">
              <div className="text-xs text-slate-400 mb-2 px-2 uppercase font-bold tracking-wider">Chọn người cầm máy</div>
              {groupMembers.map(m => (
                <button
                  key={m.id} onClick={() => switchStudent(m.student_id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeStudentId === m.student_id ? 'bg-indigo-500/20 border border-indigo-500/50' : 'hover:bg-white/5'
                  }`}
                >
                  <span className={`font-medium ${activeStudentId === m.student_id ? 'text-indigo-300' : 'text-slate-300'}`}>
                    {m.student.display_name}
                  </span>
                  {m.role === 'leader' && <Crown className="w-4 h-4 text-amber-400" />}
                </button>
              ))}
            </div>
          )}

          {/* Station Title & Knowledge Text */}
          <div className="animate-fade-in space-y-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-transparent mb-1">
                {station.name}
              </h1>
              <p className="text-slate-400 text-sm">Hãy hoàn thành các nhiệm vụ bên dưới để lấy điểm trạm.</p>
            </div>
            
            {station.knowledge_text && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-indigo-300 mb-2 uppercase tracking-wide">📚 Tài liệu Của Trạm</h3>
                <div className="text-sm text-slate-300 whitespace-pre-wrap">{station.knowledge_text}</div>
              </div>
            )}
            
            {/* Horizontal Quick Switch Bar for Shared Device */}
            {deviceMode === 'shared' && (
              <div className="bg-black/20 rounded-lg p-3 border border-white/5 overflow-x-auto hidden md:block">
                 <div className="text-xs text-slate-400 mb-2 font-bold tracking-wider uppercase">Ai đang cầm máy? (Quick Switch)</div>
                 <div className="flex gap-2">
                   {groupMembers.map(m => (
                     <button
                       key={m.id} onClick={() => switchStudent(m.student_id)}
                       className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                         activeStudentId === m.student_id 
                           ? 'bg-indigo-500 text-white' 
                           : 'bg-white/5 text-slate-300 hover:bg-white/10'
                       }`}
                     >
                       {m.student.display_name}
                       {m.role === 'leader' && <Crown className="w-3.5 h-3.5 text-amber-300" />}
                     </button>
                   ))}
                 </div>
              </div>
            )}
          </div>

          {/* Task List */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {tasks.map((task, idx) => {
              const isCompleted = completedTasks[task.id]
              const content = task.content as any
              return (
                <div key={task.id} className={`glass-card-static p-5 transition-all ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'}`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{task.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {task.xp_reward > 0 && (
                            <span className="badge badge-primary text-xs">Thưởng: {task.xp_reward} XP</span>
                          )}
                          <span className="badge bg-slate-500/20 text-slate-300 text-[10px]">
                            {task.scoring_mode === 'individual' ? 'Cá nhân' : task.scoring_mode === 'group_equal' ? 'Nhóm chung' : 'Nhóm trưởng nộp'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Task Internal UI */}
                  {isCompleted && taskResults[task.id] && (
                    <div className={`mt-4 ${taskResults[task.id].grading_status === 'pending_teacher' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'} border rounded-lg p-4 space-y-3`}>
                      <div className={`flex items-center justify-between border-b ${taskResults[task.id].grading_status === 'pending_teacher' ? 'border-amber-500/10' : 'border-emerald-500/10'} pb-2`}>
                        {taskResults[task.id].grading_status === 'pending_teacher' ? (
                          <>
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                              ⏳ Đang chờ GV chấm điểm
                            </span>
                            <span className="text-sm font-bold text-amber-300">
                              Chờ duyệt
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Kết quả bài làm
                            </span>
                            <span className="text-sm font-bold text-white">
                              Điểm: <span className="text-emerald-400">{taskResults[task.id].score}</span> / {taskResults[task.id].max_score}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Display details based on task type */}
                      {task.type === 'quiz' && (
                        <div className="space-y-3">
                          {content.questions?.map((q: any, qIdx: number) => {
                            const studentAns = taskResults[task.id].answer?.answers?.[qIdx]
                            const correctAns = q.correctAnswer
                            const isCorrect = studentAns === correctAns
                            
                            return (
                              <div key={qIdx} className="text-xs space-y-1">
                                <p className="text-slate-300 font-medium">{qIdx + 1}. {q.question}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  <div className={`p-2 rounded border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    <span className="font-semibold">Đã chọn:</span> {q.options?.[studentAns] ?? 'Chưa chọn'}
                                    {!isCorrect && <span className="ml-1">(Sai)</span>}
                                  </div>
                                  {!isCorrect && (
                                    <div className="p-2 rounded border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                                      <span className="font-semibold">Đáp án đúng:</span> {q.options?.[correctAns]}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {task.type === 'short_answer' && (
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-slate-400 font-semibold block mb-1">Câu trả lời của em:</span>
                            <div className="bg-black/30 p-2 rounded text-slate-300 italic">"{taskResults[task.id].answer?.text || ''}"</div>
                          </div>
                          {taskResults[task.id].feedback && (
                            <div>
                              <span className="text-indigo-400 font-semibold block mb-1">🤖 Nhận xét từ AI Bot:</span>
                              <div className="bg-indigo-500/5 border border-indigo-500/10 p-2 rounded text-slate-300">{taskResults[task.id].feedback}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {task.type === 'photo_upload' && (
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-slate-400 font-semibold block mb-1">Ảnh đã nộp:</span>
                            <img src={taskResults[task.id].answer?.url} alt="Nộp bài" className="w-full max-h-40 object-cover rounded border border-white/10" />
                          </div>
                          {taskResults[task.id].feedback && (
                            <div>
                              <span className="text-indigo-400 font-semibold block mb-1">🤖 Nhận xét từ AI Bot:</span>
                              <div className="bg-indigo-500/5 border border-indigo-500/10 p-2 rounded text-slate-300">{taskResults[task.id].feedback}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Task Internal UI */}
                  {!isCompleted && (
                    <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-4">
                      {/* Trả bài - Feedback */}
                      {taskResults[task.id]?.grading_status === 'rejected' && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-200">
                          <strong className="text-red-400 block mb-1">❌ Trả bài: Chưa đạt</strong>
                          <p>{taskResults[task.id].feedback}</p>
                          <div className="text-xs text-red-400/80 mt-2">Vui lòng điều chỉnh lại đáp án và nộp lại.</div>
                        </div>
                      )}

                      {/* QUIZ UI */}
                      {task.type === 'quiz' && content.questions?.map((q: any, qIdx: number) => (
                        <div key={qIdx} className="mb-4">
                          <p className="text-sm text-slate-200 mb-2 font-medium">{qIdx + 1}. {q.question}</p>
                          <div className="space-y-2">
                            {q.options?.map((opt: string, optIdx: number) => (
                              <label key={optIdx} className="flex items-center gap-3 p-2 rounded border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10">
                                <input 
                                  type="radio" 
                                  name={`task_${task.id}_q_${qIdx}`} 
                                  className="accent-indigo-500"
                                  checked={(quizAnswers[task.id] || [])[qIdx] === optIdx}
                                  onChange={() => handleQuizChange(task.id, qIdx, optIdx)}
                                />
                                <span className="text-sm text-slate-300">{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* SHORT ANSWER UI */}
                      {task.type === 'short_answer' && (
                        <textarea
                          placeholder="Nhập câu trả lời của bạn..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          rows={3}
                          value={textAnswers[task.id] || ''}
                          onChange={(e) => setTextAnswers(prev => ({...prev, [task.id]: e.target.value}))}
                        />
                      )}

                      {/* PHOTO UPLOAD UI */}
                      {task.type === 'photo_upload' && (
                        <div className="space-y-3">
                          {uploadedPhotos[task.id] && (
                            <div className="relative rounded-lg overflow-hidden">
                              <img src={uploadedPhotos[task.id]} alt="Uploaded" className="w-full max-h-48 object-cover rounded-lg" />
                              <span className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">✓ Đã tải lên</span>
                            </div>
                          )}
                          <div 
                            className={`flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${uploadingTask === task.id ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 hover:bg-white/5'}`}
                            onClick={() => {
                              if (uploadingTask) return
                              const input = createCameraInput(async (file) => {
                                try {
                                  setUploadingTask(task.id)
                                  if (!navigator.onLine) {
                                    // Đọc ảnh thành Base64 khi offline
                                    const reader = new FileReader()
                                    reader.onloadend = () => {
                                      const base64data = reader.result as string
                                      setUploadedPhotos(prev => ({...prev, [task.id]: base64data}))
                                      setUploadingTask(null)
                                    }
                                    reader.readAsDataURL(file)
                                  } else {
                                    const result = await uploadTaskImage(
                                      file, sessionId!, group.id, task.id, activeStudentId
                                    )
                                    setUploadedPhotos(prev => ({...prev, [task.id]: result.signedUrl}))
                                    setUploadingTask(null)
                                  }
                                } catch (err: any) {
                                  alert('Upload thất bại: ' + err.message)
                                  setUploadingTask(null)
                                }
                              })
                              input.click()
                            }}
                          >
                            {uploadingTask === task.id ? (
                              <><Loader2 className="w-8 h-8 text-indigo-400 mb-2 animate-spin" /><span className="text-sm text-indigo-300">Đang tải ảnh lên...</span></>
                            ) : (
                              <><Camera className="w-8 h-8 text-slate-500 mb-2" /><span className="text-sm text-slate-300 font-medium">Bấm để chụp ảnh hoặc chọn từ thư viện</span></>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* LEADER TAG UI */}
                      {task.scoring_mode === 'group_leader_tag' && activeStudent?.role === 'leader' && (
                        <div className="pt-4 border-t border-white/10">
                          <label className="text-xs text-amber-400 font-medium mb-2 block">Gắn tag thành viên đã tham gia giải:</label>
                          <div className="flex flex-wrap gap-2">
                            {groupMembers.map(m => (
                              <label key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 cursor-pointer hover:bg-white/10">
                                <input 
                                  type="checkbox" 
                                  className="accent-amber-500" 
                                  checked={(taskTags[task.id] || []).includes(m.student_id)}
                                  onChange={() => handleTaskTagToggle(task.id, m.student_id)}
                                />
                                <span className="text-xs text-slate-300">{m.student.display_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SUBMIT BUTTON */}
                      <div className="flex justify-end pt-2">
                        <button 
                          onClick={() => submitCurrentTask(task)}
                          disabled={submitting === task.id || (task.scoring_mode === 'individual' && activeStudent?.student.display_name === undefined)}
                          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                          {submitting === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Nộp bài {task.scoring_mode === 'individual' ? `(${activeStudent?.student.display_name})` : ''}
                        </button>
                      </div>
                    </div>
                  )}
                  {isCompleted && (
                    <div className="text-sm text-emerald-400 mt-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Đã nộp bài thành công!
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: AI Chat Bot & Quick Switch (Desktop) ── */}
      <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-white/10 bg-[#161824] flex flex-col h-[50vh] md:h-dvh">
        
        {/* Header Right Sidebar */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20 shadow-sm relative z-40">
           {/* Desktop Quick Switch */}
           <div className="hidden md:flex items-center gap-2 relative">
            <button 
              onClick={() => setIsQuickSwitchOpen(!isQuickSwitchOpen)}
              className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:bg-indigo-500/30"
            >
              <div className="w-5 h-5 rounded bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                {activeStudent?.student.display_name[0]}
              </div>
              <span className="font-semibold text-sm">{activeStudent?.student.display_name}</span>
              <ChevronDown className="w-4 h-4 opacity-70" />
            </button>
            
            {isQuickSwitchOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 glass-card-static p-2 shadow-2xl">
                <div className="text-xs text-slate-400 mb-2 px-2 uppercase font-bold tracking-wider">Đang cầm thiết bị:</div>
                {groupMembers.map(m => (
                  <button
                    key={m.id} onClick={() => switchStudent(m.student_id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-sm ${
                      activeStudentId === m.student_id ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span>{m.student.display_name}</span>
                    {m.role === 'leader' && <Crown className="w-3 h-3 text-amber-400" />}
                    {m.role === 'secretary' && <PenLine className="w-3 h-3 text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center justify-center p-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
              title="Hồ sơ thành tích"
            >
              <Award className="w-5 h-5" />
            </button>
           </div>

           <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-lg ${
              timeRemaining < 60 ? 'text-red-400 bg-red-400/10 animate-pulse' : timeRemaining < 180 ? 'text-amber-400 bg-amber-400/10' : 'text-emerald-400 bg-emerald-400/10'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {formatTime(timeRemaining)}
            </div>
           </div>
        </div>

         {/* Extracted Chat Window Component */}
         <div className="flex-1 overflow-hidden relative z-30">
           <AIChatWindow 
             station={station}
             group={group}
             activeStudentId={activeStudentId}
             groupMembers={groupMembers}
             tasks={tasks}
             sessionTitle={sessionTitle}
           />
         </div>
      </div>
    </div>
  )
}
