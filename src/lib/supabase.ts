/* ═══════════════════════════════════════
   SUPABASE CONFIGURATION
   ═══════════════════════════════════════
   Tạo file .env.local với các biến sau:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ═══════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase chưa được cấu hình.' +
    '\nTạo file .env.local với VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
