/* ═══════════════════════════════════════
   REPORT SERVICE — GócHọc AI
   Aggregate results, calculate XP & exports
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'

export interface StudentReportItem {
  studentId: string
  displayName: string
  className: string
  groupName: string
  role: string
  tasksCompleted: number
  xpEarned: number
}

export interface GroupReportItem {
  groupId: string
  groupName: string
  membersCount: number
  tasksCompleted: number
  xpEarned: number
}

export interface SessionReportData {
  sessionTitle: string
  subject: string
  date: string
  students: StudentReportItem[]
  groups: GroupReportItem[]
  totalTasks: number
}

/** Aggregate all task results, group members, and student details for reporting */
export async function getSessionReport(sessionId: string): Promise<SessionReportData> {
  // 1. Fetch Session details
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('title, subject, created_at')
    .eq('id', sessionId)
    .single()

  if (sessErr || !session) throw new Error('Không tìm thấy phiên học')

  // 2. Fetch Stations and Tasks
  const { data: stations } = await supabase
    .from('stations')
    .select('id')
    .eq('session_id', sessionId)

  const stationIds = (stations ?? []).map(s => s.id)
  let tasks: any[] = []

  if (stationIds.length > 0) {
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, title, xp_reward, scoring_mode')
      .in('station_id', stationIds)
    tasks = tasksData ?? []
  }

  const taskIds = tasks.map(t => t.id)

  // 3. Fetch Groups and Members
  const { data: groups } = await supabase
    .from('groups')
    .select(`
      id, name,
      group_members (
        student_id, role,
        student:students (display_name, class_name)
      )
    `)
    .eq('session_id', sessionId)

  const groupList = (groups ?? []) as any[]

  // 4. Fetch Task Results
  let taskResults: any[] = []
  if (taskIds.length > 0) {
    const { data: results } = await supabase
      .from('task_results')
      .select('id, task_id, group_id, submitted_by, xp_earned, tagged_student_ids')
      .in('task_id', taskIds)
    taskResults = results ?? []
  }

  // 5. Aggregate Group Report
  const groupReports: GroupReportItem[] = groupList.map(g => {
    // Task results completed by this group
    const completedResults = taskResults.filter(r => r.group_id === g.id)
    const xpSum = completedResults.reduce((sum, r) => sum + (r.xp_earned || 0), 0)

    return {
      groupId: g.id,
      groupName: g.name,
      membersCount: g.group_members?.length || 0,
      tasksCompleted: completedResults.length,
      xpEarned: xpSum
    }
  })

  // 6. Aggregate Student Report
  const studentReports: StudentReportItem[] = []

  groupList.forEach(g => {
    const members = g.group_members || []
    
    members.forEach((m: any) => {
      if (!m.student) return

      // Find results that affect this student:
      // - Either individual submission by this student
      // - Or group submission (group_equal mode) for this student's group
      // - Or tagged submission (group_leader_tag mode) where student is tagged
      const relevantResults = taskResults.filter(r => {
        const task = tasks.find(t => t.id === r.task_id)
        if (!task) return false

        if (task.scoring_mode === 'individual') {
          return r.submitted_by === m.student_id
        } else if (task.scoring_mode === 'group_equal') {
          return r.group_id === g.id
        } else if (task.scoring_mode === 'group_leader_tag') {
          const tags = r.tagged_student_ids || []
          return r.group_id === g.id && tags.includes(m.student_id)
        }
        return false
      })

      const studentXp = relevantResults.reduce((sum, r) => sum + (r.xp_earned || 0), 0)
      const roleBonus = m.role === 'leader' ? 20 : m.role === 'secretary' ? 10 : 0
      const xpEarned = studentXp + roleBonus

      studentReports.push({
        studentId: m.student_id,
        displayName: m.student.display_name || 'Học sinh',
        className: m.student.class_name || 'Tự do',
        groupName: g.name,
        role: m.role === 'leader' ? 'Nhóm trưởng' : m.role === 'secretary' ? 'Thư ký' : 'Thành viên',
        tasksCompleted: relevantResults.length,
        xpEarned
      })
    })
  })

  // Sort students by XP descending (Rankings)
  studentReports.sort((a, b) => b.xpEarned - a.xpEarned)

  return {
    sessionTitle: session.title,
    subject: session.subject || 'Không có',
    date: new Date(session.created_at).toLocaleDateString('vi-VN'),
    students: studentReports,
    groups: groupReports,
    totalTasks: tasks.length
  }
}

/** Export the aggregated report data to a downloadable CSV file */
export function exportToCSV(reportData: SessionReportData): void {
  const headers = [
    'Học sinh',
    'Lớp',
    'Nhóm',
    'Vai trò',
    'Nhiệm vụ hoàn thành',
    'XP nhận được'
  ]

  const rows = reportData.students.map(s => [
    s.displayName,
    s.className,
    s.groupName,
    s.role,
    s.tasksCompleted.toString(),
    s.xpEarned.toString()
  ])

  // Include group reports as a separate section in the CSV
  const groupHeaders = ['', '', '', '', '']
  const groupSectionTitle = ['BÁO CÁO TIẾN ĐỘ NHÓM', '', '', '', '']
  const groupHeadersActual = ['Tên nhóm', 'Số thành viên', 'Nhiệm vụ hoàn thành', 'Tổng XP nhóm', '']
  const groupRows = reportData.groups.map(g => [
    g.groupName,
    g.membersCount.toString(),
    g.tasksCompleted.toString(),
    g.xpEarned.toString(),
    ''
  ])

  const csvContent = [
    [`BÁO CÁO PHIÊN HỌC: ${reportData.sessionTitle.toUpperCase()}`, '', '', '', ''],
    [`Môn học: ${reportData.subject}`, '', '', '', ''],
    [`Ngày dạy: ${reportData.date}`, '', '', '', ''],
    [],
    headers,
    ...rows,
    [],
    groupSectionTitle,
    groupHeadersActual,
    ...groupRows
  ]
    .map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    .join('\n')

  // Create and trigger browser download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `bao_cao_goc_hoc_${reportData.sessionTitle.replace(/\s+/g, '_')}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ═══════════════════════════════════════
// BÁO CÁO TỔNG HỢP — Aggregate tất cả phiên
// ═══════════════════════════════════════

export interface SessionSummaryItem {
  id: string
  title: string
  subject: string
  date: string
  status: string
  studentsCount: number
  groupsCount: number
  totalXp: number
  tasksCount: number
}

export interface StudentOverallItem {
  studentId: string
  displayName: string
  className: string
  totalXp: number
  sessionsJoined: number
  tasksCompleted: number
}

export interface OverallReportData {
  totalSessions: number
  activeSessions: number
  completedSessions: number
  totalStudents: number
  totalXpAwarded: number
  sessions: SessionSummaryItem[]
  topStudents: StudentOverallItem[]
}

/** Báo cáo tổng hợp — aggregate tất cả phiên học của GV */
export async function getOverallReport(teacherId: string): Promise<OverallReportData> {
  // 1. Lấy tất cả phiên
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, subject, status, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  const sessionList = sessions ?? []

  // 2. Xử lý từng phiên — lấy thống kê nhanh
  const sessionSummaries: SessionSummaryItem[] = []
  const studentXpMap = new Map<string, { displayName: string; className: string; totalXp: number; sessions: Set<string>; tasks: number }>()

  for (const sess of sessionList) {
    // Đếm groups
    const { count: groupsCount } = await supabase
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sess.id)

    // Đếm students (qua group_members)
    const { data: groups } = await supabase
      .from('groups')
      .select('id, group_members(student_id, student:students(display_name, class_name))')
      .eq('session_id', sess.id)

    const groupList = (groups ?? []) as any[]
    const studentIds = new Set<string>()
    groupList.forEach(g => {
      (g.group_members || []).forEach((m: any) => {
        if (m.student_id) studentIds.add(m.student_id)
      })
    })

    // Đếm tasks + tổng XP
    const { data: stations } = await supabase
      .from('stations')
      .select('id')
      .eq('session_id', sess.id)

    const stationIds = (stations ?? []).map(s => s.id)
    let tasksCount = 0
    let totalXp = 0

    if (stationIds.length > 0) {
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('station_id', stationIds)
      tasksCount = count ?? 0

      const { data: results } = await supabase
        .from('task_results')
        .select('xp_earned, submitted_by, task_id')
        .in('task_id', (await supabase.from('tasks').select('id').in('station_id', stationIds)).data?.map(t => t.id) ?? [])
      
      const resultList = results ?? []
      totalXp = resultList.reduce((sum, r) => sum + (r.xp_earned || 0), 0)

      // Aggregate XP per student
      resultList.forEach(r => {
        if (!r.submitted_by) return
        const existing = studentXpMap.get(r.submitted_by)
        if (existing) {
          existing.totalXp += r.xp_earned || 0
          existing.sessions.add(sess.id)
          existing.tasks += 1
        }
      })
    }

    // Populate student map từ group members
    groupList.forEach(g => {
      (g.group_members || []).forEach((m: any) => {
        if (!m.student_id || !m.student) return
        if (!studentXpMap.has(m.student_id)) {
          studentXpMap.set(m.student_id, {
            displayName: m.student.display_name || 'Học sinh',
            className: m.student.class_name || '',
            totalXp: 0,
            sessions: new Set([sess.id]),
            tasks: 0,
          })
        } else {
          studentXpMap.get(m.student_id)!.sessions.add(sess.id)
        }
      })
    })

    sessionSummaries.push({
      id: sess.id,
      title: sess.title,
      subject: sess.subject || 'Không có',
      date: new Date(sess.created_at).toLocaleDateString('vi-VN'),
      status: sess.status,
      studentsCount: studentIds.size,
      groupsCount: groupsCount ?? 0,
      totalXp,
      tasksCount,
    })
  }

  // 3. Top students — sort by XP
  const topStudents: StudentOverallItem[] = Array.from(studentXpMap.entries())
    .map(([id, data]) => ({
      studentId: id,
      displayName: data.displayName,
      className: data.className,
      totalXp: data.totalXp,
      sessionsJoined: data.sessions.size,
      tasksCompleted: data.tasks,
    }))
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, 20)

  // 4. Aggregate stats
  const totalStudents = new Set<string>()
  sessionSummaries.forEach(() => {
    studentXpMap.forEach((_, id) => totalStudents.add(id))
  })

  return {
    totalSessions: sessionList.length,
    activeSessions: sessionList.filter(s => s.status === 'active' || s.status === 'lobby').length,
    completedSessions: sessionList.filter(s => s.status === 'ended' || s.status === 'completed').length,
    totalStudents: totalStudents.size,
    totalXpAwarded: sessionSummaries.reduce((sum, s) => sum + s.totalXp, 0),
    sessions: sessionSummaries,
    topStudents,
  }
}

/** Xuất báo cáo tổng hợp ra CSV */
export function exportOverallCSV(data: OverallReportData): void {
  const headers = ['Phiên học', 'Môn học', 'Ngày dạy', 'Trạng thái', 'Số HS', 'Số nhóm', 'Tổng XP', 'Số nhiệm vụ']

  const rows = data.sessions.map(s => [
    s.title,
    s.subject,
    s.date,
    s.status === 'ended' || s.status === 'completed' ? 'Hoàn thành' : s.status === 'active' ? 'Đang chạy' : 'Sảnh chờ',
    s.studentsCount.toString(),
    s.groupsCount.toString(),
    s.totalXp.toString(),
    s.tasksCount.toString(),
  ])

  const studentHeaders = ['Học sinh', 'Lớp', 'Tổng XP', 'Số phiên tham gia', 'Nhiệm vụ hoàn thành']
  const studentRows = data.topStudents.map(s => [
    s.displayName,
    s.className,
    s.totalXp.toString(),
    s.sessionsJoined.toString(),
    s.tasksCompleted.toString(),
  ])

  const csvContent = [
    ['BÁO CÁO TỔNG HỢP GOCHOC AI', '', '', '', '', '', '', ''],
    [`Tổng phiên: ${data.totalSessions}`, `Đã hoàn thành: ${data.completedSessions}`, `Tổng HS: ${data.totalStudents}`, '', '', '', '', ''],
    [],
    headers,
    ...rows,
    [],
    ['BẢNG XẾP HẠNG HỌC SINH', '', '', '', ''],
    studentHeaders,
    ...studentRows,
  ]
    .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `bao_cao_tong_hop_gochoc_${new Date().toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

