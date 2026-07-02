/* ═══════════════════════════════════════
   CREATE SESSION — GócHọc AI
   Tạo phiên dạy học theo góc
   ═══════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Users,
  Smartphone,
  Monitor,
  Shuffle,
  Hand,
  Scale,
  UserCheck,
  Sparkles,
  Plus,
  Trash2,
  Brain,
  PenLine,
  BarChart3,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { createSession, createStationsBatch, createTasksBatch } from '@/services/sessionService'

const sessionSchema = z.object({
  title: z.string().min(3, 'Tiêu đề phải có ít nhất 3 ký tự'),
  subject: z.string().optional(),
  grade_level: z.string().optional(),
  rotation_time_minutes: z.number().min(5).max(60),
  total_time_minutes: z.number().min(15).max(180),
  max_stations: z.number().min(2).max(10),
  device_mode: z.enum(['individual', 'shared']),
  grouping_mode: z.enum(['random', 'gender_balanced', 'manual', 'student_choice']),
  group_size: z.number().min(2).max(8),
})

type SessionForm = z.infer<typeof sessionSchema>

interface TaskDraft {
  id: string
  title: string
  type: 'quiz' | 'short_answer' | 'photo_upload' | 'practice'
  xp_reward: number
  scoring_mode: 'individual' | 'group_equal' | 'group_leader_tag'
  grading_mode: 'auto' | 'teacher'
}

interface StationDraft {
  id: string
  name: string
  description: string
  tasks: TaskDraft[]
}

export function CreateSession() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stations, setStations] = useState<any[]>([
    { id: '1', name: 'Góc Khám phá', description: '', botPersona: 'friendly', botCustomPrompt: '', knowledgeText: '', tasks: [] },
    { id: '2', name: 'Góc Thực hành', description: '', botPersona: 'strict', botCustomPrompt: '', knowledgeText: '', tasks: [] },
    { id: '3', name: 'Góc Ứng dụng', description: '', botPersona: 'socrate', botCustomPrompt: '', knowledgeText: '', tasks: [] },
    { id: '4', name: 'Góc Sáng tạo', description: '', botPersona: 'child', botCustomPrompt: '', knowledgeText: '', tasks: [] },
  ])

  const [activeStationTab, setActiveStationTab] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      rotation_time_minutes: 15,
      total_time_minutes: 60,
      max_stations: 4,
      device_mode: 'individual',
      grouping_mode: 'random',
      group_size: 4,
    },
  })

  const deviceMode = watch('device_mode')
  const maxStations = watch('max_stations')

  // Custom durations state
  const [isCustomDurations, setIsCustomDurations] = useState(false)
  const [customDurations, setCustomDurations] = useState<number[]>([15, 15, 15, 15])

  useEffect(() => {
    if (maxStations) {
      setCustomDurations(prev => {
        const next = [...prev]
        if (next.length < maxStations) {
          while (next.length < maxStations) next.push(15)
        } else if (next.length > maxStations) {
          return next.slice(0, maxStations)
        }
        return next
      })
    }
  }, [maxStations])

  const onSubmit = async (data: SessionForm) => {
    if (!user) {
      alert('Vui lòng đăng nhập lại')
      return
    }
    
    setIsSubmitting(true)
    try {
      const actualRotationTime = isCustomDurations ? customDurations[0] : data.rotation_time_minutes
      const actualTotalTime = isCustomDurations ? customDurations.reduce((a, b) => a + b, 0) : data.total_time_minutes
      const roundDurationsStr = isCustomDurations ? customDurations.join(',') : undefined

      // 1. Create Session
      const session = await createSession({
        teacherId: user.id,
        title: data.title,
        subject: data.subject,
        gradeLevel: data.grade_level,
        rotationTimeMinutes: actualRotationTime,
        totalTimeMinutes: actualTotalTime,
        maxStations: data.max_stations,
        deviceMode: data.device_mode,
        groupingMode: data.grouping_mode,
        groupSize: data.group_size,
        roundDurations: roundDurationsStr,
      })

      // 2. Create Stations
      const stationsDb = await createStationsBatch(
        session.id,
        stations.map((s, idx) => ({
          name: s.name,
          description: s.description,
          orderNum: idx + 1,
          botPersona: s.botPersona || 'friendly',
          botCustomPrompt: s.botCustomPrompt,
          knowledgeText: s.knowledgeText || null,
        }))
      )

      // 2.5. Index station knowledge (RAG Pipeline)
      const { indexStationKnowledge } = await import('@/services/embeddingService')
      const indexPromises = stationsDb.map((stationDb: any, idx: number) => {
        const localStation = stations[idx]
        if (localStation.knowledgeText) {
          return indexStationKnowledge(stationDb.id, localStation.knowledgeText)
        }
        return Promise.resolve({ chunksIndexed: 0 })
      })
      await Promise.all(indexPromises)

      // 3. Create Tasks
      const allTasks: any[] = []
      stations.forEach((s: any, sIdx: number) => {
        const stationDb = stationsDb[sIdx]
        s.tasks.forEach((t: any, tIdx: number) => {
          allTasks.push({
            stationId: stationDb.id,
            title: t.title,
            type: t.type,
            content: {}, // Default empty content for now
            orderNum: tIdx + 1,
            xp_reward: t.xp_reward,
            scoringMode: t.scoring_mode,
            gradingMode: t.grading_mode,
          })
        })
      })

      if (allTasks.length > 0) {
        await createTasksBatch(allTasks)
      }

      alert(`Tạo phiên học thành công! Mã tham gia: ${session.join_code}`)
      navigate('/teacher/dashboard')
    } catch (error: any) {
      alert(`Lỗi khi tạo phiên học: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addStation = () => {
    if (stations.length < maxStations) {
      setStations([...stations, { 
        id: Math.random().toString(), 
        name: `Góc ${stations.length + 1}`, 
        description: '', 
        botPersona: 'friendly', 
        botCustomPrompt: '', 
        knowledgeText: '',
        tasks: [] 
      }])
    }
  }

  const removeStation = (index: number) => {
    if (stations.length > 2) {
      setStations(stations.filter((_: any, i: number) => i !== index))
    }
  }

  const addTask = (stationIndex: number) => {
    const updated = [...stations]
    updated[stationIndex].tasks.push({
      id: Math.random().toString(),
      title: '',
      type: 'quiz',
      xp_reward: 10,
      scoring_mode: 'individual',
      grading_mode: 'auto'
    })
    setStations(updated)
  }

  const removeTask = (stationIndex: number, taskIndex: number) => {
    const updated = [...stations]
    updated[stationIndex].tasks = updated[stationIndex].tasks.filter((_: any, i: number) => i !== taskIndex)
    setStations(updated)
  }

  const updateTask = (stationIndex: number, taskIndex: number, field: keyof TaskDraft, value: any) => {
    const updated = [...stations]
    updated[stationIndex].tasks[taskIndex] = {
      ...updated[stationIndex].tasks[taskIndex],
      [field]: value
    }
    setStations(updated)
  }

  return (
    <div className="min-h-dvh px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          id="btn-back-dashboard"
          onClick={() => navigate('/teacher/dashboard')}
          className="btn btn-ghost btn-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>

        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            Tạo phiên dạy học theo góc
          </h1>
          <p className="text-slate-400 text-sm">
            Thiết lập phiên học, tạo góc, cấu hình nhóm và thiết bị.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= s
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white/5 text-slate-500 border border-white/10'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`flex-1 h-0.5 rounded ${
                    step > s ? 'bg-indigo-500' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ── STEP 1: THÔNG TIN CƠ BẢN ── */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card-static p-6">
                <h2 className="text-white font-semibold mb-4">📝 Thông tin phiên học</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Tiêu đề phiên học *
                    </label>
                    <input
                      id="input-title"
                      className={`input ${errors.title ? 'input-error' : ''}`}
                      placeholder="VD: Phản ứng hóa học — Lớp 8A"
                      {...register('title')}
                    />
                    {errors.title && (
                      <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Môn học
                      </label>
                      <input
                        id="input-subject"
                        className="input"
                        placeholder="Hóa học"
                        {...register('subject')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Lớp
                      </label>
                      <input
                        id="input-grade"
                        className="input"
                        placeholder="8A"
                        {...register('grade_level')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card-static p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-1.5">⏱️ Thời gian</h2>
                  <label className="flex items-center gap-2 text-xs text-indigo-400 cursor-pointer hover:text-indigo-300 transition-colors">
                    <input
                      type="checkbox"
                      className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={isCustomDurations}
                      onChange={(e) => setIsCustomDurations(e.target.checked)}
                    />
                    Thời lượng từng vòng khác nhau
                  </label>
                </div>

                {!isCustomDurations ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        Mỗi vòng (phút)
                      </label>
                      <input
                        id="input-rotation-time"
                        type="number"
                        className="input"
                        {...register('rotation_time_minutes', { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        Tổng (phút)
                      </label>
                      <input
                        id="input-total-time"
                        type="number"
                        className="input"
                        {...register('total_time_minutes', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Array.from({ length: maxStations || 4 }).map((_, idx) => (
                        <div key={idx}>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Vòng {idx + 1} (phút)
                          </label>
                          <input
                            type="number"
                            className="input text-center text-sm py-1.5"
                            value={customDurations[idx] || 15}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 0)
                              const updated = [...customDurations]
                              updated[idx] = val
                              setCustomDurations(updated)
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
                      <span>Tổng thời gian (tính tự động):</span>
                      <span className="font-bold text-sm">{customDurations.reduce((a, b) => a + b, 0)} phút</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-primary w-full"
              >
                Tiếp theo
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── STEP 2: GÓC & THIẾT BỊ ── */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              {/* Device Mode — v5 */}
              <div className="glass-card-static p-6">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  📱 Chế độ thiết bị
                  <span className="badge badge-accent text-xs">v5</span>
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`station-card cursor-pointer flex flex-col items-center gap-2 p-4 text-center ${
                      deviceMode === 'individual'
                        ? '!border-indigo-500 !bg-indigo-500/10'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      value="individual"
                      {...register('device_mode')}
                      className="sr-only"
                    />
                    <Smartphone className="w-6 h-6 text-indigo-400" />
                    <span className="text-sm font-medium text-white">
                      Mỗi HS 1 máy
                    </span>
                    <span className="text-xs text-slate-400">
                      HS đăng nhập trên máy riêng
                    </span>
                  </label>
                  <label
                    className={`station-card cursor-pointer flex flex-col items-center gap-2 p-4 text-center ${
                      deviceMode === 'shared'
                        ? '!border-emerald-500 !bg-emerald-500/10'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      value="shared"
                      {...register('device_mode')}
                      className="sr-only"
                    />
                    <Monitor className="w-6 h-6 text-emerald-400" />
                    <span className="text-sm font-medium text-white">
                      Nhóm chung 1 máy
                    </span>
                    <span className="text-xs text-slate-400">
                      Quick Switch chuyển người
                    </span>
                  </label>
                </div>
                {deviceMode === 'shared' && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                    Quick Switch: HS chuyển nhanh bằng 1 chạm, không cần đăng nhập lại. Mỗi nhiệm vụ có thể chấm điểm riêng.
                  </div>
                )}
              </div>

              {/* Stations */}
              <div className="glass-card-static p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold">🔬 Các góc học</h2>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Số góc tối đa:</label>
                    <select
                      className="input w-16 text-sm py-1"
                      {...register('max_stations', { valueAsNumber: true })}
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {stations.map((station, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300 flex-shrink-0">
                        {i + 1}
                      </div>
                      <input
                        className="input flex-1"
                        value={station.name}
                        onChange={(e) => {
                          const updated = [...stations]
                          updated[i] = { ...updated[i], name: e.target.value }
                          setStations(updated)
                        }}
                        placeholder={`Góc ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeStation(i)}
                        className="btn btn-ghost btn-icon text-slate-500 hover:text-red-400"
                        disabled={stations.length <= 2}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {stations.length < maxStations && (
                    <button
                      type="button"
                      onClick={addStation}
                      className="btn btn-ghost w-full text-sm border-dashed"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm góc
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-ghost flex-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn btn-primary flex-1"
                >
                  Tiếp theo (Nhiệm vụ)
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: NHIỆM VỤ & SCORING MODE (v5) ── */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card-static p-6">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-indigo-400" />
                  Thiết kế nhiệm vụ & Tính điểm
                </h2>
                
                {/* Tabs chọn góc */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
                  {stations.map((station, i) => (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => setActiveStationTab(i)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeStationTab === i 
                          ? 'bg-indigo-500 text-white' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {station.name}
                    </button>
                  ))}
                </div>

                {/* AI Configuration for current station */}
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Cấu hình AI Bot (Trợ giảng ảo)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Tính cách Bot</label>
                      <select 
                        className="input text-sm py-2"
                        value={stations[activeStationTab].botPersona}
                        onChange={(e) => {
                          const updated = [...stations]
                          updated[activeStationTab].botPersona = e.target.value
                          setStations(updated)
                        }}
                      >
                        <option value="friendly">Thân thiện & Đáng yêu (Tiểu học)</option>
                        <option value="strict">Nghiêm túc & Chính xác (Khoa học)</option>
                        <option value="socrate">Hỏi gợi mở (Triết gia Socrate)</option>
                        <option value="pirate">Hài hước (Cướp biển)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Quy tắc bổ sung (Tùy chọn)</label>
                      <input 
                        className="input text-sm" 
                        value={stations[activeStationTab].botCustomPrompt || ''}
                        onChange={(e) => {
                          const updated = [...stations]
                          updated[activeStationTab].botCustomPrompt = e.target.value
                          setStations(updated)
                        }}
                        placeholder="VD: Không giảng giải trực tiếp, chỉ đưa ra keyword..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-indigo-300 mb-1">📚 Tài liệu kiến thức của Trạm (Dùng cho AI RAG Search)</label>
                      <textarea
                        className="input text-sm py-2"
                        rows={3}
                        value={stations[activeStationTab].knowledgeText || ''}
                        onChange={(e) => {
                          const updated = [...stations]
                          updated[activeStationTab].knowledgeText = e.target.value
                          setStations(updated)
                        }}
                        placeholder="Nhập kiến thức lý thuyết, quy tắc, công thức hoặc tài liệu học tập của trạm này để AI trợ giảng tham chiếu..."
                      />
                    </div>
                  </div>
                </div>

                {/* Danh sách task của góc đang chọn */}
                <div className="space-y-4">
                  {stations[activeStationTab].tasks.map((task: any, tIndex: number) => (
                    <div key={task.id} className="p-4 rounded-lg bg-white/5 border border-white/10 relative group">
                      <button 
                        type="button"
                        onClick={() => removeTask(activeStationTab, tIndex)}
                        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-4">
                        <div className="sm:col-span-12">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Tên nhiệm vụ</label>
                          <input 
                            className="input text-sm" 
                            value={task.title}
                            onChange={(e) => updateTask(activeStationTab, tIndex, 'title', e.target.value)}
                            placeholder="VD: Trả lời 5 câu hỏi trắc nghiệm"
                          />
                        </div>
                        <div className="sm:col-span-6">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Loại</label>
                          <select 
                            className="input text-sm py-2"
                            value={task.type}
                            onChange={(e) => updateTask(activeStationTab, tIndex, 'type', e.target.value)}
                          >
                            <option value="quiz">Trắc nghiệm</option>
                            <option value="short_answer">Tự luận ngắn</option>
                            <option value="photo_upload">Chụp ảnh chụp/Upload</option>
                            <option value="practice">Thực hành</option>
                          </select>
                        </div>
                        <div className="sm:col-span-6">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Điểm rèn luyện</label>
                          <input 
                            type="number" 
                            className="input text-sm py-2" 
                            value={task.xp_reward}
                            onChange={(e) => updateTask(activeStationTab, tIndex, 'xp_reward', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      {/* ─── TASK CONTENT (Question, Options, Rubric) ─── */}
                      <div className="bg-black/20 p-4 rounded-lg border border-white/5 mb-4">
                        <label className="block text-xs font-medium text-indigo-300 mb-2">Nội dung chi tiết</label>
                        
                        {task.type === 'quiz' && (
                          <div className="space-y-3">
                            <textarea
                              className="input text-sm w-full h-16"
                              placeholder="Nhập nội dung câu hỏi trắc nghiệm..."
                              value={(task.content as any)?.question || ''}
                              onChange={(e) => updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), question: e.target.value })}
                            />
                            <div className="space-y-2">
                              {[0, 1, 2, 3].map((optIndex) => (
                                <div key={optIndex} className="flex items-center gap-2">
                                  <input 
                                    type="radio" 
                                    name={`correct-${activeStationTab}-${tIndex}`} 
                                    checked={(task.content as any)?.correctAnswer === optIndex}
                                    onChange={() => updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), correctAnswer: optIndex })}
                                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                                  />
                                  <input 
                                    className="input text-sm flex-1 py-1.5"
                                    placeholder={`Lựa chọn ${String.fromCharCode(65 + optIndex)}`}
                                    value={(task.content as any)?.options?.[optIndex] || ''}
                                    onChange={(e) => {
                                      const newOptions = [...((task.content as any)?.options || ['', '', '', ''])]
                                      newOptions[optIndex] = e.target.value
                                      updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), options: newOptions })
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {task.type === 'short_answer' && (
                          <div className="space-y-3">
                            <textarea
                              className="input text-sm w-full h-16"
                              placeholder="Nhập yêu cầu đề bài cho học sinh..."
                              value={(task.content as any)?.question || ''}
                              onChange={(e) => updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), question: e.target.value })}
                            />
                            {task.grading_mode === 'auto' && (
                              <textarea
                                className="input text-sm w-full h-16 border-cyan-500/30"
                                placeholder="Nhập ĐÁP ÁN CHUẨN hoặc TIÊU CHÍ để AI dựa vào đó duyệt bài..."
                                value={(task.content as any)?.rubric || ''}
                                onChange={(e) => updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), rubric: e.target.value })}
                              />
                            )}
                          </div>
                        )}

                        {task.type === 'photo_upload' && (
                          <div className="space-y-3">
                            <textarea
                              className="input text-sm w-full h-16"
                              placeholder="Yêu cầu học sinh chụp hình gì? (VD: Chụp hình một bức tranh có 3 màu cơ bản)"
                              value={(task.content as any)?.question || ''}
                              onChange={(e) => updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), question: e.target.value })}
                            />
                            {task.grading_mode === 'auto' && (
                              <textarea
                                className="input text-sm w-full h-16 border-cyan-500/30"
                                placeholder="Mô tả cho AI Vision biết bức ảnh ĐẠT yêu cầu phải có những chi tiết nào..."
                                value={(task.content as any)?.rubric || ''}
                                onChange={(e) => updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), rubric: e.target.value })}
                              />
                            )}
                          </div>
                        )}
                        
                        {task.type === 'practice' && (
                          <textarea
                            className="input text-sm w-full h-16"
                            placeholder="Nhập hướng dẫn thực hành cho học sinh..."
                            value={(task.content as any)?.question || ''}
                            onChange={(e) => updateTask(activeStationTab, tIndex, 'content', { ...(task.content as any), question: e.target.value })}
                          />
                        )}
                      </div>

                      {/* Scoring Mode */}
                      <div>
                        <label className="block text-xs font-medium text-emerald-400 mb-2">
                          <BarChart3 className="w-3 h-3 inline mr-1" />
                          Xác nhận hoàn thành (Ghi nhận điểm)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className={`flex flex-col p-2 rounded-lg border cursor-pointer ${task.scoring_mode === 'individual' ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                            <input type="radio" className="sr-only" checked={task.scoring_mode === 'individual'} onChange={() => updateTask(activeStationTab, tIndex, 'scoring_mode', 'individual')} />
                            <span className="text-sm font-medium text-slate-200">👤 Cá nhân</span>
                            <span className="text-[10px] text-slate-400 mt-1">Mỗi HS tự làm, tự nhận điểm</span>
                          </label>
                          <label className={`flex flex-col p-2 rounded-lg border cursor-pointer ${task.scoring_mode === 'group_equal' ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                            <input type="radio" className="sr-only" checked={task.scoring_mode === 'group_equal'} onChange={() => updateTask(activeStationTab, tIndex, 'scoring_mode', 'group_equal')} />
                            <span className="text-sm font-medium text-slate-200">👥 Nhóm chia đều</span>
                            <span className="text-[10px] text-slate-400 mt-1">1 HS nộp, cả nhóm được điểm</span>
                          </label>
                          <label className={`flex flex-col p-2 rounded-lg border cursor-pointer ${task.scoring_mode === 'group_leader_tag' ? 'bg-amber-500/20 border-amber-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                            <input type="radio" className="sr-only" checked={task.scoring_mode === 'group_leader_tag'} onChange={() => updateTask(activeStationTab, tIndex, 'scoring_mode', 'group_leader_tag')} />
                            <span className="text-sm font-medium text-slate-200">👑 NT gắn tag</span>
                            <span className="text-[10px] text-slate-400 mt-1">Nộp kèm tag HS đã làm phần đó</span>
                          </label>
                        </div>
                      </div>

                      {/* Grading Mode — only for non-quiz types */}
                      {(task.type === 'short_answer' || task.type === 'photo_upload' || task.type === 'practice') && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-amber-400 mb-2">
                            🎯 Người kiểm tra / Duyệt
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className={`flex flex-col p-2 rounded-lg border cursor-pointer ${task.grading_mode === 'auto' ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                              <input type="radio" className="sr-only" checked={task.grading_mode === 'auto'} onChange={() => updateTask(activeStationTab, tIndex, 'grading_mode' as any, 'auto')} />
                              <span className="text-sm font-medium text-slate-200">🤖 AI tự duyệt</span>
                              <span className="text-[10px] text-slate-400 mt-1">AI tự động kiểm tra Đạt/Chưa đạt</span>
                            </label>
                            <label className={`flex flex-col p-2 rounded-lg border cursor-pointer ${task.grading_mode === 'teacher' ? 'bg-amber-500/20 border-amber-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                              <input type="radio" className="sr-only" checked={task.grading_mode === 'teacher'} onChange={() => updateTask(activeStationTab, tIndex, 'grading_mode' as any, 'teacher')} />
                              <span className="text-sm font-medium text-slate-200">👨‍🏫 GV duyệt</span>
                              <span className="text-[10px] text-slate-400 mt-1">Chờ GV kiểm tra thủ công sau</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <button 
                    type="button" 
                    onClick={() => addTask(activeStationTab)}
                    className="btn btn-ghost w-full border-dashed text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm nhiệm vụ
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-ghost flex-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="btn btn-primary flex-1"
                >
                  Tiếp theo (Phân nhóm)
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: NHÓM & XÁC NHẬN ── */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              {/* Grouping */}
              <div className="glass-card-static p-6">
                <h2 className="text-white font-semibold mb-4">
                  <Users className="w-4 h-4 inline mr-2" />
                  Phân nhóm
                </h2>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { value: 'random', label: '🎲 Ngẫu nhiên', icon: Shuffle },
                    { value: 'gender_balanced', label: '⚖️ Cân bằng nam/nữ', icon: Scale },
                    { value: 'manual', label: '✋ GV tự chọn', icon: Hand },
                    { value: 'student_choice', label: '🙋 HS tự chọn', icon: UserCheck },
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors text-sm"
                    >
                      <input
                        type="radio"
                        value={mode.value}
                        {...register('grouping_mode')}
                        className="accent-indigo-500"
                      />
                      <span className="text-slate-200">{mode.label}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Số HS / nhóm
                  </label>
                  <input
                    type="number"
                    className="input w-24"
                    {...register('group_size', { valueAsNumber: true })}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="glass-card-static p-6">
                <h2 className="text-white font-semibold mb-4">
                  <Brain className="w-4 h-4 inline mr-2" />
                  Tóm tắt
                </h2>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số góc:</span>
                    <span className="font-medium text-white">{stations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thiết bị:</span>
                    <span className="font-medium text-white">
                      {deviceMode === 'shared' ? '👥 Nhóm chung' : '📱 Cá nhân'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">AI Bot:</span>
                    <span className="font-medium text-emerald-400">
                      Gemini 2.0 Flash × {stations.length} góc
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn btn-ghost flex-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay lại
                </button>
                <button
                  id="btn-create-session-submit"
                  type="submit"
                  className="btn btn-accent flex-1 btn-lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Tạo phiên học
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
