/* ═══════════════════════════════════════
   SESSION SERVICE — GócHọc AI
   CRUD phiên học + góc/trạm + nhiệm vụ
   Tương ứng Module 2.1 B,C,D trong kế hoạch NLM
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import type {
  Session,
  Station,
  Task,
  Group,
  GroupMember,
  DeviceMode,
  RotationMode,
  GroupingMode,
  ScoringMode,
  TaskType,
  Json,
} from '@/types/database'

// ─── TẠO MÃ PHIÊN 4 SỐ DUY NHẤT ──────────

function generateJoinCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

async function getUniqueJoinCode(): Promise<string> {
  let code = generateJoinCode()
  let attempts = 0
  const maxAttempts = 20

  while (attempts < maxAttempts) {
    const { data } = await supabase
      .from('sessions')
      .select('id')
      .eq('join_code', code)
      .eq('status', 'active')
      .maybeSingle()

    if (!data) return code
    code = generateJoinCode()
    attempts++
  }

  throw new Error('Không thể tạo mã phiên duy nhất. Vui lòng thử lại.')
}

// ─── PHIÊN HỌC ────────────────────────────

export interface CreateSessionInput {
  teacherId: string
  title: string
  subject?: string
  gradeLevel?: string
  mode?: 'station_rotation' | 'big_game'
  rotationMode?: RotationMode
  rotationTimeMinutes?: number
  totalTimeMinutes?: number
  maxStations?: number
  groupingMode?: GroupingMode
  groupSize?: number
  deviceMode?: DeviceMode
  roundDurations?: string
}

/** Tạo phiên học mới — Bước 1 trong flow GV */
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const joinCode = await getUniqueJoinCode()

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      teacher_id: input.teacherId,
      title: input.title,
      subject: input.subject ?? null,
      grade_level: input.gradeLevel ?? null,
      mode: input.mode ?? 'station_rotation',
      join_code: joinCode,
      rotation_mode: input.rotationMode ?? 'fixed',
      rotation_time_minutes: input.rotationTimeMinutes ?? 15,
      total_time_minutes: input.totalTimeMinutes ?? null,
      max_stations: input.maxStations ?? 4,
      grouping_mode: input.groupingMode ?? 'random',
      group_size: input.groupSize ?? 4,
      device_mode: input.deviceMode ?? 'individual',
      round_durations: input.roundDurations ?? null,
      status: 'lobby',
    })
    .select()
    .single()

  if (error) throw new Error(`Tạo phiên thất bại: ${error.message}`)
  return data
}

/** Lấy danh sách phiên của GV */
export async function getTeacherSessions(teacherId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Lấy danh sách phiên thất bại: ${error.message}`)
  return data ?? []
}

/** Lấy phiên theo ID (kèm stations, tasks) */
export async function getSessionById(sessionId: string) {
  const [sessionRes, stationsRes] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', sessionId).single(),
    supabase.from('stations').select('*').eq('session_id', sessionId).order('order_num'),
  ])

  if (sessionRes.error) throw new Error(sessionRes.error.message)

  // Lấy tasks cho tất cả stations
  const stationIds = (stationsRes.data ?? []).map((s) => s.id)
  let tasks: Task[] = []
  if (stationIds.length > 0) {
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .in('station_id', stationIds)
      .order('order_num')
    tasks = tasksData ?? []
  }

  return {
    session: sessionRes.data as Session,
    stations: (stationsRes.data ?? []) as Station[],
    tasks,
  }
}

/** Tìm phiên theo mã tham gia (cho HS) */
export async function findSessionByJoinCode(joinCode: string): Promise<Session | null> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('join_code', joinCode)
    .in('status', ['active', 'lobby', 'draft'])
    .single()

  return data as Session | null
}

/** Bắt đầu phiên học */
export async function startSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(`Bắt đầu phiên thất bại: ${error.message}`)
}

/** Kết thúc phiên học */
export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(`Kết thúc phiên thất bại: ${error.message}`)
}

/** Xóa phiên học */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) throw new Error(`Xóa phiên thất bại: ${error.message}`)
}

// ─── GÓC / TRẠM ───────────────────────────

export interface CreateStationInput {
  sessionId: string
  name: string
  description?: string
  orderNum: number
  botPersona?: string
  botCustomPrompt?: string
  knowledgeText?: string
}

/** Tạo góc/trạm — Bước 2 */
export async function createStation(input: CreateStationInput): Promise<Station> {
  const { data, error } = await supabase
    .from('stations')
    .insert({
      session_id: input.sessionId,
      name: input.name,
      description: input.description ?? null,
      order_num: input.orderNum,
      bot_persona: input.botPersona ?? 'friendly',
      bot_custom_prompt: input.botCustomPrompt ?? null,
      knowledge_text: input.knowledgeText ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Tạo góc thất bại: ${error.message}`)
  return data
}

/** Tạo nhiều góc cùng lúc */
export async function createStationsBatch(
  sessionId: string,
  stations: Omit<CreateStationInput, 'sessionId'>[]
): Promise<Station[]> {
  const rows = stations.map((s) => ({
    session_id: sessionId,
    name: s.name,
    description: s.description ?? null,
    order_num: s.orderNum,
    bot_persona: s.botPersona ?? 'friendly',
    bot_custom_prompt: s.botCustomPrompt ?? null,
    knowledge_text: s.knowledgeText ?? null,
  }))

  const { data, error } = await supabase
    .from('stations')
    .insert(rows)
    .select()

  if (error) throw new Error(`Tạo góc hàng loạt thất bại: ${error.message}`)
  return data ?? []
}

// ─── NHIỆM VỤ (TASKS) ─────────────────────

export interface CreateTaskInput {
  stationId: string
  title: string
  type: TaskType
  content: Json
  orderNum: number
  xp_reward?: number
  scoringMode?: ScoringMode
  gradingMode?: 'auto' | 'teacher'
  timeLimitMinutes?: number
  requireIndividualLogin?: boolean
}

/** Tạo nhiệm vụ cho 1 góc — Bước 3 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      station_id: input.stationId,
      title: input.title,
      type: input.type,
      content: input.content,
      order_num: input.orderNum,
      xp_reward: input.xp_reward ?? 10,
      scoring_mode: input.scoringMode ?? 'individual',
      grading_mode: input.gradingMode ?? 'auto',
      time_limit_minutes: input.timeLimitMinutes ?? null,
      require_individual_login: input.requireIndividualLogin ?? false,
    })
    .select()
    .single()

  if (error) throw new Error(`Tạo nhiệm vụ thất bại: ${error.message}`)
  return data
}

/** Tạo nhiều nhiệm vụ cùng lúc */
export async function createTasksBatch(
  tasks: CreateTaskInput[]
): Promise<Task[]> {
  const rows = tasks.map((t) => ({
    station_id: t.stationId,
    title: t.title,
    type: t.type,
    content: t.content,
    order_num: t.orderNum,
    xp_reward: t.xp_reward ?? 10,
    scoring_mode: t.scoringMode ?? 'individual',
    grading_mode: t.gradingMode ?? 'auto',
    time_limit_minutes: t.timeLimitMinutes ?? null,
    require_individual_login: t.requireIndividualLogin ?? false,
  }))

  const { data, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select()

  if (error) throw new Error(`Tạo nhiệm vụ hàng loạt thất bại: ${error.message}`)
  return data ?? []
}

// ─── NHÓM ──────────────────────────────────

/** Phân nhóm ngẫu nhiên có ưu tiên vai trò ứng cử (từ Lobby) */
export async function createGroupsInLobby(
  sessionId: string,
  participants: { student_id: string; nominated_role: string | null }[],
  groupSize: number,
  stationIds: string[]
): Promise<{ groups: Group[]; members: GroupMember[] }> {
  // Query grouping mode from session
  const { data: session } = await supabase
    .from('sessions')
    .select('grouping_mode')
    .eq('id', sessionId)
    .single()

  const groupingMode = session?.grouping_mode || 'random'

  if (groupingMode === 'balanced' || groupingMode === 'gender_balanced') {
    return createGroupsBalancedGender(sessionId, participants, groupSize, stationIds)
  }
  
  if (participants.length === 0) throw new Error('Không có học sinh trong sảnh.')

  // Tính số lượng nhóm
  const numGroups = Math.ceil(participants.length / groupSize)
  const groupNames = Array.from({ length: numGroups }, (_, i) => `Nhóm ${i + 1}`)

  // 1. Tạo các Groups
  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .insert(
      groupNames.map((name, i) => ({
        session_id: sessionId,
        name,
        current_station_id: stationIds[i % stationIds.length] ?? null,
        current_rotation: 0,
      }))
    )
    .select()

  if (groupError) throw new Error(`Tạo nhóm thất bại: ${groupError.message}`)
  if (!groups || groups.length === 0) throw new Error('Không tạo được nhóm')

  // 2. Phân loại Học sinh theo role ứng cử và xáo trộn ngẫu nhiên
  const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5)
  const leaders = shuffle(participants.filter(p => p.nominated_role === 'leader'))
  const secretaries = shuffle(participants.filter(p => p.nominated_role === 'secretary'))
  const members = shuffle(participants.filter(p => !p.nominated_role))

  const groupBuckets: { groupId: string; studentId: string; role: string }[][] = Array.from({ length: numGroups }, () => [])
  
  // Hành vi rải (chia bài): rải đều leaders vào các group trước
  let gIndex = 0
  for (const l of leaders) {
    groupBuckets[gIndex % numGroups].push({ groupId: groups[gIndex % numGroups].id, studentId: l.student_id, role: 'leader' })
    gIndex++
  }
  
  for (const s of secretaries) {
    groupBuckets[gIndex % numGroups].push({ groupId: groups[gIndex % numGroups].id, studentId: s.student_id, role: 'secretary' })
    gIndex++
  }
  
  for (const m of members) {
    groupBuckets[gIndex % numGroups].push({ groupId: groups[gIndex % numGroups].id, studentId: m.student_id, role: 'member' })
    gIndex++
  }

  // Gộp tất cả buckets lại thành danh sách chèn
  const memberInserts = groupBuckets.flat()

  // 3. Insert vào bảng group_members
  const { data: insertedMembers, error: memberError } = await supabase
    .from('group_members')
    .insert(memberInserts.map(m => ({
       group_id: m.groupId,
       student_id: m.studentId,
       role: m.role as any
    })))
    .select()

  if (memberError) throw new Error(`Phân HS vào nhóm thất bại: ${memberError.message}`)

  // 4. Update bảng session_participants để Lobby Realtime nhận tín hiệu "Đã có nhóm"
  const updatePromises = memberInserts.map(m => 
    supabase
      .from('session_participants')
      .update({ group_id: m.groupId })
      .eq('session_id', sessionId)
      .eq('student_id', m.studentId)
  )
  await Promise.all(updatePromises)

  return { groups, members: insertedMembers ?? [] }
}

/** Phân nhóm cân bằng nam/nữ */
export async function createGroupsBalancedGender(
  sessionId: string,
  participants: { student_id: string; nominated_role: string | null }[],
  groupSize: number,
  stationIds: string[]
): Promise<{ groups: Group[]; members: GroupMember[] }> {
  if (participants.length === 0) throw new Error('Không có học sinh trong sảnh.')

  const numGroups = Math.ceil(participants.length / groupSize)
  const groupNames = Array.from({ length: numGroups }, (_, i) => `Nhóm ${i + 1}`)

  // 1. Tạo các Groups
  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .insert(
      groupNames.map((name, i) => ({
        session_id: sessionId,
        name,
        current_station_id: stationIds[i % stationIds.length] ?? null,
        current_rotation: 0,
      }))
    )
    .select()

  if (groupError) throw new Error(`Tạo nhóm thất bại: ${groupError.message}`)
  if (!groups || groups.length === 0) throw new Error('Không tạo được nhóm')

  // 2. Fetch gender of students
  const studentIds = participants.map(p => p.student_id)
  const { data: studentGenders } = await supabase
    .from('students')
    .select('id, gender')
    .in('id', studentIds)

  const genderMap = new Map(studentGenders?.map(s => [s.id, s.gender]) ?? [])

  // Phân loại nam/nữ/khác
  const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5)
  const males = shuffle(participants.filter(p => {
    const g = (genderMap.get(p.student_id) || '').toLowerCase()
    return g === 'male' || g === 'nam' || g === 'm'
  }))
  const females = shuffle(participants.filter(p => {
    const g = (genderMap.get(p.student_id) || '').toLowerCase()
    return g === 'female' || g === 'nữ' || g === 'f'
  }))
  const others = shuffle(participants.filter(p => {
    const g = (genderMap.get(p.student_id) || '').toLowerCase()
    return g !== 'male' && g !== 'nam' && g !== 'm' && g !== 'female' && g !== 'nữ' && g !== 'f'
  }))

  // Alternate genders
  const sortedParticipants: any[] = []
  const maxLen = Math.max(males.length, females.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < males.length) sortedParticipants.push(males[i])
    if (i < females.length) sortedParticipants.push(females[i])
  }
  sortedParticipants.push(...others)

  // Gán nhóm xoay vòng
  const groupBuckets: { groupId: string; studentId: string; role: string }[][] = Array.from({ length: numGroups }, () => [])
  sortedParticipants.forEach((p, idx) => {
    const gIdx = idx % numGroups
    const role = groupBuckets[gIdx].length === 0 ? 'leader' : groupBuckets[gIdx].length === 1 ? 'secretary' : 'member'
    groupBuckets[gIdx].push({
      groupId: groups[gIdx].id,
      studentId: p.student_id,
      role
    })
  })

  const memberInserts = groupBuckets.flat()

  // 3. Insert vào bảng group_members
  const { data: insertedMembers, error: memberError } = await supabase
    .from('group_members')
    .insert(memberInserts.map(m => ({
       group_id: m.groupId,
       student_id: m.studentId,
       role: m.role as any
    })))
    .select()

  if (memberError) throw new Error(`Phân HS vào nhóm thất bại: ${memberError.message}`)

  // 4. Update session_participants
  const updatePromises = memberInserts.map(m => 
    supabase
      .from('session_participants')
      .update({ group_id: m.groupId })
      .eq('session_id', sessionId)
      .eq('student_id', m.studentId)
  )
  await Promise.all(updatePromises)

  return { groups, members: insertedMembers ?? [] }
}

export interface GroupAssignmentInput {
  name: string
  stationId: string
  memberIds: string[]
}

/** GV chọn nhóm thủ công */
export async function createGroupsTeacherPicked(
  sessionId: string,
  assignments: GroupAssignmentInput[]
): Promise<void> {
  for (const assign of assignments) {
    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .insert({
        session_id: sessionId,
        name: assign.name,
        current_station_id: assign.stationId,
        current_rotation: 0,
      })
      .select()
      .single()

    if (groupErr || !group) throw new Error(`Tạo nhóm thất bại: ${groupErr?.message}`)

    const memberInserts = assign.memberIds.map((studentId, idx) => ({
      group_id: group.id,
      student_id: studentId,
      role: idx === 0 ? 'leader' : idx === 1 ? 'secretary' : 'member',
    }))

    const { error: memErr } = await supabase
      .from('group_members')
      .insert(memberInserts)

    if (memErr) throw new Error(`Lỗi gán thành viên: ${memErr.message}`)

    const updatePromises = assign.memberIds.map(studentId =>
      supabase
        .from('session_participants')
        .update({ group_id: group.id })
        .eq('session_id', sessionId)
        .eq('student_id', studentId)
    )
    await Promise.all(updatePromises)
  }
}

/** Tạo nhóm trống cho HS tự chọn */
export async function createEmptyGroups(
  sessionId: string,
  numGroups: number,
  stationIds: string[]
): Promise<void> {
  const groupNames = Array.from({ length: numGroups }, (_, i) => `Nhóm ${i + 1}`)
  const { error } = await supabase
    .from('groups')
    .insert(
      groupNames.map((name, i) => ({
        session_id: sessionId,
        name,
        current_station_id: stationIds[i % stationIds.length] ?? null,
        current_rotation: 0,
      }))
    )
  if (error) throw new Error(`Lỗi tạo nhóm rỗng: ${error.message}`)
}

/** HS tự gia nhập nhóm */
export async function joinGroupStudentChoice(
  groupId: string,
  studentId: string,
  role: 'leader' | 'secretary' | 'member' = 'member'
): Promise<void> {
  const { error: memErr } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      student_id: studentId,
      role,
    })

  if (memErr) throw new Error(`Lỗi gia nhập nhóm: ${memErr.message}`)

  const { data: group } = await supabase
    .from('groups')
    .select('session_id')
    .eq('id', groupId)
    .single()

  if (group) {
    await supabase
      .from('session_participants')
      .update({ group_id: groupId })
      .eq('session_id', group.session_id)
      .eq('student_id', studentId)
  }
}

// ─── LOBBY V4 (REALTIME) ───────────────────

export interface LobbyParticipantInput {
  sessionId: string
  studentId: string
  nominatedRole?: 'leader' | 'secretary' | null
}

/** HS vào sảnh chờ */
export async function joinLobby(input: LobbyParticipantInput): Promise<void> {
  const { error } = await supabase
    .from('session_participants')
    .upsert(
      {
        session_id: input.sessionId,
        student_id: input.studentId,
        is_online: true,
        nominated_role: input.nominatedRole ?? null,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: 'session_id, student_id' }
    )

  if (error) throw new Error(`Lỗi vào sảnh chờ: ${error.message}`)
}

/** Rời sảnh chờ / Mất mạng */
export async function leaveLobby(sessionId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('session_participants')
    .update({ is_online: false, last_seen_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('student_id', studentId)

  if (error) throw new Error(`Lỗi rời sảnh: ${error.message}`)
}

/** Cập nhật vai trò ứng cử */
export async function updateLobbyRole(sessionId: string, studentId: string, role: 'leader' | 'secretary' | null): Promise<void> {
  const { error } = await supabase
    .from('session_participants')
    .update({ nominated_role: role })
    .eq('session_id', sessionId)
    .eq('student_id', studentId)

  if (error) throw new Error(`Lỗi cập nhật vai trò: ${error.message}`)
}

/** Subscribe realtime thay đổi trong sảnh (học sinh tham gia/vắng mặt) */
export function subscribeToLobby(sessionId: string, callback: () => void) {
  const channel = supabase
    .channel(`lobby:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`
      },
      (payload) => {
        console.log('Lobby change received', payload)
        callback()
      }
    )
    .subscribe()

  return channel
}

/** Subscribe realtime thay đổi trạng thái phiên học (bắt đầu/kết thúc) */
export function subscribeToSessionStatus(sessionId: string, callback: (newStatus: string) => void) {
  const channel = supabase
    .channel(`session_status:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`
      },
      (payload) => {
        if (payload.new && payload.new.status) {
          callback(payload.new.status)
        }
      }
    )
    .subscribe()

  return channel
}

/** Lấy danh sách HS đang trong sảnh (kèm thông tin name/avatar từ students) */
export async function getLobbyParticipants(sessionId: string) {
  const { data, error } = await supabase
    .from('session_participants')
    .select(`
      id, student_id, is_online, nominated_role, joined_at, last_seen_at, group_id,
      student:students (id, display_name, avatar_url, class_name)
    `)
    .eq('session_id', sessionId)
    .order('joined_at', { ascending: true })

  if (error) throw new Error(`Lỗi lấy danh sách sảnh: ${error.message}`)
  return data
}

/** Lấy thông tin Trạm hiện tại của HS (dùng khi bắt đầu phiên) */
export async function getStudentCurrentStation(sessionId: string, studentId: string) {
  // Tìm student đang ở group nào trong session này
  const { data: memberData, error: memErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('student_id', studentId)
  
  if (memErr || !memberData || memberData.length === 0) return null

  // Chú ý: Một HS có thể thuộc nhiều group ở các session khác nhau. Cần join group để filter theo session.
  const groupIds = memberData.map(m => m.group_id)
  
  const { data: groupData, error: grpErr } = await supabase
    .from('groups')
    .select('id, current_station_id')
    .in('id', groupIds)
    .eq('session_id', sessionId)
    .single()

  if (grpErr || !groupData) return null

  return {
    groupId: groupData.id,
    stationId: groupData.current_station_id
  }
}

/** Lấy danh sách thành viên của một Group */
export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      id, student_id, role,
      student:students (id, display_name, avatar_url, class_name, total_xp, streak_days)
    `)
    .eq('group_id', groupId)

  if (error) throw new Error(`Lỗi lấy danh sách nhóm: ${error.message}`)
  return data
}

/** Cập nhật active_student_id khi thao tác Quick Switch */
export async function updateGroupActiveStudent(groupId: string, studentId: string) {
  const { error } = await supabase
    .from('groups')
    .update({ active_student_id: studentId })
    .eq('id', groupId)

  if (error) throw new Error(`Lỗi cập nhật người đang thao tác: ${error.message}`)
  return true
}

/** Lấy Live Stats cho Bảng Giáo Viên: Danh sách nhóm, vị trí trạm và người dùng máy */
export async function getLiveGroupStats(sessionId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      id, name, current_station_id, active_student_id,
      group_members (
        student_id, role,
        students (display_name)
      )
    `)
    .eq('session_id', sessionId)
    .order('name', { ascending: true })

  if (error) throw new Error(`Lỗi lấy Live Stats: ${error.message}`)
  return data
}
