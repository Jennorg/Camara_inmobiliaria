import React, { useState, useEffect } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { X, Check, DollarSign, FileText, UploadCloud, AlertCircle, Calculator } from 'lucide-react'
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

export default function ModalRegistrarGasto({ isOpen, onClose, onSuccess }: ModalRegistrarGastoProps) {
  const { authHeaders } = useAuth()
  const [loading, setLoading] = useState(false)

  const [tipo, setTipo] = useState<TxType>('egreso')
  const [categoria, setCategoria] = useState<TxCategory>('alquiler')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [proveedorCliente, setProveedorCliente] = useState('')
  const [rifCedula, setRifCedula] = useState('')
  const [nroFactura, setNroFactura] = useState('')
  const [nroControl, setNroControl] = useState('')
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

  // Desglose contable
  const [montoExento, setMontoExento] = useState('0')
  const [baseImponible, setBaseImponible] = useState('')
  const [alicuotaIva, setAlicuotaIva] = useState('16')
  const [montoIva, setMontoIva] = useState('0')
  const [montoTotal, setMontoTotal] = useState('')
  
  const [metodoPago, setMetodoPago] = useState('transferencia')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [bancoOrigen, setBancoOrigen] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState('')
  const [notas, setNotas] = useState('')

  // Re-calcular IVA y total al cambiar base o alícuota
  useEffect(() => {
    const base = parseFloat(baseImponible) || 0
    const exento = parseFloat(montoExento) || 0
    const alic = parseFloat(alicuotaIva) || 0
    
    const ivaCalculado = Math.round((base * (alic / 100)) * 100) / 100
    setMontoIva(ivaCalculado > 0 ? ivaCalculado.toFixed(2) : '0')
    
    const totalCalculado = Math.round((base + exento + ivaCalculado) * 100) / 100
    if (base > 0 || exento > 0) {
      setMontoTotal(totalCalculado.toFixed(2))
    }
  }, [baseImponible, montoExento, alicuotaIva])

  // Ajustar categoría predeterminada al cambiar tipo
  useEffect(() => {
    if (tipo === 'egreso') {
      setCategoria('alquiler')
    } else {
      setCategoria('convenio')
    }
  }, [tipo])

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
        nro_control_fiscal: nroControl.trim() || null,
        concepto: concepto.trim(),
        base_imponible: parseFloat(baseImponible) || 0,
        monto_exento: parseFloat(montoExento) || 0,
        alicuota_iva: parseFloat(alicuotaIva) || 0,
        monto_iva: parseFloat(montoIva) || 0,
        monto_total: totalNum,
        moneda,
        tasa_bcv: parseFloat(tasaBcv) || 1,
        metodo_pago: metodoPago,
        referencia_pago: referenciaPago.trim() || null,
        banco_origen: bancoOrigen.trim() || null,
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
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {tipo === 'egreso' ? 'Registrar Compra / Gasto Operativo' : 'Registrar Ingreso Extraordinario'}
              </h3>
              <p className="text-xs text-emerald-200/80">
                {tipo === 'egreso' ? 'Libro de Compras · Control de Gastos e IVA' : 'Libro de Ventas · Flujo de Caja'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X size={18} />
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
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border ${
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
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border ${
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

          {/* Factura / Control Fiscal / Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                Nro. Control Fiscal
              </label>
              <input
                type="text"
                value={nroControl}
                onChange={e => setNroControl(e.target.value)}
                placeholder="Ej. 00-001245"
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

          {/* Desglose Contable e IVA */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Desglose Impositivo (SENIAT / Contabilidad)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Tasa BCV:</span>
                <span className="text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  Bs. {parseFloat(tasaBcv || '1').toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-slate-500 ml-2">Moneda:</span>
                <select
                  value={moneda}
                  onChange={e => setMoneda(e.target.value as any)}
                  className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="VES">VES (Bs.)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Monto Exento
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoExento}
                  onChange={e => setMontoExento(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Base Imponible
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={baseImponible}
                  onChange={e => setBaseImponible(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Alícuota IVA (%)
                </label>
                <select
                  value={alicuotaIva}
                  onChange={e => setAlicuotaIva(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white"
                >
                  <option value="16">16% (General)</option>
                  <option value="8">8% (Reducida)</option>
                  <option value="0">0% (Exento)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Monto IVA ({alicuotaIva}%)
                </label>
                <input
                  type="text"
                  readOnly
                  value={montoIva}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-emerald-700 bg-emerald-50/50 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Total Factura / Operación:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-slate-400">{moneda === 'USD' ? '$' : 'Bs.'}</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={montoTotal}
                  onChange={e => setMontoTotal(e.target.value)}
                  placeholder="0.00"
                  className="w-32 px-3 py-1 rounded-lg border border-emerald-300 text-base font-black text-emerald-800 bg-white text-right"
                />
              </div>
            </div>
          </div>

          {/* Método de Pago y Referencia */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={e => setMetodoPago(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
              >
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="pago_movil">Pago Móvil</option>
                <option value="efectivo_usd">Efectivo USD ($)</option>
                <option value="efectivo_bs">Efectivo Bolívares (Bs.)</option>
                <option value="zelle">Zelle</option>
                <option value="binance_usdt">Binance (USDT)</option>
                <option value="cheque">Cheque</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Nro. Referencia Bancaria
              </label>
              <input
                type="text"
                value={referenciaPago}
                onChange={e => setReferenciaPago(e.target.value)}
                placeholder="Ej. TRN-991204"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Banco Origen / Destino
              </label>
              <input
                type="text"
                value={bancoOrigen}
                onChange={e => setBancoOrigen(e.target.value)}
                placeholder="Ej. Banesco"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Adjuntar Factura / Comprobante */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Comprobante o Factura Digital (PDF o Imagen)
            </label>
            <FileUpload
              onUploadComplete={(url) => setComprobanteUrl(url)}
              accept="application/pdf,image/*"
              category="finanzas"
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
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Check size={16} />
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
