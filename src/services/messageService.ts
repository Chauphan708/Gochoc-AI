import { supabase } from '@/lib/supabase'
import type { Message } from '@/types/database'

export async function sendMessage(input: {
  sessionId: string,
  senderType: 'teacher' | 'leader' | 'secretary',
  senderId: string,
  recipientType: 'teacher' | 'group' | 'all_groups',
  recipientGroupId?: string,
  content: string
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      session_id: input.sessionId,
      sender_type: input.senderType,
      sender_id: input.senderId,
      recipient_type: input.recipientType,
      recipient_group_id: input.recipientGroupId,
      content: input.content
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Message
}

export async function getSessionMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Message[]
}

// Lắng nghe realtime messages
export function subscribeToMessages(sessionId: string, callback: (msg: Message) => void) {
  return supabase
    .channel(`messages_${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `session_id=eq.${sessionId}`
      },
      (payload) => {
        callback(payload.new as Message)
      }
    )
    .subscribe()
}
