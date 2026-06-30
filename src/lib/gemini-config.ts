export const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite'

export const GEMINI_AVAILABLE_MODELS: { displayName: string; modelID: string }[] = [
  { displayName: 'Gemini 2.0 Flash', modelID: 'gemini-2.0-flash' },
  { displayName: 'Gemini 3.1 Flash Lite', modelID: 'gemini-3.1-flash-lite' },
  { displayName: 'Gemini 3.5 Flash', modelID: 'gemini-3.5-flash' },
]

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export function geminiGenerateContentURL(model: string, apiKey: string): string {
  return `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`
}

export function getStoredGeminiModel(): string {
  if (typeof window === 'undefined') return GEMINI_DEFAULT_MODEL
  try {
    return localStorage.getItem('notra-gemini-model') || GEMINI_DEFAULT_MODEL
  } catch {
    return GEMINI_DEFAULT_MODEL
  }
}

export function saveStoredGeminiModel(model: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('notra-gemini-model', model)
  } catch { /* noop */ }
}
