import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import type { CustomerStatus, CustomerStatusValue } from '../lib/types'

const STATUS_FILTERS: { value: CustomerStatusValue | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_today', label: 'Due today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'no_followup', label: 'No follow-up' },
  { value: 'never_contacted', label: 'Never contacted' },
]

export function Customers() {
  const { user: authUser } = useAuth()
  const [items, setItems] = useState<CustomerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<CustomerStatusValue | ''>('')

  async function load(searchValue = '', status: CustomerStatusValue | '' = statusFilter) {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (searchValue) params.search = searchValue
      if (status) params.status = status
      const { data } = await api.get<CustomerStatus[]>('/api/customers', { params })
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api
      .get<CustomerStatus[]>('/api/customers')
      .then((res) => {
        if (active) setItems(res.data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/customers', { name: name.trim(), phone: phone.trim() })
      setName('')
      setPhone('')
      setShowForm(false)
      await load(search)
    } catch {
      setError('Could not add customer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? You can restore them from the Deleted page.`)) return
    setDeleting(id)
    try {
      await api.delete(`/api/customers/${id}`)
      await load(search)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">All customers under recovery.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/customers/deleted"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Deleted
          </Link>
          <Link
            to="/import"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Import from Ledger
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showForm ? 'Close' : '+ Add customer'}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                placeholder="Phone number"
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save customer'}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            load(e.target.value)
          }}
          placeholder="Search by name or phone…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatusFilter(f.value)
                load(search, f.value)
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-medium text-slate-700">No customers yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add your first customer to start tracking recovery reminders.
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
                  Last reminder
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Next date
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
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    <Link to={`/customers/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                    {c.monopoly_flag && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700" title="Ask for order">
                        Order
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(c.last_reminder_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(c.next_date)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {authUser?.role === 'admin' && (
                        <button
                          onClick={async () => {
                            await api.patch(`/api/customers/${c.id}/monopoly-flag`)
                            await load(search)
                          }}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            c.monopoly_flag
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title={c.monopoly_flag ? 'Remove order flag' : 'Flag for order'}
                        >
                          {c.monopoly_flag ? '✓ Order' : '+ Order'}
                        </button>
                      )}
                      <Link
                        to={`/customers/${c.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deleting === c.id}
                        className="text-sm font-medium text-slate-400 hover:text-red-600 disabled:opacity-60"
                      >
                        {deleting === c.id ? '…' : 'Delete'}
                      </button>
                    </div>
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
