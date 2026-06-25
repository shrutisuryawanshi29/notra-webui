'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  BarChart3,
  Users,
  Settings,
  Plus,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/income', label: 'Income', icon: TrendingUp },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/split-tracker', label: 'Split Tracker', icon: Users },
]

export default function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (pathname.startsWith('/setup')) return null

  return (
    <>
      {/* Desktop top navigation */}
      <header className="hidden md:flex h-14 bg-[#1F1712] border-b border-[#4A372C] items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-[#F4EDE3] text-lg font-bold tracking-tight shrink-0">
            Notra
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D49A4A] ${
                    isActive
                      ? 'bg-[#3A2A22] text-[#F4EDE3] font-medium shadow-[inset_0_-2px_0_#D49A4A]'
                      : 'text-[#B8A99A] hover:text-[#F4EDE3] hover:bg-[#3A2A22]/50'
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/add?role=expense"
            className="flex items-center gap-1.5 bg-[#D49A4A] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#C1883A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EDE3]"
          >
            <Plus size={16} />
            Add
          </Link>
          <Link
            href="/settings"
            className="text-[#9B8778] hover:text-[#D49A4A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D49A4A] rounded"
          >
            <Settings size={18} />
          </Link>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden h-14 bg-[#1F1712] border-b border-[#4A372C] flex items-center justify-between px-4 sticky top-0 z-50">
        <Link href="/dashboard" className="text-[#F4EDE3] text-lg font-bold tracking-tight">
          Notra
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/add?role=expense"
            className="bg-[#D49A4A] text-white p-2 rounded-lg hover:bg-[#C1883A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EDE3]"
          >
            <Plus size={18} />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-[#B8A99A] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D49A4A] rounded"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-[#1F1712] z-40 border-t border-[#4A372C]">
          <nav className="flex flex-col p-4 gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D49A4A] ${
                    isActive
                      ? 'bg-[#3A2A22] text-[#F4EDE3] font-medium shadow-[inset_0_-2px_0_#D49A4A]'
                      : 'text-[#B8A99A] hover:text-[#F4EDE3] hover:bg-[#3A2A22]/50'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              )
            })}
            <hr className="border-[#4A372C] my-2" />
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-[#9B8778] hover:text-[#D49A4A] hover:bg-[#3A2A22]/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D49A4A]"
            >
              <Settings size={18} />
              Settings
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
