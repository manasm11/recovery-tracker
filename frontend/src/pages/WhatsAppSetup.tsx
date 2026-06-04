import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

interface WaStatus {
  connected: boolean
  has_qr: boolean
}

interface PairResult {
  success: boolean
  code: string | null
  detail: string
}

export function WhatsAppSetup() {
  const [status, setStatus] = useState<WaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const prevBlobUrl = useRef<string | null>(null)

  // Pairing code state
  const [phone, setPhone] = useState('')
  const [pairCode, setPairCode] = useState<string | null>(null)
  const [pairLoading, setPairLoading] = useState(false)
  const [pairError, setPairError] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const fetchQr = useCallback(async () => {
    try {
      const res = await api.get('/api/whatsapp/qr', { responseType: 'blob' })
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current)
      const url = URL.createObjectURL(res.data as Blob)
      prevBlobUrl.current = url
      setQrDataUrl(url)
    } catch {
      setQrDataUrl(null)
    }
  }, [])

  const checkStatus = useCallback(async () => {
    try {
      const { data } = await api.get<WaStatus>('/api/whatsapp/status')
      setStatus(data)
      if (data.has_qr && !data.connected) {
        await fetchQr()
      } else {
        setQrDataUrl(null)
      }
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [fetchQr])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 3000)
    return () => {
      clearInterval(interval)
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current)
    }
  }, [checkStatus])

  async function handlePairPhone() {
    if (!phone.trim()) return
    setPairLoading(true)
    setPairError(null)
    setPairCode(null)
    try {
      const { data } = await api.post<PairResult>('/api/whatsapp/pair', { phone: phone.trim() })
      if (data.success && data.code) {
        setPairCode(data.code)
      } else {
        setPairError(data.detail || 'Failed to generate code')
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPairError(detail || 'Failed to generate pairing code')
    } finally {
      setPairLoading(false)
    }
  }

  async function handleRestart() {
    setRestarting(true)
    setPairCode(null)
    setPairError(null)
    try {
      await api.post('/api/whatsapp/restart')
    } catch {
      // ignore
    } finally {
      setTimeout(() => setRestarting(false), 3000)
    }
  }

  async function handleLogout() {
    if (!confirm('Disconnect WhatsApp? You will need to scan QR or enter a pairing code again to reconnect.')) return
    setLoggingOut(true)
    try {
      await api.post('/api/whatsapp/logout')
    } catch {
      // ignore
    } finally {
      setTimeout(() => setLoggingOut(false), 3000)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">WhatsApp Connection</h1>
      <p className="mb-6 text-sm text-slate-500">
        Connect your WhatsApp to send balance reminders directly to customers.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Checking connection…</p>
      ) : status?.connected ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-lg font-semibold text-green-800">WhatsApp Connected</p>
          <p className="mt-1 text-sm text-green-700">
            You can now send balance reminders from the customer detail page.
          </p>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {loggingOut ? 'Disconnecting…' : 'Disconnect & Connect Another Number'}
          </button>
          <p className="mt-1 text-xs text-slate-400">
            This will unlink the device and show QR/pairing options again
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Method 1: QR Code */}
          {qrDataUrl ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="mb-4 text-sm font-medium text-slate-700">
                <strong>Method 1:</strong> Scan this QR code with WhatsApp:
              </p>
              <div className="inline-block rounded-lg border border-slate-200 bg-white p-3">
                <img src={qrDataUrl} alt="WhatsApp QR Code" className="h-64 w-64" />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
              <p className="mt-1 text-xs text-slate-400">QR refreshes automatically every few seconds</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="text-sm text-amber-700">
                Waiting for WhatsApp QR code… Please wait a moment.
              </p>
            </div>
          )}

          {/* Method 2: Pairing Code */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-medium text-slate-700">
              <strong>Method 2:</strong> Link with phone number (if QR doesn't work)
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Enter your WhatsApp phone number with country code (e.g. 919876543210)
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="919876543210"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={handlePairPhone}
                disabled={pairLoading || !phone.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pairLoading ? 'Generating…' : 'Get Code'}
              </button>
            </div>

            {pairCode && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm text-green-700">Your pairing code:</p>
                <p className="mt-1 text-3xl font-bold tracking-widest text-green-900">{pairCode}</p>
                <p className="mt-2 text-xs text-green-600">
                  Open WhatsApp → Settings → Linked Devices → Link a Device → "Link with phone number instead" → Enter this code
                </p>
              </div>
            )}

            {pairError && (
              <p className="mt-3 text-sm text-red-600">{pairError}</p>
            )}
          </div>

          {/* Restart button */}
          <div className="text-center">
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {restarting ? 'Restarting…' : '🔄 Reset & Get Fresh QR'}
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Use this if QR is not scanning or pairing keeps failing
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
