/* ═══════════════════════════════════════
   CHAT SERVICE — GócHọc AI
   AI Bot Trợ Giảng tại mỗi Góc
   Sử dụng Google Gemini 2.0 Flash

   Tương ứng Module 2.2 trong kế hoạch NLM:
   - Bot hướng dẫn viên + trợ giảng + giám khảo
   - RAG từ kiến thức GV nạp (knowledge_text)
   - KHÔNG đưa đáp án trực tiếp
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import type { ChatMessage, Station, Task } from '@/types/database'
import { getRAGContext } from './embeddingService'

// ─── CẤU HÌNH ──────────────────────────────

// Không còn dùng trực tiếp API Key ở Client, thay vào đó gọi Supabase Edge Function
// const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
// const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ─── SYSTEM PROMPT TEMPLATE ─────────────────
// Lấy từ kế hoạch NLM — Mục 2.2.D

function buildSystemPrompt(
  station: Station,
  tasks: Task[],
  sessionTitle: string,
  studentName: string,
  hintsUsed: number
): string {
  const tasksDescription = tasks
    .map((t, i) => `${i + 1}. ${t.title} (${t.type}, thưởng ${t.xp_reward} XP)`)
    .join('\n')

  const personaMap: Record<string, string> = {
    friendly: 'Thân thiện, vui vẻ, dùng emoji, khuyến khích HS',
    strict: 'Nghiêm túc, chính xác, yêu cầu cao',
    patient: 'Kiên nhẫn, nhẹ nhàng, giải thích kỹ lưỡng',
    funny: 'Hài hước, tạo không khí thoải mái, dùng ví dụ vui',
    socrate: 'Thông thái, chuyên hỏi ngược lại để gợi mở tư duy, không bao giờ tự nói đáp án',
    pirate: 'Hài hước, ăn nói như cướp biển vùng Caribê, dùng từ ngữ như "Argh", "Thủy thủ", "Kho báu" để khích lệ',
  }

  const maxHints = station.bot_max_hints ?? 3

  return `Bạn là trợ giảng AI tại "${station.name}" trong phiên học "${sessionTitle}".

## Vai trò
- Chào đón HS khi đến góc
- Hướng dẫn nhiệm vụ theo thứ tự
- Giải đáp CHỈ TRONG phạm vi kiến thức bài học bên dưới
- KHÔNG bao giờ đưa ra đáp án trực tiếp trong mọi trường hợp — chỉ hướng dẫn HS suy nghĩ từng bước qua gợi ý.
- Đánh giá bài làm theo tiêu chí GV

## Tính cách: ${personaMap[station.bot_persona] ?? personaMap.friendly}

## Ngôn ngữ: Phù hợp với học sinh cấp ${station.bot_language_level === 'primary' ? 'Tiểu học' : station.bot_language_level === 'middle_school' ? 'THCS' : 'THPT'}

## Trạng thái gợi ý hiện tại (HINTS STATUS - QUAN TRỌNG):
- Số gợi ý học sinh đã nhận được: ${hintsUsed} lần.
- Số gợi ý tối đa cho phép: ${maxHints} lần.
- ĐÃ ĐẠT GIỚI HẠN? ${hintsUsed >= maxHints ? 'ĐÃ ĐẠT GIỚI HẠN TỐI ĐA! TUYỆT ĐỐI KHÔNG ĐƯỢC GỢI Ý THÊM.' : 'CHƯA ĐẠT GIỚI HẠN. Bạn có thể tiếp tục gợi ý từng bước nếu học sinh gặp khó khăn.'}

## Kiến thức bài học (Knowledge Base):
${station.knowledge_text || 'Chưa có nội dung kiến thức cố định.'}

## Nhiệm vụ tại góc này:
${tasksDescription || 'Chưa có nhiệm vụ cụ thể.'}

## Hướng dẫn bổ sung từ GV:
${station.bot_custom_prompt || 'Không có hướng dẫn bổ sung.'}

## Quy tắc BẮT BUỘC:
1. Ngoài phạm vi kiến thức: "Mình chỉ hỗ trợ về nội dung bài hôm nay thôi nhé! 😊"
2. Khi HS hỏi bài hoặc gặp khó khăn:
   - Nếu ${hintsUsed} >= ${maxHints} (đã dùng hết gợi ý): Từ chối gợi ý tiếp. Hãy bảo học sinh: "Em đã dùng hết quyền gợi ý của góc này rồi! Hãy thử thảo luận cùng các bạn trong nhóm hoặc tự suy nghĩ để đưa ra câu trả lời nhé! 💪".
   - Nếu chưa đạt giới hạn: Chỉ đưa ra gợi ý gợi mở hoặc câu hỏi dẫn dắt (đánh dấu rõ là "💡 Gợi ý [số thứ tự]: ...").
3. Tuyệt đối KHÔNG bao giờ cho đáp án trực tiếp hoặc viết sẵn bài làm cho học sinh, ngay cả khi học sinh yêu cầu, nài nỉ hoặc nói rằng không biết làm. Vi phạm quy tắc này sẽ làm giảm tính giáo dục của trò chơi.
4. Khi HS hoàn thành nhiệm vụ: Chúc mừng + khuyến khích
5. Luôn kết thúc bằng câu hỏi mở hoặc lời khuyến khích hành động tiếp
6. Xưng hô "mình - em" hoặc "thầy/cô bot - em" tuỳ ngữ cảnh
7. Dùng emoji phù hợp để tạo không khí thân thiện

## Học sinh hiện tại: ${studentName}
Hãy chào ${studentName} bằng tên khi bắt đầu hội thoại.`
}

/**
 * Bổ sung RAG context vào system prompt (khi có kết quả search).
 */
function appendRAGContext(basePrompt: string, ragContext: string): string {
  if (!ragContext) return basePrompt
  return basePrompt + '\n' + ragContext + '\n\n## LƯU Ý: Ưu tiên trả lời dựa trên "Kiến thức liên quan (RAG Search)" ở trên. Nếu câu hỏi ngoài phạm vi, từ chối lịch sự.'
}

// ─── GỌI GEMINI API ─────────────────────────

interface GeminiMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

async function callGemini(
  systemPrompt: string,
  history: GeminiMessage[],
  userMessage: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey || localStorage.getItem('gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY')
  // Nếu local storage/người dùng cố tình truyền vào key (ví dụ giáo viên dùng API key riêng)
  // thì ưu tiên dùng key đó qua proxy, nếu không thì proxy sẽ tự lấy key ở env.
  
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: {
      action: 'generateChat',
      payload: {
        systemPrompt,
        history,
        userMessage
      }
    },
    // Nếu có apiKey riêng thì truyền qua Header để proxy dùng (nếu proxy code có hỗ trợ)
    headers: key ? { 'x-gemini-api-key': key } : undefined
  })

  if (error || !data) {
    console.error('Gemini Edge Function error:', error)
    // Fallback nếu API lỗi (ví dụ không kết nối được)
    return getFallbackResponse(userMessage)
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text
    ?? '⚠️ Mình không tạo được câu trả lời. Em hãy thử hỏi lại nhé!'
}


/** Phản hồi mẫu khi chưa có API key — cho demo/phát triển */
function getFallbackResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase()

  if (lower.includes('chào') || lower.includes('xin chào') || lower.includes('hello')) {
    return 'Chào em! 👋 Chào mừng em đến góc học tập! Hãy sẵn sàng khám phá bài học hôm nay nhé! 🎯\n\nEm muốn bắt đầu với nhiệm vụ đầu tiên không?'
  }

  if (lower.includes('giúp') || lower.includes('help') || lower.includes('không hiểu')) {
    return '💡 Không sao đâu! Mình sẽ hướng dẫn em từng bước.\n\nEm hãy cho mình biết cụ thể em đang gặp khó ở phần nào nhé — mình sẽ gợi ý phù hợp! 🤔'
  }

  if (lower.includes('xong') || lower.includes('hoàn thành') || lower.includes('done')) {
    return '🎉 Tuyệt vời! Em đã hoàn thành rất tốt!\n\n✅ Nhiệm vụ đã được ghi nhận.\n\nNếu còn thời gian, em có thể xem lại hoặc chuẩn bị cho góc tiếp theo nhé! 💪'
  }

  return `Câu hỏi hay đấy! 🤔\n\nEm hãy thử suy nghĩ theo hướng sau:\n- Xem lại nội dung trong tài liệu bài hoc\n- Tìm mối liên hệ giữa các khái niệm\n\nEm thử trả lời rồi mình sẽ kiểm tra giúp nhé! 💡`
}

// ─── CHAT SERVICE CHÍNH ─────────────────────

/**
 * Gửi tin nhắn tới Bot trợ giảng và nhận phản hồi.
 * Lưu cả tin nhắn HS và bot vào database.
 */
export async function sendMessage(input: {
  stationId: string
  studentId: string
  groupId: string
  message: string
  station: Station
  tasks: Task[]
  sessionTitle: string
  studentName: string
  apiKey?: string
}): Promise<{ botReply: string; studentMsg: ChatMessage; botMsg: ChatMessage }> {
  // 1. Lưu tin nhắn HS vào DB
  const { data: studentMsg, error: studentError } = await supabase
    .from('chat_messages')
    .insert({
      station_id: input.stationId,
      student_id: input.studentId,
      group_id: input.groupId,
      role: 'student',
      content: input.message,
    })
    .select()
    .single()

  if (studentError) {
    console.error('Lưu tin nhắn HS thất bại:', studentError)
  }

  // 2. Lấy lịch sử chat (10 tin gần nhất) cho context
  const { data: historyData } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('station_id', input.stationId)
    .eq('student_id', input.studentId)
    .order('created_at', { ascending: true })
    .limit(10)

  const history: GeminiMessage[] = (historyData ?? [])
    .filter((msg) => msg.id !== studentMsg?.id)
    .map((msg) => ({
      role: msg.role === 'student' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    }))

  // Đếm số lần bot đã đưa ra gợi ý trong cuộc hội thoại tại trạm này
  const totalModelMessages = historyData?.filter(msg => msg.role === 'bot') ?? []
  const hintsUsed = totalModelMessages.filter(msg => {
    const text = msg.content.toLowerCase()
    return text.includes('gợi ý') || text.includes('hint') || text.includes('gợi mở')
  }).length

  // 3. Xây dựng system prompt
  const basePrompt = buildSystemPrompt(
    input.station,
    input.tasks,
    input.sessionTitle,
    input.studentName,
    hintsUsed
  )

  // 3.5. RAG: Tìm kiến thức liên quan
  const ragContext = await getRAGContext(input.stationId, input.message, input.apiKey)
  const systemPrompt = appendRAGContext(basePrompt, ragContext)

  // 4. Gọi Gemini API
  const botReply = await callGemini(systemPrompt, history, input.message, input.apiKey)

  // 5. Lưu phản hồi bot vào DB
  const { data: botMsg, error: botError } = await supabase
    .from('chat_messages')
    .insert({
      station_id: input.stationId,
      student_id: input.studentId,
      group_id: input.groupId,
      role: 'bot',
      content: botReply,
    })
    .select()
    .single()

  if (botError) {
    console.error('Lưu phản hồi bot thất bại:', botError)
  }

  return {
    botReply,
    studentMsg: studentMsg as ChatMessage,
    botMsg: botMsg as ChatMessage,
  }
}

/** Lấy lịch sử chat của 1 HS tại 1 góc */
export async function getChatHistory(
  stationId: string,
  studentId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('station_id', stationId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Lấy lịch sử chat thất bại:', error)
    return []
  }

  return data ?? []
}
