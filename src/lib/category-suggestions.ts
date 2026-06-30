import { NormalizedTransaction } from '@/types/transaction'
import { extractCategoryName } from './notion-properties'

interface SuggestionEntry {
  name: string
  id?: string
  count: number
}

interface MerchantCategory {
  suggestion: SuggestionEntry
  count: number
}

const NOISE_WORDS = new Set([
  'store', 'order', 'purchase', 'transaction', 'inc', 'llc', 'com', 'ltd', 'corp',
  'online', 'website', 'payment', 'charge', 'bill', 'receipt', 'invoice', 'ref',
  'delivery', 'shipping', 'service', 'fee', 'tax', 'tip',
])

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '')
    .replace(/\d+/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !NOISE_WORDS.has(w))
    .join(' ')
    .trim()
}

enum MatchStrength {
  None = 0,
  Weak = 1,
  Strong = 2,
  Exact = 3,
}

function matchStrength(input: string, merchant: string): MatchStrength {
  if (input === merchant) return MatchStrength.Exact
  const inputFirst = input.split(' ')[0]
  const merchantFirst = merchant.split(' ')[0]
  if (inputFirst === merchantFirst) return MatchStrength.Strong
  if (merchant.includes(input) || input.includes(merchant)) return MatchStrength.Weak
  return MatchStrength.None
}

function getBestStrength(input: string, merchant: string): MatchStrength {
  let best = matchStrength(input, merchant)
  if (best === MatchStrength.Exact) return best
  const merchantWords = merchant.split(' ')
  for (const word of merchantWords) {
    if (word.length < 3) continue
    const s = matchStrength(input, word)
    if (s > best) best = s
  }
  return best
}

export function buildMerchantMap(
  transactions: NormalizedTransaction[],
  categoryColumnName?: string | null,
  relationLookup?: Record<string, string> | null
): Map<string, MerchantCategory[]> {
  const map = new Map<string, Map<string, MerchantCategory>>()

  for (const t of transactions) {
    const normalized = normalizeTitle(t.title)
    if (!normalized) continue

    let categoryName: string | null = t.category
    if (!categoryName && categoryColumnName && t.rawProperties) {
      const prop = t.rawProperties[categoryColumnName]
      if (prop) {
        categoryName = extractCategoryName(prop, relationLookup ?? undefined)
      }
    }
    if (!categoryName) continue

    let merchantMap = map.get(normalized)
    if (!merchantMap) {
      merchantMap = new Map()
      map.set(normalized, merchantMap)
    }

    const existing = merchantMap.get(categoryName)
    if (existing) {
      existing.count++
    } else {
      merchantMap.set(categoryName, {
        suggestion: { name: categoryName, count: 1 },
        count: 1,
      })
    }
  }

  const result = new Map<string, MerchantCategory[]>()
  for (const [normalized, catMap] of map) {
    result.set(normalized, Array.from(catMap.values()))
  }
  return result
}

export function getCategorySuggestions(
  title: string,
  merchantMap: Map<string, MerchantCategory[]>,
  maxResults = 3
): SuggestionEntry[] {
  const normalized = normalizeTitle(title)
  if (!normalized || normalized.length < 3) return []

  const candidates: Array<{ entry: MerchantCategory; strength: MatchStrength }> = []

  for (const [merchant, categories] of merchantMap) {
    const strength = getBestStrength(normalized, merchant)
    if (strength === MatchStrength.None) continue

    for (const cat of categories) {
      candidates.push({ entry: cat, strength })
    }
  }

  if (candidates.length === 0) return []

  const bestStrength = candidates.reduce((max, c) => Math.max(max, c.strength), MatchStrength.None)
  const minStrength = candidates.length === 1 && bestStrength >= MatchStrength.Strong
    ? MatchStrength.Strong
    : MatchStrength.Weak

  const totalCandidates = candidates.reduce((sum, c) => sum + c.entry.count, 0)

  const grouped = new Map<string, { name: string; id?: string; count: number; bestStrength: MatchStrength }>()
  for (const { entry, strength } of candidates) {
    if (strength < minStrength) continue
    const existing = grouped.get(entry.suggestion.name)
    if (existing) {
      existing.count += entry.count
      if (strength > existing.bestStrength) existing.bestStrength = strength
    } else {
      grouped.set(entry.suggestion.name, {
        name: entry.suggestion.name,
        id: entry.suggestion.id,
        count: entry.count,
        bestStrength: strength,
      })
    }
  }

  const results = Array.from(grouped.values())
    .map(item => ({
      name: item.name,
      id: item.id,
      count: item.count,
      confidence: totalCandidates > 0 ? item.count / totalCandidates : 0,
    }))
    .filter(item => item.confidence >= 0.5)
    .sort((a, b) => {
      const sa = grouped.get(a.name)?.bestStrength ?? 0
      const sb = grouped.get(b.name)?.bestStrength ?? 0
      if (sb !== sa) return sb - sa
      if (b.count !== a.count) return b.count - a.count
      return b.confidence - a.confidence
    })
    .slice(0, maxResults)

  return results
}
