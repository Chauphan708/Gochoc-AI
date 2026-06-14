/* ═══════════════════════════════════════
   LANDING PAGE — GócHọc AI
   Trang giới thiệu premium, hiện đại
   ═══════════════════════════════════════ */

import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Users,
  Brain,
  Wifi,
  WifiOff,
  ArrowRight,
  BookOpen,
  Gamepad2,
  Shield,
  BarChart3,
  Zap,
  GraduationCap,
} from 'lucide-react'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 py-4 px-6">
        <div className="glass-card-static mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-transparent">
              GócHọc AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="btn-login"
              onClick={() => navigate('/login')}
              className="btn btn-ghost btn-sm"
            >
              Đăng nhập
            </button>
            <button
              id="btn-hero-start"
              onClick={() => navigate('/login')}
              className="btn btn-primary btn-sm"
            >
              Bắt đầu
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 badge badge-primary mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nền tảng AI cho giáo dục Việt Nam</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            <span className="text-white">Biến mỗi bài học</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              thành trải nghiệm theo góc
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI Bot trợ giảng tại mỗi góc học. Quản lý lớp thông minh.
            Chấm điểm cá nhân ngay cả khi học sinh dùng chung thiết bị.
            <span className="text-emerald-400 font-medium"> Hoàn toàn miễn phí.</span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              id="btn-cta-teacher"
              onClick={() => navigate('/login')}
              className="btn btn-primary btn-lg w-full sm:w-auto"
            >
              <BookOpen className="w-5 h-5" />
              Tôi là Giáo viên
            </button>
            <button
              id="btn-cta-student"
              onClick={() => navigate('/student/join')}
              className="btn btn-accent btn-lg w-full sm:w-auto"
            >
              <Users className="w-5 h-5" />
              Tôi là Học sinh
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Free tier</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Gemini 2.0 Flash</span>
            </div>
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-indigo-400" />
              <span>Offline-first</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3 text-white">
            Mọi thứ GV cần, trong một nền tảng
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Từ tạo phiên học, quản lý nhóm, đến AI chấm bài — GócHọc AI lo tất cả.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`glass-card p-6 animate-fade-in stagger-${i + 1}`}
                style={{ opacity: 0, animationDelay: `${i * 0.1}s` }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: feature.gradient }}
                >
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <span>GócHọc AI © 2026</span>
          </div>
          <p>Dự án mã nguồn mở • Dạy học theo góc & Trò chơi lớn</p>
        </div>
      </footer>
    </div>
  )
}

// ── Feature data ──
const features = [
  {
    icon: Brain,
    title: 'AI Bot Trợ Giảng',
    description:
      'Mỗi góc có 1 AI Bot riêng, tùy chỉnh tính cách và kiến thức. Bot hướng dẫn, giải đáp và chấm bài tự động.',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  {
    icon: Users,
    title: 'Quick Switch — Chung Thiết Bị',
    description:
      'Nhiều HS dùng chung 1 máy. Chuyển người bằng 1 chạm — không cần đăng nhập lại. Điểm tính riêng từng người.',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
  },
  {
    icon: BarChart3,
    title: '3 Chế Độ Chấm Điểm',
    description:
      'Cá nhân, Nhóm chia đều, hoặc Nhóm trưởng gắn tag. GV chọn phù hợp với từng nhiệm vụ.',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
  },
  {
    icon: Wifi,
    title: 'Offline-First',
    description:
      'Hoạt động bình thường khi mất mạng. Dữ liệu tự đồng bộ khi có WiFi trở lại.',
    gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
  },
  {
    icon: Gamepad2,
    title: 'Trò Chơi Lớn',
    description:
      'Mở rộng ra ngoài trời với mật thư, QR check-in và các trạm trò chơi lớn tương tác.',
    gradient: 'linear-gradient(135deg, #14b8a6, #0e7490)',
  },
  {
    icon: Shield,
    title: 'Đồng GV & Dự Giờ',
    description:
      'Mời đồng giảng viên cùng quản lý. GV dự giờ chỉ xem, không can thiệp lớp học.',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  },
]
