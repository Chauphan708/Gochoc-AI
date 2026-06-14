import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, Loader2 } from 'lucide-react'
import { sendMessage } from '@/services/chatService'
import type { Station, Task } from '@/types/database'

interface AIChatWindowProps {
  station: Station
  group: any
  activeStudentId: string
  groupMembers: any[]
  tasks: Task[]
  sessionTitle: string
}

export function AIChatWindow({ 
  station, 
  group, 
  activeStudentId, 
  groupMembers, 
  tasks, 
  sessionTitle 
}: AIChatWindowProps) {
  const [chatInput, setChatInput] = useState('')
  const [isBotTyping, setIsBotTyping] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // System greeting on load
  useEffect(() => {
    setMessages([
      { 
        id: Date.now(), 
        sender: 'bot', 
        text: `Chào các em. Đây là ${station.name}. Hãy đọc tài liệu trạm và hoàn thành các nhiệm vụ nhé!` 
      }
    ])
  }, [station.id])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isBotTyping])

  const activeStudent = groupMembers.find(m => m.student_id === activeStudentId)

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!chatInput.trim() || isBotTyping || !station) return

    const messageText = chatInput
    const newMsg = {
      id: Date.now(),
      sender: 'user',
      text: messageText,
      studentId: activeStudentId
    }
    
    setMessages(prev => [...prev, newMsg])
    setChatInput('')
    setIsBotTyping(true)
    
    try {
      if (!navigator.onLine) {
        // Hàng đợi gửi chat khi offline
        const { queueOfflineAction } = await import('@/services/offlineService')
        await queueOfflineAction('CHAT_MESSAGE', {
          stationId: station.id,
          studentId: activeStudentId,
          groupId: group.id,
          content: messageText,
          station,
          tasks,
          sessionTitle,
          studentName: activeStudent?.student.display_name || 'Em'
        })

        const offlineReply = `💡 Thiết bị đang ngoại tuyến. Mình đã ghi nhận câu hỏi của em: "${messageText}".\n\nHàng đợi offline đã được lưu lại và sẽ tự động gửi đồng bộ lên hệ thống ngay khi thiết bị có mạng trở lại nhé! 😊`
        
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: offlineReply }])
          setIsBotTyping(false)
        }, 1000)
      } else {
        const { botReply } = await sendMessage({
          stationId: station.id,
          studentId: activeStudentId,
          groupId: group.id,
          message: messageText,
          station: station,
          tasks: tasks,
          sessionTitle: sessionTitle,
          studentName: activeStudent?.student.display_name || 'Em'
        })

        setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: botReply }])
        setIsBotTyping(false)
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, sender: 'bot', text: '⚠️ Xin lỗi, có lỗi kết nối tới bot. Vui lòng thử lại.'
      }])
      setIsBotTyping(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#161824]">
      {/* Bot Header */}
      <div className="p-3 border-b border-white/10 bg-black/20 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">Bot Trợ Giảng</div>
          <div className="text-[10px] text-emerald-400 font-medium">● Online</div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.sender === 'system' ? (
              <div className="text-center mt-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-white/5 text-slate-500 rounded-full">
                  {msg.text}
                </span>
              </div>
            ) : (
              <div className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.sender === 'bot' 
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow shadow-purple-500/20' 
                    : 'bg-indigo-500 text-white'
                }`}>
                  {msg.sender === 'bot' 
                    ? <MessageSquare className="w-4 h-4" /> 
                    : (groupMembers.find(m => m.student_id === msg.studentId)?.student.display_name[0] || 'U')}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' 
                    : 'bg-white/5 text-slate-200 rounded-tl-sm border border-white/5'
                }`}>
                  {msg.text.split('\n').map((line: string, i: number) => (
                    <span key={i} className="block">{line}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {isBotTyping && (
           <div className="flex gap-3 animate-fade-in">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center shadow">
               <MessageSquare className="w-4 h-4" />
             </div>
             <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-white/5 text-slate-300 rounded-tl-sm border border-white/5 flex items-center gap-2">
               <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
               <span className="text-xs italic text-slate-400">Đang suy nghĩ...</span>
             </div>
           </div>
        )}
        
        {/* Invisible div for scroll to bottom */}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 bg-black/20 border-t border-white/5">
        <form onSubmit={handleSendMessage} className="relative group">
          <input
            type="text" 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors placeholder:text-slate-500"
            placeholder={`Hỏi bài với tư cách ${activeStudent?.student.display_name}...`}
          />
          <button 
            type="submit" 
            disabled={!chatInput.trim() || isBotTyping} 
            className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center text-white disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
          >
            <Send className="w-4 h-4 ml-[-2px]" />
          </button>
        </form>
      </div>
    </div>
  )
}
