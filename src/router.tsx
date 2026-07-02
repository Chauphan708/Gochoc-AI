/* ═══════════════════════════════════════
   APP ROUTER — React Router v6
   ═══════════════════════════════════════ */

import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { RootLayout } from '@/layouts/RootLayout'

// Lazy load components
const LandingPage = lazy(() => import('@/pages/LandingPage').then(module => ({ default: module.LandingPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then(module => ({ default: module.LoginPage })))
const TeacherDashboard = lazy(() => import('@/pages/teacher/TeacherDashboard').then(module => ({ default: module.TeacherDashboard })))
const CreateSession = lazy(() => import('@/pages/teacher/CreateSession').then(module => ({ default: module.CreateSession })))
const TeacherStudents = lazy(() => import('@/pages/teacher/TeacherStudents').then(module => ({ default: module.TeacherStudents })))
const StudentJoin = lazy(() => import('@/pages/student/StudentJoin').then(module => ({ default: module.StudentJoin })))
const StudentStation = lazy(() => import('@/pages/student/StudentStation').then(module => ({ default: module.StudentStation })))
const LobbyPage = lazy(() => import('@/pages/LobbyPage').then(module => ({ default: module.LobbyPage })))
const TeacherLiveControl = lazy(() => import('@/pages/teacher/TeacherLiveControl').then(module => ({ default: module.TeacherLiveControl })))
const SessionReport = lazy(() => import('@/pages/teacher/SessionReport').then(module => ({ default: module.SessionReport })))
const TeacherReports = lazy(() => import('@/pages/teacher/TeacherReports').then(module => ({ default: module.TeacherReports })))
const TeacherTemplates = lazy(() => import('@/pages/teacher/TeacherTemplates').then(module => ({ default: module.TeacherTemplates })))

// Suspense fallback
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-gray-500">Đang tải...</div>}>
    {children}
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <SuspenseWrapper><LandingPage /></SuspenseWrapper>,
      },
      {
        path: 'login',
        element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
      },
      {
        path: 'teacher',
        children: [
          {
            path: 'dashboard',
            element: <SuspenseWrapper><TeacherDashboard /></SuspenseWrapper>,
          },
          {
            path: 'create-session',
            element: <SuspenseWrapper><CreateSession /></SuspenseWrapper>,
          },
          {
            path: 'students',
            element: <SuspenseWrapper><TeacherStudents /></SuspenseWrapper>,
          },
          {
            path: 'live/:sessionId',
            element: <SuspenseWrapper><TeacherLiveControl /></SuspenseWrapper>,
          },
          {
            path: 'report/:sessionId',
            element: <SuspenseWrapper><SessionReport /></SuspenseWrapper>,
          },
          {
            path: 'reports',
            element: <SuspenseWrapper><TeacherReports /></SuspenseWrapper>,
          },
          {
            path: 'templates',
            element: <SuspenseWrapper><TeacherTemplates /></SuspenseWrapper>,
          },
        ],
      },
      {
        path: 'student',
        children: [
          {
            path: 'join',
            element: <SuspenseWrapper><StudentJoin /></SuspenseWrapper>,
          },
          {
            path: 'station/:sessionId/:stationId',
            element: <SuspenseWrapper><StudentStation /></SuspenseWrapper>,
          },
        ],
      },
      {
        path: 'lobby/:sessionId',
        element: <SuspenseWrapper><LobbyPage /></SuspenseWrapper>,
      },
    ],
  },
])
