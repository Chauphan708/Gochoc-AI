/* ═══════════════════════════════════════
   ROOT LAYOUT
   ═══════════════════════════════════════ */

import { Outlet } from 'react-router-dom'

export function RootLayout() {
  return (
    <>
      {/* Animated gradient background */}
      <div className="gradient-bg" />

      {/* Main content */}
      <main className="relative min-h-dvh">
        <Outlet />
      </main>
    </>
  )
}
