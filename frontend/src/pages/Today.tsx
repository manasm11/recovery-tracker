import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import type { CallDetail, CustomerStatus, MyActivity, User } from '../lib/types'

function ActivityCard({
  activity,
  selectedDate,
  onSelectDate,
  label,
}: {
  activity: MyActivity
  selectedDate: string | null
  onSelectDate: (date: string) => void
  label: string
}) {
  const maxCount = Math.max(...activity.daily_counts.map((d) => d.count), 1)
  const todayEntry = activity.daily_counts[activity.daily_counts.length - 1]
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
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
          Last 30 days — click a bar to see details
        </p>
        <div className="flex items-end gap-[3px]" style={{ height: 64 }}>
          {activity.daily_counts.map((d) => {
            const h = d.count > 0 ? Math.max((d.count / maxCount) * 56, 4) : 2
            const dayDate = new Date(d.date + 'T00:00:00')
            const dayName = weekDays[dayDate.getDay()]
            const isToday = d.date === todayEntry?.date
            const isSelected = d.date === selectedDate
            return (
              <div
                key={d.date}
                className="group relative flex-1 cursor-pointer"
                style={{ height: 64 }}
                onClick={() => onSelectDate(d.date)}
              >
                <div
                  className={`absolute bottom-0 w-full rounded-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-500'
                      : isToday
                        ? 'bg-emerald-500'
                        : d.count > 0
                          ? 'bg-slate-300 hover:bg-slate-400'
                          : 'bg-slate-100 hover:bg-slate-200'
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

function CallDetailsList({
  date,
  calls,
  loading,
  onClose,
}: {
  date: string
  calls: CallDetail[]
  loading: boolean
  onClose: () => void
}) {
  const formatted = formatDate(date)
  return (
    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Calls on {formatted} ({calls.length})
        </h3>
        <button
          onClick={onClose}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : calls.length === 0 ? (
        <p className="text-sm text-slate-500">No calls on this day.</p>
      ) : (
        <ul className="space-y-2">
          {calls.map((c, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
              <div className="flex-1">
                <Link
                  to={`/customers/${c.customer_id}`}
                  className="text-sm font-medium text-slate-900 hover:underline"
                >
                  {c.customer_name}
                </Link>
                {c.notes && (
                  <p className="mt-0.5 text-xs text-slate-500">{c.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Today() {
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [items, setItems] = useState<CustomerStatus[]>([])
  const [activity, setActivity] = useState<MyActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [callDetails, setCallDetails] = useState<CallDetail[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  const [users, setUsers] = useState<User[]>([])
  const [viewingUserId, setViewingUserId] = useState<number | null>(null)

  useEffect(() => {
    const promises: Promise<unknown>[] = [
      api.get<CustomerStatus[]>('/api/dashboard/today').then((res) => setItems(res.data)),
      api.get<MyActivity>('/api/dashboard/my-activity').then((res) => setActivity(res.data)),
    ]
    if (isAdmin) {
      promises.push(
        api.get<User[]>('/api/dashboard/users').then((res) => setUsers(res.data)),
      )
    }
    Promise.all(promises).finally(() => setLoading(false))
  }, [isAdmin])

  function loadActivity(userId: number | null) {
    setActivity(null)
    setSelectedDate(null)
    setCallDetails([])
    const params = userId ? { user_id: userId } : {}
    api
      .get<MyActivity>('/api/dashboard/my-activity', { params })
      .then((res) => setActivity(res.data))
  }

  function handleUserChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const uid = val === '' ? null : Number(val)
    setViewingUserId(uid)
    loadActivity(uid)
  }

  function handleSelectDate(date: string) {
    if (selectedDate === date) {
      setSelectedDate(null)
      setCallDetails([])
      return
    }
    setSelectedDate(date)
    setDetailsLoading(true)
    const params: Record<string, string | number> = { target_date: date }
    if (viewingUserId) params.user_id = viewingUserId
    api
      .get<CallDetail[]>('/api/dashboard/calls-on-date', { params })
      .then((res) => setCallDetails(res.data))
      .finally(() => setDetailsLoading(false))
  }

  const viewingUserName = viewingUserId
    ? users.find((u) => u.id === viewingUserId)?.username
    : null
  const activityLabel = viewingUserName
    ? `Calls made today by ${viewingUserName}`
    : 'Calls made today'

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
          {isAdmin && users.length > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm font-medium text-slate-600">View activity for:</label>
              <select
                value={viewingUserId ?? ''}
                onChange={handleUserChange}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">My activity</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activity && (
            <ActivityCard
              activity={activity}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              label={activityLabel}
            />
          )}

          {selectedDate && (
            <CallDetailsList
              date={selectedDate}
              calls={callDetails}
              loading={detailsLoading}
              onClose={() => { setSelectedDate(null); setCallDetails([]) }}
            />
          )}

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
                          className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
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
