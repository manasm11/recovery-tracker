import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { StatusBadge } from '../components/StatusBadge'
import type { CustomerStatus, DashboardStats } from '../lib/types'

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${accent}`}>{value}</p>
    </div>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [customers, setCustomers] = useState<CustomerStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/api/dashboard/stats'),
      api.get<CustomerStatus[]>('/api/customers'),
    ])
      .then(([s, c]) => {
        setStats(s.data)
        setCustomers(c.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Progress dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Overview of recovery progress across all customers.</p>
      </div>

      {stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total customers" value={stats.total_customers} accent="text-slate-900" />
          <StatCard label="Due today" value={stats.due_today} accent="text-amber-600" />
          <StatCard label="Overdue" value={stats.overdue} accent="text-red-600" />
          <StatCard label="No follow-up" value={stats.no_followup} accent="text-slate-600" />
          <StatCard
            label="Never contacted"
            value={stats.never_contacted}
            accent="text-purple-600"
          />
        </div>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">All customers</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reminders
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Last reminder
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Next date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  <Link to={`/customers/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                  <div className="text-xs text-slate-400">{c.phone}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.reminders_count}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatDate(c.last_reminder_date)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{formatDate(c.next_date)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
