import { ReactNode } from 'react'

export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#2B241E] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-[#EDE1D1] text-3xl font-bold tracking-tight">Notra</h1>
          <p className="text-[#9B8778] text-xs mt-1">Finance Tracker</p>
        </div>
        {children}
      </div>
    </div>
  )
}
