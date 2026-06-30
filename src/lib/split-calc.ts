import { SplitPerson, SplitItem } from '@/types/transaction'

export interface ManualSplitInput {
  paidAmount: number
  selectedPeople: SplitPerson[]
}

export interface ManualSplitResult {
  myShare: number
  theyOwe: number
  participants: Array<{ id: string; name: string; owes: number }>
  inputs: Record<string, unknown>
}

export type SplitMethodType = 'equal' | 'percent' | 'exact' | 'hhs'

export function calculateEqualSplit(input: ManualSplitInput): ManualSplitResult {
  const count = input.selectedPeople.length
  const eachShare = input.paidAmount / (1 + count)
  const myShare = eachShare
  const theyOwe = input.paidAmount - myShare
  const perPerson = count > 0 ? theyOwe / count : 0

  return {
    myShare,
    theyOwe,
    participants: input.selectedPeople.map(p => ({
      id: p.id,
      name: p.name,
      owes: perPerson,
    })),
    inputs: {},
  }
}

export interface PercentSplitExtra {
  entryMode: 'myPercent' | 'theirPercent'
  myPercent: number
  theirPercent: number
}

export function calculatePercentSplit(
  input: ManualSplitInput,
  extra: PercentSplitExtra
): ManualSplitResult {
  const count = input.selectedPeople.length
  let myShare: number
  let theyOwe: number

  if (extra.entryMode === 'myPercent') {
    myShare = input.paidAmount * extra.myPercent / 100
    theyOwe = input.paidAmount - myShare
  } else {
    theyOwe = input.paidAmount * extra.theirPercent / 100
    myShare = input.paidAmount - theyOwe
  }

  const perPerson = count > 0 ? theyOwe / count : 0

  return {
    myShare,
    theyOwe,
    participants: input.selectedPeople.map(p => ({
      id: p.id,
      name: p.name,
      owes: perPerson,
    })),
    inputs: {
      entryMode: extra.entryMode,
      myPercent: extra.myPercent,
      theirPercent: extra.theirPercent,
    },
  }
}

export interface ExactSplitExtra {
  entryMode: 'theyOwe' | 'myShare'
  customAmount: number
}

export function calculateExactSplit(
  input: ManualSplitInput,
  extra: ExactSplitExtra
): ManualSplitResult {
  const count = input.selectedPeople.length
  let myShare: number
  let theyOwe: number

  if (extra.entryMode === 'theyOwe') {
    myShare = input.paidAmount - extra.customAmount
    theyOwe = extra.customAmount
  } else {
    theyOwe = input.paidAmount - extra.customAmount
    myShare = extra.customAmount
  }

  const perPerson = count > 0 ? theyOwe / count : 0

  return {
    myShare,
    theyOwe,
    participants: input.selectedPeople.map(p => ({
      id: p.id,
      name: p.name,
      owes: perPerson,
    })),
    inputs: {
      entryMode: extra.entryMode,
      customAmount: extra.customAmount,
    },
  }
}

export interface HHSSplitExtra {
  entryMode: 'iPayExtra' | 'extraTheyPay'
  extraAmount: number
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export function calculateHHSSplit(
  input: ManualSplitInput,
  extra: HHSSplitExtra
): ManualSplitResult {
  const count = input.selectedPeople.length
  const totalPeople = 1 + count
  let myShare: number
  let theyOwe: number

  if (extra.entryMode === 'iPayExtra') {
    const otherShare = (input.paidAmount - extra.extraAmount) / totalPeople
    myShare = round2(otherShare + extra.extraAmount)
    theyOwe = round2(input.paidAmount - myShare)
  } else {
    myShare = round2((input.paidAmount - extra.extraAmount * count) / totalPeople)
    theyOwe = round2(input.paidAmount - myShare)
  }

  const perPerson = count > 0 ? round2(theyOwe / count) : 0

  return {
    myShare,
    theyOwe,
    participants: input.selectedPeople.map(p => ({
      id: p.id,
      name: p.name,
      owes: perPerson,
    })),
    inputs: {
      entryMode: extra.entryMode,
      extraAmount: extra.extraAmount,
    },
  }
}

export function calculateSplit(
  method: SplitMethodType,
  input: ManualSplitInput,
  extra: Record<string, unknown>
): ManualSplitResult {
  switch (method) {
    case 'equal':
      return calculateEqualSplit(input)
    case 'percent':
      return calculatePercentSplit(input, extra as unknown as PercentSplitExtra)
    case 'exact':
      return calculateExactSplit(input, extra as unknown as ExactSplitExtra)
    case 'hhs':
      return calculateHHSSplit(input, extra as unknown as HHSSplitExtra)
  }
}

export function inferMethodFromType(type: string): SplitMethodType {
  switch (type) {
    case 'equal':
    case 'manualEqual':
    case 'splitEqually':
      return 'equal'
    case 'percent':
    case 'manualPercent':
      return 'percent'
    case 'exact':
    case 'manualCustom':
    case 'exactAmounts':
    case 'Custom Amount':
      return 'exact'
    case 'hhs':
    case 'adjust':
    case 'manualHHS':
    case 'shares':
      return 'hhs'
    default:
      return 'equal'
  }
}

export function calculateReceiptSplit(
  items: SplitItem[],
  paidAmount: number,
  people: SplitPerson[]
): ManualSplitResult {
  let myShare = 0
  const participantOwes: Record<string, number> = {}
  for (const p of people) {
    participantOwes[p.id] = 0
  }

  for (const item of items) {
    switch (item.assignment) {
      case 'mine':
        myShare += item.price
        break
      case 'person': {
        const personId = item.sharedWith[0]
        if (personId && participantOwes[personId] !== undefined) {
          participantOwes[personId] += item.price
        }
        break
      }
      case 'shared':
      case 'everyone': {
        const shareWith = item.assignment === 'everyone'
          ? people.map(p => p.id)
          : item.sharedWith.length > 0
            ? item.sharedWith.filter(id => people.some(p => p.id === id))
            : people.map(p => p.id)
        const each = item.price / (1 + shareWith.length)
        myShare += each
        for (const id of shareWith) {
          if (participantOwes[id] !== undefined) {
            participantOwes[id] += each
          }
        }
        break
      }
      case 'ignore':
        break
    }
  }

  myShare = round2(myShare)
  const theyOwe = round2(Math.max(0, paidAmount - myShare))
  const participants = people.map(p => ({
    id: p.id,
    name: p.name,
    owes: round2(participantOwes[p.id] || 0),
  }))

  return { myShare, theyOwe, participants, inputs: {} }
}

export function legacyTypeToMethod(type: string): string {
  switch (type) {
    case 'half':
    case '50/50':
    case 'Split Equally':
    case 'manualEqual':
    case 'splitEqually':
    case 'equal':
      return 'manualEqual'
    case 'manualPercent':
    case 'percent':
      return 'manualPercent'
    case 'manualCustom':
    case 'exactAmounts':
    case 'Custom Amount':
    case 'exact':
      return 'manualCustom'
    case 'manualHHS':
    case 'adjust':
    case 'hhs':
    case 'shares':
      return 'manualHHS'
    default:
      return 'manualEqual'
  }
}
