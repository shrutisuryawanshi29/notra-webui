import { SplitPerson } from '@/types/transaction'

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

export function calculateHHSSplit(
  input: ManualSplitInput,
  extra: HHSSplitExtra
): ManualSplitResult {
  const count = input.selectedPeople.length
  const baseShare = input.paidAmount / (1 + count)
  let myShare: number
  let theyOwe: number

  if (extra.entryMode === 'iPayExtra') {
    myShare = baseShare + extra.extraAmount
    theyOwe = input.paidAmount - myShare
  } else {
    theyOwe = baseShare + extra.extraAmount
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
      extraAmount: extra.extraAmount,
      baseShare,
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
