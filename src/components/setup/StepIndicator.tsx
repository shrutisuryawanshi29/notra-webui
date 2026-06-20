import { ReactNode } from 'react'

interface StepIndicatorProps {
  steps: string[]
  currentStep: string
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const currentIdx = steps.indexOf(currentStep)

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const isActive = i === currentIdx
        const isPast = i < currentIdx
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[#C99152] text-white'
                  : isPast
                  ? 'bg-[#8CA37D] text-white'
                  : 'bg-[#40342B] text-[#9B8778]'
              }`}
            >
              {isPast ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs hidden sm:inline ${
                isActive ? 'text-[#C99152] font-medium' : isPast ? 'text-[#9B8778]' : 'text-[#9B8778]'
              }`}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px ${isPast ? 'bg-[#8CA37D]' : 'bg-[#4C4036]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
