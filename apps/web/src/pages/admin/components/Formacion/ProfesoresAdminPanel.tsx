import React, { useState, useEffect } from 'react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import { Trash2, UserPlus, Search, GraduationCap, Mail, Phone, Award, ShieldAlert, X } from 'lucide-react';

interface Profesor {
  id_profesor: number;
  id_persona: number;
  id_afiliado: number | null;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  telefono: string | null;
  codigo_afiliado: string | null;
}

interface PersonaDisponible {
  id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  telefono: string | null;
  id_afiliado: number | null;
  codigo_afiliado: string | null;
}

const ProfesoresAdminPanel = () => {
  const { token } = useAuth();
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registerMode, setRegisterMode] = useState<'existente' | 'nuevo'>('existente');
  const [personasDisponibles, setPersonasDisponibles] = useState<PersonaDisponible[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');

  // Form states for new persona
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    cedula_tipo: 'V',
    cedula: '',
    email: '',
    telefono: '',
  });

  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const fetchProfesores = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/academia/profesores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setProfesores(json.data);
      }
    } catch (e) {
      console.error('Error fetching profesores:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonasDisponibles = async () => {
    setLoadingPersonas(true);
    try {
      const res = await fetch(`${API_URL}/api/academia/personas-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setPersonasDisponibles(json.data);
      }
    } catch (e) {
      console.error('Error fetching personas disponibles:', e);
    } finally {
      setLoadingPersonas(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfesores();
    }
  }, [token]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setRegisterMode('existente');
    setSelectedPersonaId('');
    setFormData({
      nombres: '',
      apellidos: '',
      cedula_tipo: 'V',
      cedula: '',
      email: '',
      telefono: '',
    });
    fetchPersonasDisponibles();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCreateProfesor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let body: any = {};
      if (registerMode === 'existente') {
        if (!selectedPersonaId) {
          Swal.fire('Error', 'Por favor selecciona una persona de la lista', 'error');
          return;
        }
        const persona = personasDisponibles.find(p => p.id === Number(selectedPersonaId));
        body = {
          id_persona: persona?.id,
          id_afiliado: persona?.id_afiliado
        };
      } else {
        if (!formData.nombres || !formData.apellidos || !formData.cedula || !formData.email) {
          Swal.fire('Error', 'Completa los campos obligatorios del formulario', 'error');
          return;
        }
        body = {
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          cedula_tipo: formData.cedula_tipo,
          cedula: formData.cedula,
          email: formData.email,
          telefono: formData.telefono,
        };
      }

      const res = await fetch(`${API_URL}/api/academia/profesores`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const json = await res.json();

      if (json.success) {
        Swal.fire({
          title: '¡Registrado!',
          text: 'Profesor registrado exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        handleCloseModal();
        fetchProfesores();
      } else {
        Swal.fire('Error', json.message || 'No se pudo registrar el profesor', 'error');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error de red', 'error');
    }
  };

  const handleDeleteProfesor = async (id: number, name: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar Profesor?',
      text: `¿Estás seguro de que deseas retirar a ${name} de la lista de profesores? Esto no eliminará sus datos de persona o afiliado.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Sí, retirar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/academia/profesores/${id}`, {
        method: 'DELETE',
        headers
      });
      const json = await res.json();

      if (json.success) {
        Swal.fire({
          title: 'Retirado',
          text: 'El profesor ha sido retirado correctamente.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        fetchProfesores();
      } else {
        Swal.fire('Error', json.message || 'No se pudo retirar el profesor', 'error');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Error de red', 'error');
    }
  };

  const filteredProfesores = profesores.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.nombres.toLowerCase().includes(q) ||
      p.apellidos.toLowerCase().includes(q) ||
      p.cedula.includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.codigo_afiliado && p.codigo_afiliado.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full bg-slate-50/50 p-4 sm:p-6 overflow-hidden">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6 shrink-0">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all shadow-xs"
          />
        </div>
        <button
          onClick={handleOpenModal}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#00D084] hover:bg-[#00B870] text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-[#00D084]/20 active:scale-95 flex items-center justify-center gap-2"
        >
          <UserPlus size={16} /> Registrar Profesor
        </button>
      </div>

      {/* Grid Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D084] mb-2" />
            <span className="text-sm font-semibold">Cargando profesores...</span>
          </div>
        ) : filteredProfesores.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400 bg-white border border-gray-100 rounded-2xl shadow-xs">
            <GraduationCap size={48} className="text-gray-300 mb-4" />
            <p className="font-bold text-lg text-slate-600">No se encontraron profesores</p>
            <p className="text-xs mt-1 max-w-xs font-semibold leading-relaxed">
              {searchQuery ? 'Prueba con otros términos de búsqueda.' : 'Registra tu primer profesor usando el botón superior.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProfesores.map((prof) => (
              <div key={prof.id_profesor} className="flex flex-col bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative group">
                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteProfesor(prof.id_profesor, `${prof.nombres} ${prof.apellidos}`)}
                  className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                  title="Retirar profesor"
                >
                  <Trash2 size={16} />
                </button>

                {/* Profile Header */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#00B870] font-black text-lg">
                    {prof.nombres.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-[#00B870] transition-colors">
                      {prof.nombres} {prof.apellidos}
                    </h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">C.I. {prof.cedula}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs font-semibold text-slate-500 mb-4 flex-1">
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{prof.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span>{prof.telefono || 'Sin teléfono'}</span>
                  </div>
                </div>

                {/* Footer Badge / Affiliate Link */}
                <div className="pt-3.5 border-t border-slate-50 flex items-center justify-between shrink-0">
                  {prof.codigo_afiliado ? (
                    <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full bg-emerald-50 text-[#00B870] border border-[#00D084]/15 flex items-center gap-1">
                      <Award size={10} /> Afiliado CIEBO
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full bg-slate-50 text-slate-400 border border-slate-200">
                      Externo
                    </span>
                  )}
                  {prof.codigo_afiliado && (
                    <span className="text-[10px] font-black text-slate-400 font-mono">
                      {prof.codigo_afiliado}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── REGISTRATION MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Registrar Profesor</h3>
                <p className="text-[11px] text-slate-400 font-semibold">Agrega un instructor al listado académico</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Modes */}
            <div className="flex border-b border-slate-100 p-2 bg-slate-50/20 shrink-0">
              <button
                type="button"
                onClick={() => setRegisterMode('existente')}
                className={[
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                  registerMode === 'existente'
                    ? 'bg-white text-[#00B870] shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                ].join(' ')}
              >
                Persona Existente
              </button>
              <button
                type="button"
                onClick={() => setRegisterMode('nuevo')}
                className={[
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                  registerMode === 'nuevo'
                    ? 'bg-white text-[#00B870] shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                ].join(' ')}
              >
                Registrar Nuevo
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateProfesor} className="p-6 overflow-y-auto flex flex-col gap-4">
              {registerMode === 'existente' ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50/50 border border-[#00D084]/20 rounded-xl p-3 flex gap-2">
                    <ShieldAlert className="text-[#00B870] shrink-0 w-4 h-4 mt-0.5" />
                    <p className="text-[11px] font-semibold text-slate-500 leading-normal">
                      Selecciona una persona registrada en la base de datos (afiliado, estudiante o persona común) para otorgarle el rol de profesor.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Persona o Afiliado Disponible
                    </label>
                    {loadingPersonas ? (
                      <div className="text-xs font-bold text-slate-400 py-2">Buscando registros...</div>
                    ) : personasDisponibles.length === 0 ? (
                      <p className="text-xs font-semibold text-slate-400 italic">No hay personas disponibles registradas que no sean ya profesores.</p>
                    ) : (
                      <select
                        required
                        value={selectedPersonaId}
                        onChange={(e) => setSelectedPersonaId(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all bg-white"
                      >
                        <option value="">-- Selecciona una Persona --</option>
                        {personasDisponibles.map((p) => (
                          <option key={p.id} value={p.id.toString()}>
                            {p.nombres} {p.apellidos} · C.I. {p.cedula} {p.codigo_afiliado ? `(${p.codigo_afiliado})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombres</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                        value={formData.nombres}
                        onChange={e => setFormData({ ...formData, nombres: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Apellidos</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                        value={formData.apellidos}
                        onChange={e => setFormData({ ...formData, apellidos: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">C.I. Tipo</label>
                      <select
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all bg-white"
                        value={formData.cedula_tipo}
                        onChange={e => setFormData({ ...formData, cedula_tipo: e.target.value })}
                      >
                        <option value="V">V</option>
                        <option value="E">E</option>
                        <option value="P">P</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cédula (Solo Números)</label>
                      <input
                        type="text"
                        required
                        pattern="^[0-9]+$"
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                        value={formData.cedula}
                        onChange={e => setFormData({ ...formData, cedula: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono (Opcional)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                      value={formData.telefono}
                      onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-[#00D084] hover:bg-[#00B870] rounded-xl transition-all shadow-md shadow-[#00D084]/20 active:scale-95"
                >
                  Confirmar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfesoresAdminPanel;
