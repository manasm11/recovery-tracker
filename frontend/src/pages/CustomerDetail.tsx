import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate, formatDateTime, todayISO } from '../lib/format'
import type { Contact, CustomerWithReminders, Reminder } from '../lib/types'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerWithReminders | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [reminderDate, setReminderDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  // Contact editing state
  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [editContactName, setEditContactName] = useState('')
  const [editContactPhone, setEditContactPhone] = useState('')

  // Deleted items state
  const [deletedReminders, setDeletedReminders] = useState<Reminder[]>([])
  const [deletedContacts, setDeletedContacts] = useState<Contact[]>([])
  const [showDeletedReminders, setShowDeletedReminders] = useState(false)
  const [showDeletedContacts, setShowDeletedContacts] = useState(false)

  // WhatsApp reminder modal state
  const [waModalContact, setWaModalContact] = useState<Contact | null>(null)
  const [waMessage, setWaMessage] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waResult, setWaResult] = useState<{ success: boolean; detail: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await api.get<CustomerWithReminders>(`/api/customers/${id}`)
      setCustomer(data)
      const [delRem, delCon] = await Promise.all([
        api.get<Reminder[]>(`/api/customers/${id}/reminders/deleted`),
        api.get<Contact[]>(`/api/customers/${id}/contacts/deleted`),
      ])
      setDeletedReminders(delRem.data)
      setDeletedContacts(delCon.data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

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

  async function handleDeleteReminder(reminder: Reminder) {
    if (!confirm('Delete this reminder entry? You can restore it later.')) return
    await api.delete(`/api/customers/${id}/reminders/${reminder.id}`)
    await load()
  }

  async function handleRestoreReminder(reminder: Reminder) {
    await api.post(`/api/customers/${id}/reminders/${reminder.id}/restore`)
    await load()
  }

  async function handleAddContact(e: FormEvent) {
    e.preventDefault()
    setContactError(null)
    if (!contactPhone.trim()) {
      setContactError('Phone number is required.')
      return
    }
    setContactSaving(true)
    try {
      await api.post(`/api/customers/${id}/contacts`, {
        contact_name: contactName.trim(),
        phone: contactPhone.trim(),
      })
      setContactName('')
      setContactPhone('')
      setShowContactForm(false)
      await load()
    } catch {
      setContactError('Could not add contact. Please try again.')
    } finally {
      setContactSaving(false)
    }
  }

  function startEditContact(contact: Contact) {
    setEditingContactId(contact.id)
    setEditContactName(contact.contact_name)
    setEditContactPhone(contact.phone)
  }

  async function handleSaveEditContact(contactId: number) {
    if (!editContactPhone.trim()) return
    try {
      await api.patch(`/api/customers/${id}/contacts/${contactId}`, {
        contact_name: editContactName.trim(),
        phone: editContactPhone.trim(),
      })
      setEditingContactId(null)
      await load()
    } catch {
      // silently fail
    }
  }

  async function handleDeleteContact(contact: Contact) {
    if (!confirm(`Delete contact ${contact.contact_name || contact.phone}? You can restore it later.`)) return
    await api.delete(`/api/customers/${id}/contacts/${contact.id}`)
    await load()
  }

  async function handleRestoreContact(contact: Contact) {
    await api.post(`/api/customers/${id}/contacts/${contact.id}/restore`)
    await load()
  }

  function openWaModal(contact: Contact) {
    const balance = customer?.balance != null ? customer.balance.toFixed(2) : '0.00'
    setWaMessage(`Please confirm your outstanding balance is Rs. ${balance}`)
    setWaModalContact(contact)
    setWaResult(null)
  }

  async function handleSendWhatsApp() {
    if (!waModalContact) return
    setWaSending(true)
    setWaResult(null)
    try {
      const { data } = await api.post<{ success: boolean; detail: string }>('/api/whatsapp/send', {
        phone: waModalContact.phone,
        message: waMessage,
      })
      setWaResult(data)
      if (data.success) {
        setTimeout(() => setWaModalContact(null), 1500)
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to send'
      setWaResult({ success: false, detail })
    } finally {
      setWaSending(false)
    }
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
          {customer.phone && (
            <p className="mt-1 text-sm text-slate-500">{customer.phone}</p>
          )}
          {customer.balance != null && customer.balance > 0 && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Balance: &#8377; {customer.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <button
          onClick={async () => {
            if (!confirm(`Delete "${customer.name}"? You can restore them from the Deleted page.`)) return
            await api.delete(`/api/customers/${id}`)
            navigate('/customers')
          }}
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete customer
        </button>
      </div>

      {/* Contacts Section */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Contacts ({customer.contacts?.length || 0})
          </h2>
          <button
            onClick={() => setShowContactForm((v) => !v)}
            className="text-sm font-medium text-slate-900 hover:underline"
          >
            {showContactForm ? 'Cancel' : '+ Add contact'}
          </button>
        </div>

        {showContactForm && (
          <form onSubmit={handleAddContact} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Contact name
                </label>
                <input
                  value={contactName}
                  autoFocus
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. Owner, Manager"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Phone number *
                </label>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  placeholder="Phone number"
                />
              </div>
            </div>
            {contactError && <p className="text-sm text-red-600">{contactError}</p>}
            <button
              type="submit"
              disabled={contactSaving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {contactSaving ? 'Saving…' : 'Save contact'}
            </button>
          </form>
        )}

        {(!customer.contacts || customer.contacts.length === 0) && !showContactForm ? (
          <p className="mt-3 text-sm text-slate-500">
            No contacts added yet. Click "+ Add contact" to add phone numbers.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {customer.contacts?.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5"
              >
                {editingContactId === c.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      value={editContactName}
                      onChange={(e) => setEditContactName(e.target.value)}
                      className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                      placeholder="Name"
                    />
                    <input
                      value={editContactPhone}
                      onChange={(e) => setEditContactPhone(e.target.value)}
                      className="w-36 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                      placeholder="Phone"
                    />
                    <button
                      onClick={() => handleSaveEditContact(c.id)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingContactId(null)}
                      className="text-xs font-medium text-slate-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-sm font-medium text-slate-900">
                        {c.phone}
                      </span>
                      {c.contact_name && (
                        <span className="ml-2 text-sm text-slate-500">
                          ({c.contact_name})
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <a
                        href={`tel:${c.phone}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Call
                      </a>
                      <button
                        onClick={() => openWaModal(c)}
                        className="text-xs font-medium text-green-600 hover:underline"
                      >
                        Send Reminder
                      </button>
                      <button
                        onClick={() => startEditContact(c)}
                        className="text-xs font-medium text-slate-500 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteContact(c)}
                        className="text-xs font-medium text-slate-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {deletedContacts.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowDeletedContacts((v) => !v)}
              className="text-sm font-medium text-slate-500 hover:underline"
            >
              {showDeletedContacts ? 'Hide' : 'Show'} deleted contacts ({deletedContacts.length})
            </button>
            {showDeletedContacts && (
              <div className="mt-2 space-y-2">
                {deletedContacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-2.5"
                  >
                    <div>
                      <span className="text-sm font-medium text-slate-500 line-through">
                        {c.phone}
                      </span>
                      {c.contact_name && (
                        <span className="ml-2 text-sm text-slate-400">({c.contact_name})</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRestoreContact(c)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          at {formatDateTime(r.created_at).split(', ')[1]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Next promised:{' '}
                        <span className="font-medium text-slate-700">
                          {formatDate(r.next_date)}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteReminder(r)}
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

          {deletedReminders.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowDeletedReminders((v) => !v)}
                className="text-sm font-medium text-slate-500 hover:underline"
              >
                {showDeletedReminders ? 'Hide' : 'Show'} deleted reminders ({deletedReminders.length})
              </button>
              {showDeletedReminders && (
                <ol className="mt-2 space-y-3">
                  {deletedReminders.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-red-100 bg-red-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-500 line-through">
                            Called on {formatDate(r.reminder_date)}
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              at {formatDateTime(r.created_at).split(', ')[1]}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Next promised:{' '}
                            <span className="font-medium">{formatDate(r.next_date)}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestoreReminder(r)}
                          className="text-xs font-medium text-green-700 hover:underline"
                        >
                          Restore
                        </button>
                      </div>
                      {r.notes && (
                        <p className="mt-2 whitespace-pre-wrap rounded-md bg-white/60 p-3 text-sm text-slate-500">
                          {r.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Send Reminder Modal */}
      {waModalContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Send WhatsApp Reminder</h3>
            <p className="mt-1 text-sm text-slate-500">
              To: {waModalContact.phone}
              {waModalContact.contact_name && ` (${waModalContact.contact_name})`}
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
              <textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
            {waResult && (
              <p className={`mt-2 text-sm ${waResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {waResult.detail}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setWaModalContact(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={waSending || !waMessage.trim()}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {waSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
