import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

interface ImportedCustomerInfo {
  name: string
  amount: number
}

interface ImportResult {
  imported: number
  duplicates: number
  credit_skipped: number
  total_parsed: number
  names_imported: ImportedCustomerInfo[]
  names_skipped_credit: ImportedCustomerInfo[]
  names_skipped_duplicate: ImportedCustomerInfo[]
}

export function ImportCustomers() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) {
      setError('Please paste the ledger text.')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const { data } = await api.post<ImportResult>('/api/customers/import', { text })
      setResult(data)
    } catch {
      setError('Import failed. Please check the format and try again.')
    } finally {
      setLoading(false)
    }
  }

  function formatAmount(n: number) {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Import Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Paste your ledger report below. Only customers with <strong>DEBIT</strong> balance
            will be imported. Duplicates are skipped automatically.
          </p>
        </div>
        <Link
          to="/customers"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back to Customers
        </Link>
      </div>

      {!result && (
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            placeholder="Paste ledger text here…"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Importing…' : 'Import Customers'}
            </button>
          </div>
        </form>
      )}

      {result && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Total parsed" value={result.total_parsed} color="slate" />
            <SummaryCard label="Imported" value={result.imported} color="green" />
            <SummaryCard label="Duplicates skipped" value={result.duplicates} color="amber" />
            <SummaryCard label="Credit skipped" value={result.credit_skipped} color="red" />
          </div>

          {/* Imported list */}
          {result.names_imported.length > 0 && (
            <CollapsibleSection
              title={`Imported (${result.names_imported.length})`}
              items={result.names_imported}
              badgeColor="bg-green-100 text-green-700"
              formatAmount={formatAmount}
              defaultOpen
            />
          )}

          {/* Duplicates */}
          {result.names_skipped_duplicate.length > 0 && (
            <CollapsibleSection
              title={`Duplicates skipped (${result.names_skipped_duplicate.length})`}
              items={result.names_skipped_duplicate}
              badgeColor="bg-amber-100 text-amber-700"
              formatAmount={formatAmount}
            />
          )}

          {/* Credit entries */}
          {result.names_skipped_credit.length > 0 && (
            <CollapsibleSection
              title={`Credit entries skipped (${result.names_skipped_credit.length})`}
              items={result.names_skipped_credit}
              badgeColor="bg-red-100 text-red-700"
              formatAmount={formatAmount}
            />
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setResult(null)
                setText('')
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Import more
            </button>
            <Link
              to="/customers"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              View Customers
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'slate' | 'green' | 'amber' | 'red'
}) {
  const colorMap = {
    slate: 'bg-slate-50 text-slate-900',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function CollapsibleSection({
  title,
  items,
  badgeColor,
  formatAmount,
  defaultOpen = false,
}: {
  title: string
  items: ImportedCustomerInfo[]
  badgeColor: string
  formatAmount: (n: number) => string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="text-xs text-slate-400">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-5 py-2 text-sm text-slate-800">{item.name}</td>
                  <td className="px-5 py-2 text-right text-sm text-slate-600">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                      ₹{formatAmount(item.amount)}
                    </span>
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
