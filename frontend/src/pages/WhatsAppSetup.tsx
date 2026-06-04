import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

interface WaStatus {
  connected: boolean
  has_qr: boolean
}

export function WhatsAppSetup() {
  const [status, setStatus] = useState<WaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const prevBlobUrl = useRef<string | null>(null)

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
        </div>
      ) : qrDataUrl ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="mb-4 text-sm font-medium text-slate-700">
            Scan this QR code with WhatsApp on your phone:
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
    </div>
  )
}
