/* ═══════════════════════════════════════
   DATABASE TYPES — GócHọc AI v5
   Auto-generate with: npx supabase gen types typescript
   ═══════════════════════════════════════ */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enums
export type SessionMode = 'station_rotation' | 'big_game'
export type RotationMode = 'fixed' | 'teacher_directed'
export type GroupingMode = 'random' | 'gender_balanced' | 'manual' | 'student_choice'
export type RoleAssignment = 'teacher_assign' | 'student_nominate'
export type DeviceMode = 'individual' | 'shared'
export type TaskType = 'quiz' | 'short_answer' | 'photo_upload' | 'practice' | 'cipher'
export type ScoringMode = 'individual' | 'group_equal' | 'group_leader_tag'
export type GradingMode = 'auto' | 'teacher'
export type ScoreDistribution = 'full' | 'equal' | 'weighted'
export type GroupRole = 'member' | 'leader' | 'secretary'
export type CollaboratorRole = 'co_teacher' | 'assistant' | 'observer'
export type NominatedRole = 'leader' | 'secretary'
export type Gender = 'male' | 'female' | 'other'
export type SenderType = 'teacher' | 'co_teacher' | 'assistant' | 'leader' | 'secretary'
export type RecipientType = 'teacher' | 'group' | 'all_groups' | 'co_teachers'
export type ChatRole = 'student' | 'bot'

// ═══════════════════════════════════════
// TABLE TYPES
// ═══════════════════════════════════════

export interface Teacher {
  id: string
  full_name: string
  school_name: string | null
  subject: string | null
  avatar_url: string | null
  created_at: string
}

export interface Student {
  id: string
  display_name: string
  student_code: string | null
  gender: Gender | null
  class_name: string | null
  teacher_id: string | null
  total_xp: number
  total_points: number
  badges: Json
  total_sessions: number
  total_interactions: number
  total_group_interactions: number
  streak_days: number
  avatar_url: string | null
  created_at: string
}

export interface Session {
  id: string
  teacher_id: string
  title: string
  subject: string | null
  grade_level: string | null
  mode: SessionMode
  join_code: string
  rotation_mode: RotationMode
  rotation_time_minutes: number
  total_time_minutes: number | null
  max_stations: number
  grouping_mode: GroupingMode
  group_size: number
  role_assignment: RoleAssignment
  device_mode: DeviceMode
  allow_observers: boolean
  observer_join_code: string | null
  status: string
  started_at: string | null
  ended_at: string | null
  timer_end_at: string | null
  current_round: number
  round_durations: string | null
  created_at: string
}

export interface Station {
  id: string
  session_id: string
  name: string
  description: string | null
  order_num: number
  bot_persona: string
  bot_custom_prompt: string | null
  bot_language_level: string
  bot_allow_hints: boolean
  bot_max_hints: number
  knowledge_text: string | null
  knowledge_files: string[] | null
  created_at: string
}

export interface Task {
  id: string
  station_id: string
  title: string
  type: TaskType
  content: Json
  order_num: number
  points: number
  time_limit_minutes: number | null
  scoring_mode: ScoringMode
  grading_mode: GradingMode
  require_individual_login: boolean
}

export interface Group {
  id: string
  session_id: string
  name: string
  current_station_id: string | null
  rotation_order: number[] | null
  current_rotation: number
  active_device_id: string | null
  active_student_id: string | null
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  student_id: string
  role: GroupRole
}

export interface SessionCollaborator {
  id: string
  session_id: string
  teacher_id: string
  role: CollaboratorRole
  permissions: Json
  status: string
  invited_at: string
  approved_at: string | null
}

export interface RoleNomination {
  id: string
  session_id: string
  group_id: string
  student_id: string
  nominated_role: NominatedRole | null
  reason: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Message {
  id: string
  session_id: string | null
  sender_type: SenderType | null
  sender_id: string
  recipient_type: RecipientType | null
  recipient_group_id: string | null
  content: string
  is_read: boolean
  created_at: string
}

export interface ChatMessage {
  id: string
  station_id: string | null
  student_id: string | null
  group_id: string | null
  role: ChatRole | null
  content: string
  created_at: string
}

export interface TaskResult {
  id: string
  task_id: string | null
  group_id: string | null
  submitted_by: string | null
  submitted_for: string[]
  answer: Json | null
  score: number | null
  max_score: number | null
  hints_used: number
  xp_earned: number
  feedback: string | null
  score_distribution: ScoreDistribution
  completed_at: string
}

export interface SharedDeviceSession {
  id: string
  group_id: string
  device_id: string
  student_id: string
  switched_in_at: string
  switched_out_at: string | null
  actions_count: number
}

export interface SessionParticipant {
  id: string
  session_id: string
  student_id: string
  is_online: boolean
  nominated_role: NominatedRole | null
  group_id: string | null
  joined_at: string
  last_seen_at: string
}

// ═══════════════════════════════════════
// SUPABASE DATABASE INTERFACE
// ═══════════════════════════════════════

export interface Database {
  public: {
    Tables: {
      teachers: {
        Row: Teacher
        Insert: Omit<Teacher, 'created_at'> & { created_at?: string }
        Update: Partial<Teacher>
      }
      students: {
        Row: Student
        Insert: Partial<Omit<Student, 'created_at'>> & { id: string; display_name: string }
        Update: Partial<Omit<Student, 'id' | 'created_at'>>
      }
      sessions: {
        Row: Session
        Insert: Partial<Session> & { teacher_id: string; title: string; join_code: string }
        Update: Partial<Session>
      }
      stations: {
        Row: Station
        Insert: Partial<Station> & { session_id: string; name: string; order_num: number }
        Update: Partial<Station>
      }
      session_participants: {
        Row: SessionParticipant
        Insert: Partial<SessionParticipant> & { session_id: string; student_id: string }
        Update: Partial<SessionParticipant>
      }
      tasks: {
        Row: Task
        Insert: Partial<Task> & { station_id: string; title: string; type: TaskType; content: Json; order_num: number }
        Update: Partial<Task>
      }
      groups: {
        Row: Group
        Insert: Partial<Group> & { session_id: string; name: string }
        Update: Partial<Group>
      }
      group_members: {
        Row: GroupMember
        Insert: Partial<GroupMember> & { group_id: string; student_id: string }
        Update: Partial<GroupMember>
      }
      session_collaborators: {
        Row: SessionCollaborator
        Insert: Partial<SessionCollaborator> & { session_id: string; teacher_id: string; role: CollaboratorRole }
        Update: Partial<SessionCollaborator>
      }
      messages: {
        Row: Message
        Insert: Partial<Message> & { sender_id: string; content: string }
        Update: Partial<Message>
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Partial<ChatMessage> & { content: string }
        Update: Partial<ChatMessage>
      }
      task_results: {
        Row: TaskResult
        Insert: Partial<Omit<TaskResult, 'id' | 'completed_at'>> & { task_id?: string; group_id?: string }
        Update: Partial<Omit<TaskResult, 'id'>>
      }
      shared_device_sessions: {
        Row: SharedDeviceSession
        Insert: Partial<SharedDeviceSession> & { group_id: string; device_id: string; student_id: string }
        Update: Partial<SharedDeviceSession>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
