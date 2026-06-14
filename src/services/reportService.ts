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
  pointsEarned: number
  xpEarned: number
}

export interface GroupReportItem {
  groupId: string
  groupName: string
  membersCount: number
  tasksCompleted: number
  pointsEarned: number
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
      .select('id, title, points, scoring_mode')
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
      .select('id, task_id, group_id, submitted_by, points_awarded, tagged_student_ids')
      .in('task_id', taskIds)
    taskResults = results ?? []
  }

  // 5. Aggregate Group Report
  const groupReports: GroupReportItem[] = groupList.map(g => {
    // Task results completed by this group
    const completedResults = taskResults.filter(r => r.group_id === g.id)
    const pointsSum = completedResults.reduce((sum, r) => sum + (r.points_awarded || 0), 0)

    return {
      groupId: g.id,
      groupName: g.name,
      membersCount: g.group_members?.length || 0,
      tasksCompleted: completedResults.length,
      pointsEarned: pointsSum
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

      const studentPoints = relevantResults.reduce((sum, r) => sum + (r.points_awarded || 0), 0)
      // Standard XP is equal to points earned plus dynamic role bonus
      const roleBonus = m.role === 'leader' ? 20 : m.role === 'secretary' ? 10 : 0
      const xpEarned = studentPoints + roleBonus

      studentReports.push({
        studentId: m.student_id,
        displayName: m.student.display_name || 'Học sinh',
        className: m.student.class_name || 'Tự do',
        groupName: g.name,
        role: m.role === 'leader' ? 'Nhóm trưởng' : m.role === 'secretary' ? 'Thư ký' : 'Thành viên',
        tasksCompleted: relevantResults.length,
        pointsEarned: studentPoints,
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
    'Điểm số',
    'XP nhận được'
  ]

  const rows = reportData.students.map(s => [
    s.displayName,
    s.className,
    s.groupName,
    s.role,
    s.tasksCompleted.toString(),
    s.pointsEarned.toString(),
    s.xpEarned.toString()
  ])

  // Include group reports as a separate section in the CSV
  const groupHeaders = ['', '', '', '', '', '', '']
  const groupSectionTitle = ['BÁO CÁO TIẾN ĐỘ NHÓM', '', '', '', '', '', '']
  const groupHeadersActual = ['Tên nhóm', 'Số thành viên', 'Nhiệm vụ hoàn thành', 'Tổng điểm nhóm', '', '', '']
  const groupRows = reportData.groups.map(g => [
    g.groupName,
    g.membersCount.toString(),
    g.tasksCompleted.toString(),
    g.pointsEarned.toString(),
    '',
    '',
    ''
  ])

  const csvContent = [
    [`BÁO CÁO PHIÊN HỌC: ${reportData.sessionTitle.toUpperCase()}`, '', '', '', '', '', ''],
    [`Môn học: ${reportData.subject}`, '', '', '', '', '', ''],
    [`Ngày dạy: ${reportData.date}`, '', '', '', '', '', ''],
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
