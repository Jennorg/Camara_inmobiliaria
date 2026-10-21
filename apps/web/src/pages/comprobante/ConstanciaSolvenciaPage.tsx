import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import QRCode from 'qrcode'
import { Loader2, Printer, ShieldCheck, ShieldAlert } from 'lucide-react'
import { API_URL } from '@/config/env'
import { formatDateLatina } from '@/utils/formatters'

interface Constancia {
  codigo_validacion: string
  emitida_en: string
  valida_hasta: string
  codigo_afiliado: string | null
  tipo_afiliado: string | null
  titular: string
  identificacion: string
  vigente: boolean
}

/**
 * Constancia de solvencia: es a la vez el documento (se imprime o guarda como PDF desde el navegador)
 * y su verificación pública por código. El QR apunta a esta misma página.
 */
export default function ConstanciaSolvenciaPage() {
  const { codigo = '' } = useParams<{ codigo: string }>()
  const [data, setData] = useState<Constancia | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState('')
  const url = `${window.location.origin}/constancia-solvencia/${encodeURIComponent(codigo)}`

  useEffect(() => {
    let activo = true
    fetch(`${API_URL}/api/public/constancias-solvencia/${encodeURIComponent(codigo)}`)
      .then(r => r.json())
      .then(j => {
        if (!activo) return
        if (j.success) setData(j.data)
        else setError(j.message || 'Constancia no encontrada')
      })
      .catch(() => { if (activo) setError('No se pudo consultar la constancia') })
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(d => { if (activo) setQr(d) }).catch(() => {})
    return () => { activo = false }
  }, [codigo, url])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md text-center space-y-2">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-500" aria-hidden="true" />
          <h1 className="text-lg font-black text-slate-900">Constancia no válida</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </main>
    )
  }
  if (!data) {
    return <main className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-label="Cargando" /></main>
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 print:bg-white print:p-0">
      <Helmet><title>Constancia de Solvencia {data.codigo_validacion}</title></Helmet>
      <div className="mx-auto max-w-[680px] mb-4 flex justify-end print:hidden">
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider">
          <Printer size={14} aria-hidden="true" /> Imprimir / Guardar PDF
        </button>
      </div>

      <article className="mx-auto max-w-[680px] rounded-2xl border-2 border-emerald-200/80 bg-white p-8 sm:p-10 shadow-sm print:shadow-none print:border-slate-300">
        <header className="flex flex-col items-center text-center gap-2 border-b border-slate-100 pb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Cámara Inmobiliaria del Estado Bolívar</p>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 text-balance">Constancia de Solvencia</h1>
          {data.vigente ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <ShieldCheck size={12} aria-hidden="true" /> Vigente
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Vencida
            </span>
          )}
        </header>

        <p className="mt-8 text-sm leading-relaxed text-slate-700 text-pretty">
          Se hace constar que <strong className="text-slate-900">{data.titular}</strong>, identificado(a) con el documento
          N° <span className="font-mono">{data.identificacion}</span>, miembro {data.tipo_afiliado ? `${data.tipo_afiliado.toLowerCase()} ` : ''}
          N° <strong>{data.codigo_afiliado ?? '—'}</strong> de esta Cámara, se encuentra <strong>solvente</strong> con sus
          cuotas gremiales a la fecha de emisión.
        </p>

        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Código</dt>
            <dd className="mt-1 font-mono font-bold text-emerald-800">{data.codigo_validacion}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Emitida</dt>
            <dd className="mt-1 font-medium text-slate-800">{formatDateLatina(data.emitida_en)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Válida hasta</dt>
            <dd className="mt-1 font-medium text-slate-800">{formatDateLatina(`${data.valida_hasta}T12:00:00`)}</dd>
          </div>
        </dl>

        <div className="mt-8 flex items-center gap-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
          {qr && <img src={qr} alt="Código QR de verificación" width={96} height={96} className="shrink-0" />}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verificación pública</p>
            <p className="mt-1 break-all text-xs font-medium text-emerald-700">{url}</p>
            <p className="mt-1 text-[11px] text-slate-500">Escanea el código o visita el enlace para comprobar su autenticidad y vigencia.</p>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-slate-400">Documento emitido electrónicamente · No requiere firma autógrafa</p>
      </article>
    </main>
  )
}
