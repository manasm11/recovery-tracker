import { format, parseISO } from 'date-fns'

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy, hh:mm a')
  } catch {
    return value
  }
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
