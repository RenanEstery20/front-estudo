export type CashEntryType = 'IN' | 'OUT'
export type CashPaymentMethod = 'CASH' | 'PIX' | 'CARD'

export type CashEntry = {
  id: string
  type: CashEntryType
  amount: number
  description: string
  category?: string
  paymentMethod?: CashPaymentMethod
  createdAt: string
}

export type CreateCashEntryDto = {
  type: CashEntryType
  paymentMethod: CashPaymentMethod
  amount: number
  description: string
  category?: string
  entryDate?: string
}

export type DailyCashSummary = {
  date: string
  totalIn: number
  totalOut: number
  balance: number
  countIn: number
  countOut: number
  totalEntries: number
}
