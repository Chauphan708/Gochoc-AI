/* ═══════════════════════════════════════
   ROTATION SERVICE — GócHọc AI
   Quản lý luân chuyển góc (station rotation)
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import type { Group, Station } from '@/types/database'

// ─── TYPES ──────────────────────────────────

export interface RotationState {
  groups: GroupRotationInfo[]
  stations: Station[]
  currentRound: number
  totalRounds: number
  rotationTimeMinutes: number
  rotationMode: 'fixed' | 'teacher_directed'
  sessionStatus: string
  startedAt: string | null
  timerEndAt: string | null
}

export interface GroupRotationInfo {
  groupId: string
  groupName: string
  currentStationId: string | null
  currentStationName: string | null
  currentRotation: number
  memberCount: number
  tasksCompleted: number
  tasksTotal: number
}

// ─── LẤY TRẠNG THÁI LUÂN CHUYỂN ────────────

/** Lấy toàn bộ trạng thái rotation của 1 phiên */
export async function getRotationState(sessionId: string): Promise<RotationState> {
  // 1. Lấy session
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessErr || !session) throw new Error('Không tìm thấy phiên học')

  // 2. Lấy stations
  const { data: stations } = await supabase
    .from('stations')
    .select('*')
    .eq('session_id', sessionId)
    .order('order_num')

  const stationList = (stations ?? []) as Station[]

  // 3. Lấy groups + count members
  const { data: groups } = await supabase
    .from('groups')
    .select(`
      id, name, current_station_id, current_rotation,
      group_members ( id )
    `)
    .eq('session_id', sessionId)

  // 4. Lấy task results để biết tiến độ
  const stationIds = stationList.map(s => s.id)
  const taskCounts: Record<string, { total: number; completed: number }> = {}

  if (stationIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, station_id')
      .in('station_id', stationIds)

    const allTaskIds = (tasks ?? []).map(t => t.id)

    // Đếm task results
    if (allTaskIds.length > 0) {
      const { data: results } = await supabase
        .from('task_results')
        .select('task_id, group_id')
        .in('task_id', allTaskIds)

      // Build tiến độ cho mỗi group
      const groupIds = (groups ?? []).map(g => g.id)
      for (const gId of groupIds) {
        const groupResults = (results ?? []).filter(r => r.group_id === gId)
        const completedTaskIds = new Set(groupResults.map(r => r.task_id))
        taskCounts[gId] = {
          total: allTaskIds.length,
          completed: completedTaskIds.size,
        }
      }
    }
  }

  // 5. Map stations cho tên
  const stationMap = new Map(stationList.map(s => [s.id, s.name]))

  const groupInfos: GroupRotationInfo[] = (groups ?? []).map((g: any) => ({
    groupId: g.id,
    groupName: g.name,
    currentStationId: g.current_station_id,
    currentStationName: g.current_station_id ? stationMap.get(g.current_station_id) ?? null : null,
    currentRotation: g.current_rotation ?? 0,
    memberCount: g.group_members?.length ?? 0,
    tasksCompleted: taskCounts[g.id]?.completed ?? 0,
    tasksTotal: taskCounts[g.id]?.total ?? 0,
  }))

  const maxRotation = Math.max(...groupInfos.map(g => g.currentRotation), 0)

  return {
    groups: groupInfos,
    stations: stationList,
    currentRound: maxRotation,
    totalRounds: stationList.length,
    rotationTimeMinutes: session.rotation_time_minutes ?? 15,
    rotationMode: session.rotation_mode as 'fixed' | 'teacher_directed',
    sessionStatus: session.status,
    startedAt: session.started_at,
    timerEndAt: session.timer_end_at ?? null,
  }
}

// ─── KHỞI TẠO LUÂN CHUYỂN ──────────────────

/**
 * Khởi tạo rotation: gán mỗi nhóm vào 1 góc ban đầu.
 * Gọi khi GV bắt đầu phiên từ lobby.
 */
export async function initializeRotation(sessionId: string): Promise<void> {
  const { data: groups } = await supabase
    .from('groups')
    .select('id')
    .eq('session_id', sessionId)
    .order('created_at')

  const { data: stations } = await supabase
    .from('stations')
    .select('id')
    .eq('session_id', sessionId)
    .order('order_num')

  if (!groups?.length || !stations?.length) {
    throw new Error('Cần có nhóm và góc trước khi bắt đầu luân chuyển')
  }

  // Tạo rotation_order cho mỗi nhóm (mảng index xoay vòng)
  const numStations = stations.length
  const stationIds = stations.map(s => s.id)

  const updates = groups.map((group, gIndex) => {
    // Mỗi nhóm bắt đầu ở 1 góc khác nhau (round-robin)
    const startIndex = gIndex % numStations
    const rotationOrder = Array.from(
      { length: numStations },
      (_, i) => (startIndex + i) % numStations
    )

    return supabase
      .from('groups')
      .update({
        current_station_id: stationIds[startIndex],
        current_rotation: 0,
        rotation_order: rotationOrder,
      })
      .eq('id', group.id)
  })

  await Promise.all(updates)

  // Cập nhật session status → active + bắt đầu timer
  const rotationMinutes = (await supabase
    .from('sessions')
    .select('rotation_time_minutes')
    .eq('id', sessionId)
    .single()
  ).data?.rotation_time_minutes ?? 15

  const now = new Date()
  const timerEnd = new Date(now.getTime() + rotationMinutes * 60 * 1000)

  await supabase
    .from('sessions')
    .update({
      status: 'active',
      started_at: now.toISOString(),
      timer_end_at: timerEnd.toISOString(),
      current_round: 0,
    } as any)
    .eq('id', sessionId)
}

// ─── CHUYỂN GÓC ────────────────────────────

/**
 * Chuyển TẤT CẢ nhóm sang góc tiếp theo.
 * Dùng cho mode 'fixed' (auto timer) hoặc GV bấm thủ công.
 */
export async function rotateAllGroups(sessionId: string): Promise<void> {
  const { data: groups } = await supabase
    .from('groups')
    .select('id, current_rotation, rotation_order')
    .eq('session_id', sessionId)

  const { data: stations } = await supabase
    .from('stations')
    .select('id')
    .eq('session_id', sessionId)
    .order('order_num')

  if (!groups?.length || !stations?.length) return

  const stationIds = stations.map(s => s.id)
  const numStations = stationIds.length

  const updates = groups.map((group) => {
    const nextRotation = (group.current_rotation ?? 0) + 1

    // Lấy station tiếp theo từ rotation_order
    const order = group.rotation_order as number[] | null
    let nextStationIndex: number

    if (order && order.length > 0) {
      // Dùng rotation_order nếu có
      nextStationIndex = order[nextRotation % order.length]
    } else {
      // Fallback: xoay vòng tuần tự
      nextStationIndex = nextRotation % numStations
    }

    return supabase
      .from('groups')
      .update({
        current_station_id: stationIds[nextStationIndex],
        current_rotation: nextRotation,
      })
      .eq('id', group.id)
  })

  await Promise.all(updates)

  // Restart timer cho vòng mới
  const { data: sess } = await supabase
    .from('sessions')
    .select('rotation_time_minutes')
    .eq('id', sessionId)
    .single()

  const rotMins = sess?.rotation_time_minutes ?? 15
  const timerEnd = new Date(Date.now() + rotMins * 60 * 1000)

  await supabase
    .from('sessions')
    .update({
      timer_end_at: timerEnd.toISOString(),
      current_round: groups[0] ? (groups[0].current_rotation ?? 0) + 1 : 0,
    } as any)
    .eq('id', sessionId)
}

// ─── SERVER-SYNCED TIMER ────────────────────

/**
 * Lấy thời gian còn lại (giây) từ server.
 * Client nên gọi 1 lần rồi đếm ngược local, chỉ re-sync mỗi 30s.
 */
export function getTimeRemaining(timerEndAt: string | null): number {
  if (!timerEndAt) return 0
  const endTime = new Date(timerEndAt).getTime()
  const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
  return remaining
}

/**
 * GV bấm Start / Resume timer.
 * Cập nhật timer_end_at trên server.
 */
export async function startTimer(
  sessionId: string,
  durationMinutes: number
): Promise<void> {
  const timerEnd = new Date(Date.now() + durationMinutes * 60 * 1000)

  const { error } = await supabase
    .from('sessions')
    .update({ timer_end_at: timerEnd.toISOString() } as any)
    .eq('id', sessionId)

  if (error) throw new Error(`Bắt đầu timer thất bại: ${error.message}`)
}

/**
 * GV bấm Pause timer.
 * Xóa timer_end_at → HS thấy timer dừng.
 */
export async function pauseTimer(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ timer_end_at: null } as any)
    .eq('id', sessionId)

  if (error) throw new Error(`Dừng timer thất bại: ${error.message}`)
}

/**
 * Chuyển 1 nhóm cụ thể sang 1 góc cụ thể.
 * Dùng cho mode 'teacher_directed'.
 */
export async function rotateGroup(
  groupId: string,
  nextStationId: string
): Promise<void> {
  const { data: group } = await supabase
    .from('groups')
    .select('current_rotation')
    .eq('id', groupId)
    .single()

  const nextRotation = (group?.current_rotation ?? 0) + 1

  const { error } = await supabase
    .from('groups')
    .update({
      current_station_id: nextStationId,
      current_rotation: nextRotation,
    })
    .eq('id', groupId)

  if (error) throw new Error(`Chuyển góc thất bại: ${error.message}`)
}

// ─── KẾT THÚC PHIÊN ────────────────────────

/** Kết thúc phiên học */
export async function endSessionFromLive(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw new Error(`Kết thúc phiên thất bại: ${error.message}`)
}

// ─── REALTIME SUBSCRIPTIONS ─────────────────

/**
 * Subscribe sự kiện groups thay đổi (khi rotate).
 * Dùng cho cả GV (xem bảng trạng thái) và HS (auto-navigate).
 */
export function subscribeToRotation(
  sessionId: string,
  onGroupChange: (payload: any) => void
) {
  const channel = supabase
    .channel(`rotation:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'groups',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        console.log('🔄 Rotation change:', payload)
        onGroupChange(payload)
      }
    )
    .subscribe()

  return channel
}

/**
 * Subscribe sự kiện session thay đổi status (active → completed).
 */
export function subscribeToSessionStatus(
  sessionId: string,
  onStatusChange: (newStatus: string) => void
) {
  const channel = supabase
    .channel(`session-status:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        const newRow = payload.new as any
        if (newRow?.status) {
          onStatusChange(newRow.status)
        }
      }
    )
    .subscribe()

  return channel
}

/**
 * Subscribe sự kiện task_results mới (khi HS nộp bài).
 * GV dùng để theo dõi tiến độ realtime.
 */
export function subscribeToTaskResults(
  sessionId: string,
  groupIds: string[],
  onNewResult: (payload: any) => void
) {
  // Subscribe cho từng group (Supabase filter hỗ trợ IN qua channel riêng)
  const channels = groupIds.map((gId) =>
    supabase
      .channel(`results:${gId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_results',
          filter: `group_id=eq.${gId}`,
        },
        onNewResult
      )
      .subscribe()
  )

  return channels
}
