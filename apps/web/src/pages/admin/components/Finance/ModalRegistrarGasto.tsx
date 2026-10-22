import React, { useState, useEffect } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { X, Check, DollarSign, FileText, UploadCloud, AlertCircle, Calculator, Loader2 } from 'lucide-react'
import FileUpload from '@/components/common/FileUpload'
import { toast } from 'sonner'
import type { TxType, TxCategory } from '@/types/finanzas'

interface ModalRegistrarGastoProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIAS_GASTO: { id: TxCategory; label: string }[] = [
  { id: 'alquiler',           label: 'Alquiler de Sede' },
  { id: 'servicios_publicos', label: 'Servicios Públicos (Luz, Agua, Internet, Teléfono)' },
  { id: 'nomina',             label: 'Nómina Administrativa' },
  { id: 'honorarios',         label: 'Honorarios Profesionales (Contabilidad, Legal, Asesoría)' },
  { id: 'papeleria',          label: 'Papelería, Tóner y Suministros de Oficina' },
  { id: 'mantenimiento',      label: 'Mantenimiento e Infraestructura' },
  { id: 'impuestos',          label: 'Impuestos, Tasas Municipales y Aranceles' },
  { id: 'gasto_operativo',    label: 'Gasto Operativo General' },
  { id: 'gasto_admin',        label: 'Gasto Administrativo / Logística' },
  { id: 'donacion',           label: 'Aporte / Donación' },
  { id: 'otro',               label: 'Otro Gasto' }
]

const CATEGORIAS_INGRESO: { id: TxCategory; label: string }[] = [
  { id: 'afiliacion', label: 'Cuota Afiliación' },
  { id: 'curso',      label: 'Curso / Taller Académico' },
  { id: 'convenio',   label: 'Convenio Institucional' },
  { id: 'servicio',   label: 'Servicios / Asesoría Gremial' },
  { id: 'donacion',   label: 'Donación Recibida' },
  { id: 'otro',       label: 'Otro Ingreso' }
]

interface MetodoConfig {
  label: string
  /** Moneda en que siempre se opera con este método; si falta, se elige */
  moneda?: 'USD' | 'VES'
  referencia?: { label: string; placeholder: string; requerida?: boolean }
  /** Texto de la cuenta/banco según el sentido de la operación */
  banco?: { egreso: string; ingreso: string; placeholder: string }
}

/** Datos que tiene sentido pedir según cómo se pagó: el efectivo no tiene referencia ni banco. */
const METODOS: Record<string, MetodoConfig> = {
  transferencia: {
    label: 'Transferencia bancaria',
    referencia: { label: 'Nº de referencia', placeholder: 'Ej. 991204', requerida: true },
    banco: { egreso: 'Banco desde el que se pagó', ingreso: 'Banco del pagador', placeholder: 'Ej. Banesco' },
  },
  pago_movil: {
    label: 'Pago móvil',
    moneda: 'VES',
    referencia: { label: 'Nº de referencia', placeholder: 'Ej. 440192', requerida: true },
    banco: { egreso: 'Banco desde el que se pagó', ingreso: 'Banco del pagador', placeholder: 'Ej. Mercantil' },
  },
  efectivo_usd: { label: 'Efectivo USD ($)', moneda: 'USD' },
  efectivo_bs: { label: 'Efectivo bolívares (Bs.)', moneda: 'VES' },
  zelle: {
    label: 'Zelle',
    moneda: 'USD',
    referencia: { label: 'Nº de confirmación', placeholder: 'Ej. BAC123456789', requerida: true },
    banco: { egreso: 'Correo o titular al que se envió', ingreso: 'Correo o titular de origen', placeholder: 'Ej. pagos@proveedor.com' },
  },
  binance_usdt: {
    label: 'Binance (USDT)',
    moneda: 'USD',
    referencia: { label: 'Order ID / hash', placeholder: 'Ej. 3029485716', requerida: true },
    banco: { egreso: 'Binance Pay ID o correo de destino', ingreso: 'Binance Pay ID o correo de origen', placeholder: 'Ej. 123456789' },
  },
  cheque: {
    label: 'Cheque',
    referencia: { label: 'Nº de cheque', placeholder: 'Ej. 00001234', requerida: true },
    banco: { egreso: 'Banco emisor', ingreso: 'Banco del cheque', placeholder: 'Ej. Provincial' },
  },
  otro: {
    label: 'Otro',
    referencia: { label: 'Referencia (opcional)', placeholder: 'Ej. nota o código interno' },
  },
}

export default function ModalRegistrarGasto({ isOpen, onClose, onSuccess }: ModalRegistrarGastoProps) {
  const { authHeaders } = useAuth()
  const [loading, setLoading] = useState(false)

  const [tipo, setTipo] = useState<TxType>('egreso')
  const [categoria, setCategoria] = useState<TxCategory>('alquiler')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [proveedorCliente, setProveedorCliente] = useState('')
  const [rifCedula, setRifCedula] = useState('')
  const [nroFactura, setNroFactura] = useState('')
  const [concepto, setConcepto] = useState('')
  
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD')
  const [tasaBcv, setTasaBcv] = useState('875.65')
  
  // Cargar tasa activa de referencia al abrir
  useEffect(() => {
    if (!isOpen) return
    fetch(`${API_URL}/api/public/tasas-referencia`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.tasas?.USD_BCV?.tasa) {
          setTasaBcv(String(json.data.tasas.USD_BCV.tasa))
        }
      })
      .catch(() => {})
  }, [isOpen])

  // Monto de la operación
  const [montoTotal, setMontoTotal] = useState('')

  const [metodoPago, setMetodoPago] = useState('transferencia')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [bancoOrigen, setBancoOrigen] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState('')
  const [notas, setNotas] = useState('')

  // Ajustar categoría predeterminada al cambiar tipo
  useEffect(() => {
    if (tipo === 'egreso') {
      setCategoria('alquiler')
    } else {
      setCategoria('convenio')
    }
  }, [tipo])

  const metodo = METODOS[metodoPago]

  const cambiarMetodo = (nuevo: string) => {
    const cfg = METODOS[nuevo]
    setMetodoPago(nuevo)
    if (cfg.moneda) setMoneda(cfg.moneda)
    if (!cfg.referencia) setReferenciaPago('')
    if (!cfg.banco) setBancoOrigen('')
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!proveedorCliente.trim()) {
      toast.error(tipo === 'egreso' ? 'Ingrese el nombre o razón social del proveedor' : 'Ingrese el cliente o pagador')
      return
    }
    if (!concepto.trim()) {
      toast.error('Ingrese una descripción o concepto del movimiento')
      return
    }
    if (metodo.referencia?.requerida && !referenciaPago.trim()) {
      toast.error(`Ingrese ${metodo.referencia.label.toLowerCase()}`)
      return
    }
    const totalNum = parseFloat(montoTotal) || 0
    if (totalNum <= 0) {
      toast.error('El monto total debe ser mayor a 0')
      return
    }

    try {
      setLoading(true)

      const payload = {
        tipo,
        categoria,
        fecha,
        proveedor_cliente: proveedorCliente.trim(),
        rif_cedula: rifCedula.trim() || null,
        nro_factura_documento: nroFactura.trim() || null,
        concepto: concepto.trim(),
        monto_total: totalNum,
        moneda: metodo.moneda ?? moneda,
        tasa_bcv: parseFloat(tasaBcv) || 1,
        metodo_pago: metodoPago,
        referencia_pago: metodo.referencia ? referenciaPago.trim() || null : null,
        banco_origen: metodo.banco ? bancoOrigen.trim() || null : null,
        comprobante_url: comprobanteUrl || null,
        estatus: 'completado',
        notas: notas.trim() || null
      }

      const res = await fetch(`${API_URL}/api/finanzas/movimientos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el movimiento')
      }

      toast.success(tipo === 'egreso' ? 'Gasto registrado en el Libro de Compras' : 'Ingreso registrado en el Libro de Ventas')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al registrar movimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {tipo === 'egreso' ? 'Registrar Compra / Gasto Operativo' : 'Registrar Ingreso Extraordinario'}
              </h3>
              <p className="text-xs text-emerald-200/80">
                {tipo === 'egreso' ? 'Libro de Compras · Control de Gastos' : 'Libro de Ventas · Flujo de Caja'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-slate-700">
          {/* Selector de Tipo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tipo de Operación Contable
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('egreso')}
                aria-pressed={tipo === 'egreso'}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  tipo === 'egreso'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Egreso / Compra (Libro de Compras)
              </button>
              <button
                type="button"
                onClick={() => setTipo('ingreso')}
                aria-pressed={tipo === 'ingreso'}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  tipo === 'ingreso'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Ingreso Extraordinario (Libro de Ventas)
              </button>
            </div>
          </div>

          {/* Proveedor / RIF / Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {tipo === 'egreso' ? 'Proveedor / Razón Social *' : 'Cliente / Pagador *'}
              </label>
              <input
                type="text"
                required
                value={proveedorCliente}
                onChange={e => setProveedorCliente(e.target.value)}
                placeholder={tipo === 'egreso' ? 'Ej. Inmobiliaria Centro C.A.' : 'Ej. Empresa Aliada S.A.'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                RIF / C.I.
              </label>
              <input
                type="text"
                value={rifCedula}
                onChange={e => setRifCedula(e.target.value.toUpperCase())}
                placeholder="Ej. J-12345678-9"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase"
              />
            </div>
          </div>

          {/* Factura / Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Nro. Factura / Doc.
              </label>
              <input
                type="text"
                value={nroFactura}
                onChange={e => setNroFactura(e.target.value)}
                placeholder="Ej. FAC-00892"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Fecha de Emisión *
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Categoría y Concepto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Categoría Contable *
              </label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value as TxCategory)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
              >
                {(tipo === 'egreso' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO).map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Concepto / Descripción Detallada *
              </label>
              <input
                type="text"
                required
                value={concepto}
                onChange={e => setConcepto(e.target.value)}
                placeholder="Ej. Alquiler de la sede gremial correspondiente a Marzo"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Monto y moneda */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Tasa BCV:</span>
              <span className="text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                Bs. {parseFloat(tasaBcv || '1').toFixed(2)}
              </span>
              <label htmlFor="gasto-moneda" className="text-xs font-semibold text-slate-500 ml-2">Moneda:</label>
              <select
                id="gasto-moneda"
                value={metodo.moneda ?? moneda}
                onChange={e => setMoneda(e.target.value as any)}
                disabled={!!metodo.moneda}
                title={metodo.moneda ? `${metodo.label} se registra siempre en ${metodo.moneda === 'USD' ? 'dólares' : 'bolívares'}` : undefined}
                className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                <option value="USD">USD ($)</option>
                <option value="VES">VES (Bs.)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="gasto-monto" className="text-xs font-bold text-slate-800">Monto total:</label>
              <span className="text-sm font-black text-slate-400">{(metodo.moneda ?? moneda) === 'USD' ? '$' : 'Bs.'}</span>
              <input
                id="gasto-monto"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={montoTotal}
                onChange={e => setMontoTotal(e.target.value)}
                placeholder="0.00"
                className="w-32 px-3 py-1 rounded-lg border border-emerald-300 text-base font-black text-emerald-800 bg-white text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          {/* Método de pago: los datos que se piden dependen de él */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="gasto-metodo" className="block text-[11px] font-bold text-slate-600 mb-1">
                Método de pago
              </label>
              <select
                id="gasto-metodo"
                value={metodoPago}
                onChange={e => cambiarMetodo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
              >
                {Object.entries(METODOS).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
              </select>
            </div>
            {metodo.referencia && (
              <div>
                <label htmlFor="gasto-referencia" className="block text-[11px] font-bold text-slate-600 mb-1">
                  {metodo.referencia.label}{metodo.referencia.requerida && ' *'}
                </label>
                <input
                  id="gasto-referencia"
                  type="text"
                  value={referenciaPago}
                  onChange={e => setReferenciaPago(e.target.value)}
                  placeholder={metodo.referencia.placeholder}
                  required={metodo.referencia.requerida}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
                />
              </div>
            )}
            {metodo.banco && (
              <div>
                <label htmlFor="gasto-banco" className="block text-[11px] font-bold text-slate-600 mb-1">
                  {tipo === 'egreso' ? metodo.banco.egreso : metodo.banco.ingreso}
                </label>
                <input
                  id="gasto-banco"
                  type="text"
                  value={bancoOrigen}
                  onChange={e => setBancoOrigen(e.target.value)}
                  placeholder={metodo.banco.placeholder}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            )}
          </div>

          {/* Adjuntar Factura / Comprobante */}
          <div>
            <FileUpload
              label="Comprobante o Factura Digital (PDF o Imagen)"
              onUploadSuccess={(url) => setComprobanteUrl(url)}
              onClear={() => setComprobanteUrl('')}
              accept="application/pdf,image/*"
              folder="finanzas"
            />
            {comprobanteUrl && (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                ✓ Comprobante cargado correctamente
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Notas u Observaciones Contables
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Detalles adicionales para la auditoría o conciliación bancaria..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-sm shadow-emerald-600/20 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />
                  <span>Guardando…</span>
                </>
              ) : (
                <>
                  <Check size={16} aria-hidden="true" />
                  <span>{tipo === 'egreso' ? 'Registrar Gasto' : 'Registrar Ingreso'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
