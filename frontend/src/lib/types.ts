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
  deleted_at: string | null
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  created_at: string
  deleted_at: string | null
  balance: number | null
}

export interface CustomerStatus extends Customer {
  last_reminder_date: string | null
  next_date: string | null
  last_notes: string | null
  reminders_count: number
  status: CustomerStatusValue
}

export interface Contact {
  id: number
  customer_id: number
  contact_name: string
  phone: string
  created_at: string
  deleted_at: string | null
}

export interface CustomerWithReminders extends Customer {
  contacts: Contact[]
  reminders: Reminder[]
}

export interface DeletedCustomer {
  id: number
  name: string
  phone: string
  created_at: string
  deleted_at: string
  balance: number | null
  days_until_purge: number
}

export interface DashboardStats {
  total_customers: number
  due_today: number
  overdue: number
  never_contacted: number
  no_followup: number
}

export interface DailyCount {
  date: string
  count: number
}

export interface MyActivity {
  calls_today: number
  daily_counts: DailyCount[]
}
