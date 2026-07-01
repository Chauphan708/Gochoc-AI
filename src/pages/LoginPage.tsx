/* ═══════════════════════════════════════
   LOGIN PAGE — GócHọc AI
   Đăng nhập cho GV (Supabase Auth)
   ═══════════════════════════════════════ */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  GraduationCap,
  Mail,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react'
import { UserPlus } from 'lucide-react'
import { loginTeacher, registerTeacher } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

const authSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: z.string().optional(),
})

type AuthForm = z.infer<typeof authSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { setUser } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
  })

  const onSubmit = async (data: AuthForm) => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      if (isSignUp) {
        if (data.password !== data.confirmPassword) {
          setErrorMessage('Mật khẩu nhập lại không khớp')
          setIsLoading(false)
          return
        }
        const fullName = data.email.split('@')[0]
        const teacher = await registerTeacher(data.email, data.password, fullName)
        setUser(teacher, 'teacher')
      } else {
        const teacher = await loginTeacher(data.email, data.password)
        setUser(teacher, 'teacher')
      }
      navigate('/teacher/dashboard')
    } catch (error: any) {
      setErrorMessage(error.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-scale-in">
        {/* Back button */}
        <button
          id="btn-back-home"
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Trang chủ
        </button>

        {/* Card */}
        <div className="glass-card-static p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" id="login-title">
              {isSignUp ? 'Tạo tài khoản GV' : 'Đăng nhập GV'}
            </h1>
            <p className="text-sm text-slate-400">
              {isSignUp
                ? 'Tạo tài khoản để bắt đầu dạy học theo góc'
                : 'Đăng nhập để quản lý phiên dạy học'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="input-email"
                  type="email"
                  className={`input !pl-10 ${errors.email ? 'input-error' : ''}`}
                  placeholder="giaovien@school.edu.vn"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`input !pl-10 !pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password (Sign Up only) */}
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nhập lại mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="input-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    className="input !pl-10 !pr-10"
                    placeholder="••••••••"
                    {...register('confirmPassword')}
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {errorMessage}
              </div>
            )}

            {/* Submit button */}
            <button
              id="btn-submit-login"
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  Đăng ký
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          {/* Toggle sign up / sign in */}
          <div className="mt-6 text-center text-sm text-slate-400">
            {isSignUp ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
            <button
              id="btn-toggle-signup"
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-1 text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {isSignUp ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </div>
        </div>

        {/* Student link */}
        <div className="mt-6 text-center">
          <button
            id="btn-student-join"
            onClick={() => navigate('/student/join')}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Học sinh? Nhập mã phiên để tham gia →
          </button>
        </div>
      </div>
    </div>
  )
}
