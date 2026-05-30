import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { StatusBadge } from '../components/StatusBadge'
import type { CustomerStatus } from '../lib/types'

export function Today() {
  const [items, setItems] = useState<CustomerStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<CustomerStatus[]>('/api/dashboard/today')
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Reminders for today</h1>
        <p className="mt-1 text-sm text-slate-500">
          Customers you need to call today, plus anyone overdue from earlier.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-medium text-slate-700">All caught up! 🎉</p>
          <p className="mt-1 text-sm text-slate-500">
            No reminders are due today. Check the{' '}
            <Link to="/customers" className="font-medium text-slate-900 underline">
              customers
            </Link>{' '}
            list to add follow-ups.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Follow-up date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last note
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.phone}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(c.next_date)}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-500">
                    {c.last_notes || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/customers/${c.id}`}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Log call
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
