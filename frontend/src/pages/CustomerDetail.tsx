import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate, todayISO } from '../lib/format'
import type { CustomerWithReminders, Reminder } from '../lib/types'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<CustomerWithReminders | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [reminderDate, setReminderDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await api.get<CustomerWithReminders>(`/api/customers/${id}`)
      setCustomer(data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let active = true
    api
      .get<CustomerWithReminders>(`/api/customers/${id}`)
      .then((res) => {
        if (active) setCustomer(res.data)
      })
      .catch(() => {
        if (active) setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  async function handleAddReminder(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!reminderDate) {
      setError('Reminder date is required.')
      return
    }
    setSaving(true)
    try {
      await api.post(`/api/customers/${id}/reminders`, {
        reminder_date: reminderDate,
        notes: notes.trim(),
        next_date: nextDate || null,
      })
      setNotes('')
      setNextDate('')
      setReminderDate(todayISO())
      await load()
    } catch {
      setError('Could not save the reminder. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(reminder: Reminder) {
    if (!confirm('Delete this reminder entry?')) return
    await api.delete(`/api/customers/${id}/reminders/${reminder.id}`)
    await load()
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>
  if (notFound || !customer)
    return (
      <div>
        <p className="text-sm text-slate-600">Customer not found.</p>
        <Link to="/customers" className="text-sm font-medium text-slate-900 underline">
          Back to customers
        </Link>
      </div>
    )

  return (
    <div>
      <Link to="/customers" className="text-sm text-slate-500 hover:underline">
        ← Back to customers
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{customer.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{customer.phone}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Log a reminder call</h2>
            <p className="mt-1 text-sm text-slate-500">
              Record today's call and the next date the customer promised.
            </p>
            <form onSubmit={handleAddReminder} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Reminder date
                </label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  What the customer said
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Promised to pay half by next Monday"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Next promised date
                </label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save reminder'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Reminder history ({customer.reminders.length})
          </h2>
          {customer.reminders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No reminders logged yet. Add the first one using the form.
            </div>
          ) : (
            <ol className="space-y-3">
              {customer.reminders.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Called on {formatDate(r.reminder_date)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Next promised:{' '}
                        <span className="font-medium text-slate-700">
                          {formatDate(r.next_date)}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(r)}
                      className="text-xs font-medium text-slate-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                  {r.notes && (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                      {r.notes}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
