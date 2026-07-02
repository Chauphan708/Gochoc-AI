/* ═══════════════════════════════════════
   TEMPLATE SERVICE — GócHọc AI
   CRUD cho Kho Mẫu phiên học
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import type { SessionTemplate } from '@/types/database'

export interface TemplateConfig {
  sessionSettings: {
    mode: string
    rotation_mode: string
    rotation_time_minutes: number
    total_time_minutes: number | null
    max_stations: number
    grouping_mode: string
    group_size: number
    role_assignment: string
    device_mode: string
    allow_observers: boolean
    round_durations: string | null
  }
  stations: {
    name: string
    description: string | null
    order_num: number
    bot_persona: string | null
    bot_custom_prompt: string | null
    bot_language_level: string | null
    bot_allow_hints: boolean
    bot_max_hints: number
    knowledge_text: string | null
    tasks: {
      title: string
      type: string
      content: any
      order_num: number
      xp_reward: number
      time_limit_minutes: number | null
      scoring_mode: string
      grading_mode: string
      require_individual_login: boolean
    }[]
  }[]
}

/** Lấy danh sách mẫu của GV */
export async function getTemplates(teacherId: string): Promise<SessionTemplate[]> {
  const { data, error } = await supabase
    .from('session_templates')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Lấy danh sách mẫu thất bại: ${error.message}`)
  return data ?? []
}

/** Lưu phiên học thành mẫu */
export async function saveAsTemplate(
  sessionId: string,
  teacherId: string,
  name: string,
  description?: string
): Promise<SessionTemplate> {
  // 1. Lấy thông tin phiên
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessErr || !session) throw new Error('Không tìm thấy phiên học')

  // 2. Lấy stations + tasks
  const { data: stations } = await supabase
    .from('stations')
    .select('*')
    .eq('session_id', sessionId)
    .order('order_num')

  const stationList = stations ?? []
  const stationIds = stationList.map(s => s.id)

  let allTasks: any[] = []
  if (stationIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .in('station_id', stationIds)
      .order('order_num')
    allTasks = tasks ?? []
  }

  // 3. Build config snapshot
  const config: TemplateConfig = {
    sessionSettings: {
      mode: session.mode,
      rotation_mode: session.rotation_mode,
      rotation_time_minutes: session.rotation_time_minutes,
      total_time_minutes: session.total_time_minutes,
      max_stations: session.max_stations,
      grouping_mode: session.grouping_mode,
      group_size: session.group_size,
      role_assignment: session.role_assignment,
      device_mode: session.device_mode,
      allow_observers: session.allow_observers,
      round_durations: session.round_durations,
    },
    stations: stationList.map(s => ({
      name: s.name,
      description: s.description,
      order_num: s.order_num,
      bot_persona: s.bot_persona,
      bot_custom_prompt: s.bot_custom_prompt,
      bot_language_level: s.bot_language_level,
      bot_allow_hints: s.bot_allow_hints ?? true,
      bot_max_hints: s.bot_max_hints ?? 3,
      knowledge_text: s.knowledge_text,
      tasks: allTasks
        .filter(t => t.station_id === s.id)
        .map(t => ({
          title: t.title,
          type: t.type,
          content: t.content,
          order_num: t.order_num,
          xp_reward: t.xp_reward,
          time_limit_minutes: t.time_limit_minutes,
          scoring_mode: t.scoring_mode,
          grading_mode: t.grading_mode,
          require_individual_login: t.require_individual_login ?? false,
        })),
    })),
  }

  // 4. Insert template
  const { data: template, error: insertErr } = await supabase
    .from('session_templates')
    .insert({
      teacher_id: teacherId,
      name,
      description: description || null,
      subject: session.subject,
      grade_level: session.grade_level,
      config,
    } as any)
    .select()
    .single()

  if (insertErr) throw new Error(`Lưu mẫu thất bại: ${insertErr.message}`)
  return template
}

/** Tạo phiên mới từ mẫu */
export async function createSessionFromTemplate(
  templateId: string,
  teacherId: string,
  newTitle: string
): Promise<string> {
  // 1. Lấy template
  const { data: template, error: tErr } = await supabase
    .from('session_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (tErr || !template) throw new Error('Không tìm thấy mẫu')

  const config = template.config as any as TemplateConfig

  // 2. Tạo join_code mới (4 số)
  const joinCode = Math.floor(1000 + Math.random() * 9000).toString()

  // 3. Tạo session mới
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .insert({
      teacher_id: teacherId,
      title: newTitle,
      subject: template.subject,
      grade_level: template.grade_level,
      mode: config.sessionSettings.mode,
      join_code: joinCode,
      rotation_mode: config.sessionSettings.rotation_mode,
      rotation_time_minutes: config.sessionSettings.rotation_time_minutes,
      total_time_minutes: config.sessionSettings.total_time_minutes,
      max_stations: config.sessionSettings.max_stations,
      grouping_mode: config.sessionSettings.grouping_mode,
      group_size: config.sessionSettings.group_size,
      role_assignment: config.sessionSettings.role_assignment,
      device_mode: config.sessionSettings.device_mode,
      allow_observers: config.sessionSettings.allow_observers,
      round_durations: config.sessionSettings.round_durations,
      status: 'draft',
      current_round: 0,
    } as any)
    .select()
    .single()

  if (sessErr || !session) throw new Error(`Tạo phiên mới thất bại: ${sessErr?.message}`)

  // 4. Tạo stations + tasks
  for (const stationConfig of config.stations) {
    const { data: station, error: stErr } = await supabase
      .from('stations')
      .insert({
        session_id: session.id,
        name: stationConfig.name,
        description: stationConfig.description,
        order_num: stationConfig.order_num,
        bot_persona: stationConfig.bot_persona,
        bot_custom_prompt: stationConfig.bot_custom_prompt,
        bot_language_level: stationConfig.bot_language_level,
        bot_allow_hints: stationConfig.bot_allow_hints,
        bot_max_hints: stationConfig.bot_max_hints,
        knowledge_text: stationConfig.knowledge_text,
      } as any)
      .select()
      .single()

    if (stErr || !station) continue

    // Tạo tasks cho station này
    if (stationConfig.tasks.length > 0) {
      const taskInserts = stationConfig.tasks.map(t => ({
        station_id: station.id,
        title: t.title,
        type: t.type,
        content: t.content,
        order_num: t.order_num,
        xp_reward: t.xp_reward,
        time_limit_minutes: t.time_limit_minutes,
        scoring_mode: t.scoring_mode,
        grading_mode: t.grading_mode,
        require_individual_login: t.require_individual_login,
      }))

      await supabase.from('tasks').insert(taskInserts as any)
    }
  }

  return session.id
}

/** Xóa mẫu */
export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('session_templates')
    .delete()
    .eq('id', templateId)

  if (error) throw new Error(`Xóa mẫu thất bại: ${error.message}`)
}
