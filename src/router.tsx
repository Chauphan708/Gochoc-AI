/* ═══════════════════════════════════════
   APP ROUTER — React Router v6
   ═══════════════════════════════════════ */

import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { TeacherDashboard } from '@/pages/teacher/TeacherDashboard'
import { CreateSession } from '@/pages/teacher/CreateSession'
import { TeacherStudents } from '@/pages/teacher/TeacherStudents'
import { StudentJoin } from '@/pages/student/StudentJoin'
import { StudentStation } from '@/pages/student/StudentStation'
import { LobbyPage } from '@/pages/LobbyPage'
import { TeacherLiveControl } from '@/pages/teacher/TeacherLiveControl'
import { SessionReport } from '@/pages/teacher/SessionReport'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'teacher',
        children: [
          {
            path: 'dashboard',
            element: <TeacherDashboard />,
          },
          {
            path: 'create-session',
            element: <CreateSession />,
          },
          {
            path: 'students',
            element: <TeacherStudents />,
          },
          {
            path: 'live/:sessionId',
            element: <TeacherLiveControl />,
          },
          {
            path: 'report/:sessionId',
            element: <SessionReport />,
          },
        ],
      },
      {
        path: 'student',
        children: [
          {
            path: 'join',
            element: <StudentJoin />,
          },
          {
            path: 'station/:sessionId/:stationId',
            element: <StudentStation />,
          },
        ],
      },
      {
        path: 'lobby/:sessionId',
        element: <LobbyPage />,
      },
    ],
  },
])
