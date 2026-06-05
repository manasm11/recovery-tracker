import { format, parseISO } from 'date-fns'

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

/** Convert a UTC ISO timestamp to IST (UTC+5:30) and format it. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const isoStr = value.endsWith('Z') || value.includes('+') ? value : value + 'Z'
    const utc = parseISO(isoStr)
    const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000)
    return format(ist, 'dd MMM yyyy, hh:mm a')
  } catch {
    return value
  }
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
