export type Role = 'employee' | 'admin'

export interface User {
  id: number
  username: string
  role: Role
}

export type CustomerStatusValue =
  | 'due_today'
  | 'overdue'
  | 'upcoming'
  | 'no_followup'
  | 'never_contacted'

export interface Reminder {
  id: number
  customer_id: number
  reminder_date: string
  notes: string
  next_date: string | null
  created_at: string
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  created_at: string
}

export interface CustomerStatus extends Customer {
  last_reminder_date: string | null
  next_date: string | null
  last_notes: string | null
  reminders_count: number
  status: CustomerStatusValue
}

export interface CustomerWithReminders extends Customer {
  reminders: Reminder[]
}

export interface DashboardStats {
  total_customers: number
  due_today: number
  overdue: number
  never_contacted: number
  no_followup: number
}
