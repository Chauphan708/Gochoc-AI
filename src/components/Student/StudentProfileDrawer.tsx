import { X, Award, Flame, Star, Shield, Trophy } from 'lucide-react'

interface StudentProfileDrawerProps {
  isOpen: boolean
  onClose: () => void
  student: any
}

export function StudentProfileDrawer({ isOpen, onClose, student }: StudentProfileDrawerProps) {
  if (!isOpen || !student) return null

  // Calculate Level based on XP
  const level = Math.floor(student.total_xp / 100) + 1
  const xpForNextLevel = level * 100
  const progressPercent = ((student.total_xp % 100) / 100) * 100

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-dvh w-full md:w-96 bg-[#161824] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start relative overflow-hidden">
           {/* Decor */}
           <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
           <div className="relative z-10 flex gap-4 items-center w-full">
             <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center text-2xl font-bold backdrop-blur-sm shrink-0 shadow-lg">
                {student.display_name[0]}
             </div>
             <div className="flex-1 min-w-0">
               <h2 className="text-xl font-bold truncate">{student.display_name}</h2>
               <div className="text-sm text-indigo-100 opacity-90 truncate">Học sinh cấp {level}</div>
             </div>
             <button onClick={onClose} className="p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors shrink-0">
               <X className="w-5 h-5" />
             </button>
           </div>
        </div>

        {/* Level & XP Box */}
        <div className="px-6 py-4 -mt-6 relative z-20">
          <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-4 shadow-xl">
             <div className="flex justify-between items-center mb-2">
               <span className="font-bold text-amber-400 flex items-center gap-1.5"><Star className="w-4 h-4 fill-amber-400" /> Cấp {level}</span>
               <span className="text-xs text-slate-400 font-mono">{student.total_xp} / {xpForNextLevel} XP</span>
             </div>
             {/* Progress Bar */}
             <div className="w-full bg-black/30 rounded-full h-2 mb-1 overflow-hidden">
               <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
             </div>
             <div className="text-[10px] text-slate-500 text-center">Còn {xpForNextLevel - student.total_xp} XP nữa để lên cấp</div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="px-6 py-2 grid grid-cols-2 gap-4">
          <div className="bg-[#1A1C23] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-slate-200">{student.total_points}</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Điểm Rèn Luyện</div>
          </div>
          
          <div className="bg-[#1A1C23] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-slate-200">{student.streak_days || 0}</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Ngày Luyện Tập</div>
          </div>
        </div>

        {/* Badges Section */}
        <div className="p-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Award className="w-4 h-4" /> Bảng Thành Tích Khập Khiễng
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {/* Hardcoded Sample Badges for Demo */}
            <div className="bg-[#1A1C23] border border-white/5 rounded-xl p-3 flex flex-col items-center text-center gap-2">
              <Shield className="w-8 h-8 text-amber-300 fill-amber-300/20" />
              <span className="text-[10px] text-slate-300 font-bold leading-tight">Mầm Non Trạm</span>
            </div>
            {student.total_points > 100 && (
              <div className="bg-[#1A1C23] border border-amber-500/20 rounded-xl p-3 flex flex-col items-center text-center gap-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10" />
                <Award className="w-8 h-8 text-orange-400" />
                <span className="text-[10px] text-slate-300 font-bold leading-tight relative">Hiểu Biết Sâu Rộng</span>
              </div>
            )}
            {student.total_xp >= 50 && (
               <div className="bg-[#1A1C23] border border-pink-500/20 rounded-xl p-3 flex flex-col items-center text-center gap-2 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-500/10" />
                 <Star className="w-8 h-8 text-pink-400 fill-pink-400/20" />
                 <span className="text-[10px] text-slate-300 font-bold leading-tight relative">Ngôi Sao Sáng</span>
               </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
