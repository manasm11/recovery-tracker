import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { StatusBadge } from '../components/StatusBadge'
import type { CustomerStatus, MyActivity } from '../lib/types'

function ActivityCard({ activity }: { activity: MyActivity }) {
  const maxCount = Math.max(...activity.daily_counts.map((d) => d.count), 1)
  const today = activity.daily_counts[activity.daily_counts.length - 1]
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Calls made today</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{activity.calls_today}</p>
        </div>
        {activity.calls_today >= 10 && (
          <span className="text-3xl" title="Great job!">🔥</span>
        )}
        {activity.calls_today >= 5 && activity.calls_today < 10 && (
          <span className="text-3xl" title="Keep going!">💪</span>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Last 30 days
        </p>
        <div className="flex items-end gap-[3px]" style={{ height: 64 }}>
          {activity.daily_counts.map((d) => {
            const h = d.count > 0 ? Math.max((d.count / maxCount) * 56, 4) : 2
            const dayDate = new Date(d.date + 'T00:00:00')
            const dayName = weekDays[dayDate.getDay()]
            const isToday = d.date === today?.date
            return (
              <div
                key={d.date}
                className="group relative flex-1"
                style={{ height: 64 }}
              >
                <div
                  className={`absolute bottom-0 w-full rounded-sm ${
                    isToday
                      ? 'bg-emerald-500'
                      : d.count > 0
                        ? 'bg-slate-300'
                        : 'bg-slate-100'
                  }`}
                  style={{ height: h }}
                />
                <div className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white group-hover:block">
                  {dayName} · {d.count} call{d.count !== 1 ? 's' : ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Today() {
  const [items, setItems] = useState<CustomerStatus[]>([])
  const [activity, setActivity] = useState<MyActivity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<CustomerStatus[]>('/api/dashboard/today'),
      api.get<MyActivity>('/api/dashboard/my-activity'),
    ])
      .then(([todayRes, actRes]) => {
        setItems(todayRes.data)
        setActivity(actRes.data)
      })
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
      ) : (
        <>
          {activity && <ActivityCard activity={activity} />}

          {items.length === 0 ? (
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
        </>
      )}
    </div>
  )
}
