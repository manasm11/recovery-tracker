import type { CustomerStatusValue } from '../lib/types'

const CONFIG: Record<CustomerStatusValue, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700 ring-red-600/20' },
  due_today: { label: 'Due today', className: 'bg-amber-100 text-amber-800 ring-amber-600/20' },
  upcoming: { label: 'Upcoming', className: 'bg-blue-100 text-blue-700 ring-blue-600/20' },
  no_followup: {
    label: 'No follow-up set',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  },
  never_contacted: {
    label: 'Never contacted',
    className: 'bg-purple-100 text-purple-700 ring-purple-600/20',
  },
}

export function StatusBadge({ status }: { status: CustomerStatusValue }) {
  const cfg = CONFIG[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}
