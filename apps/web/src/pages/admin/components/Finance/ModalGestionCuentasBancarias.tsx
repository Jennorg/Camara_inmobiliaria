import React, { useState, useEffect } from 'react';
import { X, Plus, Landmark, Trash2, Edit2, Check, Loader2, Info } from 'lucide-react';
import { CuentaBancariaDTO } from '@/types/pagos';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';

interface ModalGestionCuentasBancariasProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  authHeaders?: Record<string, string>;
}

export const ModalGestionCuentasBancarias: React.FC<ModalGestionCuentasBancariasProps> = ({
  open,
  isOpen,
  onClose,
  authHeaders: customAuthHeaders
}) => {
  const { token } = useAuth();
  const effectiveOpen = open ?? isOpen ?? false;
  const headers = customAuthHeaders || (token ? { Authorization: `Bearer ${token}` } : {});

  const [cuentas, setCuentas] = useState<CuentaBancariaDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{
    tipo: 'pago_movil' | 'transferencia' | 'zelle' | 'otro';
    banco: string;
    beneficiario: string;
    identificacion: string;
    numero_cuenta: string;
    telefono: string;
    email: string;
    instrucciones: string;
    orden: number;
  }>({
    tipo: 'pago_movil',
    banco: '',
    beneficiario: '',
    identificacion: '',
    numero_cuenta: '',
    telefono: '',
    email: '',
    instrucciones: '',
    orden: 0
  });

  // Modalidad: pagos electrónicos o todos canalizados por la administración (null mientras se consulta)
  const [electronicos, setElectronicos] = useState<boolean | null>(null);
  const [guardandoModalidad, setGuardandoModalidad] = useState(false);

  const cambiarModalidad = async (habilitar: boolean) => {
    const confirmacion = await Swal.fire({
      title: habilitar ? '¿Recibir pagos electrónicos?' : '¿Canalizar todos los pagos por la administración?',
      text: habilitar
        ? 'Los afiliados volverán a ver las cuentas oficiales y podrán reportar pagos con su comprobante.'
        : 'Los afiliados dejarán de ver las cuentas y no podrán reportar pagos: se les indicará que paguen en la administración. Los pagos ya reportados se siguen verificando.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669'
    });
    if (!confirmacion.isConfirmed) return;
    setGuardandoModalidad(true);
    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/modalidad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ electronicos: habilitar })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo guardar');
      setElectronicos(habilitar);
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo cambiar la modalidad', 'error');
    } finally {
      setGuardandoModalidad(false);
    }
  };

  useEffect(() => {
    if (!effectiveOpen) return;
    fetch(`${API_URL}/api/pagos/modalidad`).then(r => r.json()).then(j => { if (j.success) setElectronicos(!!j.data.electronicos); }).catch(() => {});
  }, [effectiveOpen]);

  const fetchCuentas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/cuentas`, { headers });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCuentas(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveOpen) {
      fetchCuentas();
    }
  }, [effectiveOpen]);

  const handleEdit = (c: CuentaBancariaDTO) => {
    setEditingId(c.id_cuenta);
    setForm({
      tipo: c.tipo as any,
      banco: c.banco,
      beneficiario: c.beneficiario,
      identificacion: c.identificacion,
      numero_cuenta: c.numero_cuenta || '',
      telefono: c.telefono || '',
      email: c.email || '',
      instrucciones: c.instrucciones || '',
      orden: c.orden || 0
    });
  };

  const handleResetForm = () => {
    setEditingId(null);
    setForm({
      tipo: 'pago_movil',
      banco: '',
      beneficiario: '',
      identificacion: '',
      numero_cuenta: '',
      telefono: '',
      email: '',
      instrucciones: '',
      orden: 0
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `${API_URL}/api/pagos/admin/cuentas/${editingId}`
        : `${API_URL}/api/pagos/admin/cuentas`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(form)
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al guardar');

      Swal.fire({
        title: isEditing ? 'Cuenta Actualizada' : 'Cuenta Creada',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });

      handleResetForm();
      fetchCuentas();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo guardar la cuenta', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const confirm = await Swal.fire({
      title: '¿Desactivar Cuenta?',
      text: 'La cuenta no será mostrada a los aspirantes para realizar pagos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Sí, Desactivar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/cuentas/${id}`, {
        method: 'DELETE',
        headers
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Error');
      fetchCuentas();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  if (!effectiveOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white w-full max-w-2xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-200">
              <Landmark className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Cuentas y modalidad de pago
              </h3>
              <p className="text-xs font-bold text-slate-500">
                Cómo reciben los pagos los afiliados y aspirantes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800">

          {/* Modalidad de recepción de pagos */}
          <div className={`p-4 rounded-2xl border flex items-start justify-between gap-4 ${electronicos === false ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
            <div className="space-y-1">
              <p id="etiqueta-modalidad" className="text-sm font-black text-slate-900">Recibir pagos electrónicos</p>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                {electronicos === false
                  ? 'Desactivado: todos los pagos se canalizan por la administración. Los afiliados no ven las cuentas ni pueden reportar pagos.'
                  : 'Activado: los afiliados ven las cuentas oficiales y reportan sus pagos con comprobante para que Finanzas los verifique.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={electronicos !== false}
              aria-labelledby="etiqueta-modalidad"
              disabled={electronicos === null || guardandoModalidad}
              onClick={() => cambiarModalidad(electronicos === false)}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${electronicos === false ? 'bg-slate-300' : 'bg-emerald-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${electronicos === false ? '' : 'translate-x-5'}`} />
            </button>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              {editingId !== null ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingId !== null ? 'Editar Cuenta Bancaria' : 'Agregar Nueva Cuenta'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipo de Cuenta *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs font-bold"
                >
                  <option value="pago_movil">Pago Móvil (Bs.)</option>
                  <option value="transferencia">Transferencia Bancaria Nacional (Bs.)</option>
                  <option value="zelle">Zelle (USD)</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Banco / Plataforma *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Banesco (0134) o Zelle"
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Beneficiario / Titular *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cámara Inmobiliaria de Bolívar"
                  value={form.beneficiario}
                  onChange={(e) => setForm({ ...form, beneficiario: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">RIF / C.I. *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. J-30456789-0"
                  value={form.identificacion}
                  onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs font-mono font-bold"
                />
              </div>

              {form.tipo === 'pago_movil' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Teléfono Pago Móvil</label>
                  <input
                    type="text"
                    placeholder="Ej. 0414-8889900"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs font-mono"
                  />
                </div>
              )}

              {form.tipo === 'transferencia' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Número de Cuenta Completo (20 dígitos)</label>
                  <input
                    type="text"
                    placeholder="Ej. 0134-0000-00-0000000000"
                    value={form.numero_cuenta}
                    onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs font-mono font-bold"
                  />
                </div>
              )}

              {form.tipo === 'zelle' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Correo Electrónico Zelle</label>
                  <input
                    type="email"
                    placeholder="Ej. pagos@camarainmobiliaria.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs font-bold"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Instrucciones / Notas adicionales</label>
                <input
                  type="text"
                  placeholder="Ej. Indicar nombre del afiliado en el concepto."
                  value={form.instrucciones}
                  onChange={(e) => setForm({ ...form, instrucciones: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-xs text-slate-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {editingId !== null && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold hover:bg-white text-slate-600 text-xs"
                >
                  Cancelar Edición
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>{editingId !== null ? 'Guardar Cambios' : 'Registrar Cuenta'}</span>
              </button>
            </div>
          </form>

          {/* List of accounts */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
              Cuentas Registradas ({cuentas.length})
            </span>

            {loading ? (
              <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cargando cuentas...</span>
              </div>
            ) : cuentas.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl">
                No hay cuentas bancarias configuradas.
              </div>
            ) : (
              <div className="space-y-2">
                {cuentas.map((c) => (
                  <div
                    key={c.id_cuenta}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      Number(c.activo) === 1
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-200/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs uppercase">
                        {c.tipo.replace('_', ' ')}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900">{c.banco}</p>
                          {Number(c.activo) === 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase">
                              Inactiva
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {c.beneficiario} · {c.identificacion}
                          {c.telefono ? ` · Tel: ${c.telefono}` : ''}
                          {c.numero_cuenta ? ` · ${c.numero_cuenta}` : ''}
                          {c.email ? ` · ${c.email}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {Number(c.activo) === 1 && (
                        <button
                          onClick={() => handleDelete(c.id_cuenta)}
                          className="p-2 rounded-xl hover:bg-rose-50 text-rose-500 transition-colors"
                          title="Desactivar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default ModalGestionCuentasBancarias;
