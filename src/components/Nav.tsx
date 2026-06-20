'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  BarChart3,
  Users,
  Settings,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/income', label: 'Income', icon: TrendingUp },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/split-tracker', label: 'Split Tracker', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()

  if (pathname.startsWith('/setup')) return null

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 bg-[#362D25] border-r border-[#4C4036] h-screen sticky top-0">
        <div className="p-5 border-b border-[#4C4036]">
          <h1 className="text-[#EDE1D1] text-2xl font-bold tracking-tight">
            Notra
          </h1>
          <p className="text-[#9B8778] text-xs mt-1">Finance Tracker</p>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#40342B] text-[#F4E9DA] border-r-2 border-[#C99152]'
                    : 'text-[#9B8778] hover:text-[#CBB9A7] hover:bg-[#332A23]'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#362D25] border-t border-[#4C4036] z-50">
        <div className="flex justify-around items-center h-14">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] transition-colors ${
                  isActive ? 'text-[#C99152]' : 'text-[#9B8778]'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <Link
        href="/settings"
        className="md:hidden fixed bottom-16 right-4 z-50 bg-[#C99152] text-white p-3 rounded-full shadow-lg"
      >
        <Settings size={20} />
      </Link>
    </>
  )
}
