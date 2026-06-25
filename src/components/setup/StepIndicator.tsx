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
                  ? 'bg-[#D49A4A] text-white'
                  : isPast
                  ? 'bg-[#93B889] text-white'
                  : 'bg-[#FBF8F4] text-[#6F6A73]'
              }`}
            >
              {isPast ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs hidden sm:inline ${
                isActive ? 'text-[#D49A4A] font-medium' : isPast ? 'text-[#6F6A73]' : 'text-[#6F6A73]'
              }`}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px ${isPast ? 'bg-[#93B889]' : 'bg-[#5A4638]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
