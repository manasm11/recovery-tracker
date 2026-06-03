import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import type { DeletedCustomer } from '../lib/types'

export function DeletedCustomers() {
  const [items, setItems] = useState<DeletedCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<DeletedCustomer[]>('/api/customers/deleted')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRestore(id: number) {
    setRestoring(id)
    try {
      await api.post(`/api/customers/${id}/restore`)
      await load()
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Deleted Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Soft-deleted customers. They will be permanently removed after 365 days.
          </p>
        </div>
        <Link
          to="/customers"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back to Customers
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-medium text-slate-700">No deleted customers</p>
          <p className="mt-1 text-sm text-slate-500">
            When you delete a customer, they'll appear here for recovery.
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
                  Balance
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Deleted on
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Days until purge
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {c.balance != null ? `₹${c.balance.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(c.deleted_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <span
                      className={
                        c.days_until_purge < 30
                          ? 'font-medium text-red-600'
                          : 'text-slate-600'
                      }
                    >
                      {c.days_until_purge} days
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRestore(c.id)}
                      disabled={restoring === c.id}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {restoring === c.id ? 'Restoring…' : 'Restore'}
                    </button>
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
