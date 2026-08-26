import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import { formatNombreCard } from '@/utils/formatters';
import { Calendar, Users, Pencil, Lock, Unlock, UserPlus, Search, CheckCircle2, XCircle, X, User, ChevronDown, Trash2 } from 'lucide-react';

import { uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared';
import { apiFetch } from '@/lib/apiClient';

interface CursoDB {
  id_curso: number;
  id_instructor: number;
  nombre: string;
  titulo?: string;
  descripcion: string | null;
  imagen_url: string | null;
  programa_codigo: string | null;
  nivel_academico: string | null;
  cupos_totales: number;
  cupos_disponibles: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  precio: string | null;
  estatus: 'Abierto' | 'Cerrado' | 'En curso' | 'Próximamente';
  solo_informativo?: number | boolean;
  creado_en: string;
  actualizado_en: string | null;
  instructor_nombre?: string;
  categoria?: string | null;
  modulos?: { nombre_modulo: string; id_profesor: number | null; profesor?: string | null; orden: number }[];
}

const STATUS_STYLES: Record<string, string> = {
  'Abierto': 'bg-emerald-50 text-emerald-600',
  'Próximamente': 'bg-emerald-50 text-emerald-600',
  'En curso': 'bg-amber-50 text-amber-600',
  'Cerrado': 'bg-slate-100 text-slate-500',
};

const NIVEL_STYLES: Record<string, string> = {
  'Principiante': 'bg-teal-50 text-teal-600',
  'Intermedio': 'bg-violet-50 text-violet-600',
  'Avanzado': 'bg-rose-50 text-rose-500',
  'Libre': 'bg-gray-50 text-gray-600',
};

const getSafeNumber = (val: any, fallback = 0): number => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const calcInscritos = (c: any): number => {
  if (typeof c?.num_estudiantes === 'number' && !isNaN(c.num_estudiantes)) {
    return c.num_estudiantes;
  }
  if (typeof c?.inscritos === 'number' && !isNaN(c.inscritos)) {
    return c.inscritos;
  }
  const totales = getSafeNumber(c?.cupos_totales, 0);
  const disponibles = getSafeNumber(c?.cupos_disponibles, totales);
  return Math.max(0, totales - disponibles);
};

const CursosAdminPanel = () => {
  const { token } = useAuth();
  const [cursos, setCursos] = useState<CursoDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingCurso, setViewingCurso] = useState<CursoDB | null>(null);
  const [profesores, setProfesores] = useState<any[]>([]);

  // States for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // New Professor Modal States
  const [isProfModalOpen, setIsProfModalOpen] = useState(false);
  const [profRegisterMode, setProfRegisterMode] = useState<'existente' | 'nuevo'>('existente');
  const [personasDisponibles, setPersonasDisponibles] = useState<any[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [currentModIndex, setCurrentModIndex] = useState<number | null>(null);

  const [profFormData, setProfFormData] = useState({
    nombres: '',
    apellidos: '',
    cedula_tipo: 'V',
    cedula: '',
    email: '',
    telefono: '',
  });

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const publicUrl = await uploadFileSupabase(file, 'cursos_admin');
      setFormData((p) => ({ ...p, imagen_url: publicUrl }));
    } catch (e) {
      Swal.fire('Error', e instanceof Error ? e.message : 'Error al subir archivo', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState<{
    nombre: string;
    descripcion: string;
    imagen_url: string;
    cupos_totales: number;
    precio: string;
    fecha_inicio: string;
    id_instructor: number;
    categoria: string;
    estatus: 'Abierto' | 'Cerrado' | 'En curso' | 'Próximamente';
    solo_informativo: number;
    modulos: { nombre_modulo: string; id_profesor: number | null; profesor?: string | null; orden: number }[];
  }>({
    nombre: '',
    descripcion: '',
    imagen_url: '',
    cupos_totales: 30,
    precio: '0',
    fecha_inicio: '',
    id_instructor: 1,
    categoria: 'Taller',
    estatus: 'Abierto',
    solo_informativo: 0,
    modulos: [{ nombre_modulo: 'Módulo General', id_profesor: null, orden: 0 }],
  });

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const fetchCursos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/academia/cursos`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setCursos(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchProfesores = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/academia/profesores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setProfesores(json.data);
      }
    } catch (e) {
      console.error('Error fetching profesores:', e);
    }
  }, [token]);

  const fetchPersonasDisponibles = async () => {
    setLoadingPersonas(true);
    try {
      const res = await fetch(`${API_URL}/api/academia/personas-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setPersonasDisponibles(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPersonas(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!token) return;
    const load = async () => {
      setLoading(true);
      try {
        const [jsonC, jsonP] = await Promise.all([
          apiFetch(`${API_URL}/api/academia/cursos`, { headers: { Authorization: `Bearer ${token}` } }),
          apiFetch(`${API_URL}/api/academia/profesores`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (!active) return;
        if (jsonC.success) setCursos(jsonC.data);
        if (jsonP.success) setProfesores(jsonP.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  const handleOpenModal = (curso?: CursoDB) => {
    fetchProfesores(); // Refresh list when modal opens
    if (curso) {
      setEditingId(curso.id_curso);
      setFormData({
        nombre: curso.titulo || curso.nombre || '',
        descripcion: curso.descripcion || '',
        imagen_url: curso.imagen_url || '',
        cupos_totales: curso.cupos_totales,
        precio: curso.precio === 'Gratis' ? '0' : curso.precio?.replace('$', '').trim() || '0',
        fecha_inicio: curso.fecha_inicio || '',
        id_instructor: curso.id_instructor || 1,
        categoria: curso.categoria || 'Taller',
        estatus: (curso.estatus as any) || 'Abierto',
        solo_informativo: curso.solo_informativo ? 1 : 0,
        modulos: curso.modulos || [{ nombre_modulo: 'Módulo General', id_profesor: null, orden: 0 }],
      });
    } else {
      setEditingId(null);
      setFormData({
        nombre: '',
        descripcion: '',
        imagen_url: '',
        cupos_totales: 30,
        precio: '0',
        fecha_inicio: '',
        id_instructor: 1,
        categoria: 'Taller',
        estatus: 'Abierto',
        solo_informativo: 0,
        modulos: [{ nombre_modulo: 'Módulo General', id_profesor: null, orden: 0 }],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenProfModal = () => {
    setProfRegisterMode('existente');
    setSelectedPersonaId('');
    setProfFormData({
      nombres: '',
      apellidos: '',
      cedula_tipo: 'V',
      cedula: '',
      email: '',
      telefono: '',
    });
    fetchPersonasDisponibles();
    setIsProfModalOpen(true);
  };

  const busyCreateProfRef = useRef(false);
  const handleCreateProfesor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyCreateProfRef.current) return;
    busyCreateProfRef.current = true;
    try {
      let body: any = {};
      if (profRegisterMode === 'existente') {
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
        if (!profFormData.nombres || !profFormData.apellidos || !profFormData.cedula || !profFormData.email) {
          Swal.fire('Error', 'Completa los campos obligatorios del formulario', 'error');
          return;
        }
        body = {
          nombres: profFormData.nombres,
          apellidos: profFormData.apellidos,
          cedula_tipo: profFormData.cedula_tipo,
          cedula: profFormData.cedula,
          email: profFormData.email,
          telefono: profFormData.telefono,
        };
      }

      const res = await fetch(`${API_URL}/api/academia/profesores`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        Swal.fire('Éxito', 'Profesor registrado correctamente', 'success');
        setIsProfModalOpen(false);
        // Reload professors
        const resProfs = await fetch(`${API_URL}/api/academia/profesores`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resProfs.ok) throw new Error(`HTTP error! status: ${resProfs.status}`);
        const jsonProfs = await resProfs.json();
        if (jsonProfs.success) {
          setProfesores(jsonProfs.data);
          // Auto-select newly created professor
          const newProfId = json.data?.id_profesor;
          if (newProfId && currentModIndex !== null) {
            const newMods = [...formData.modulos];
            newMods[currentModIndex].id_profesor = newProfId;
            setFormData({ ...formData, modulos: newMods });
          }
        }
      } else {
        Swal.fire('Error', json.message || 'Error al registrar profesor', 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Fallo de conexión', 'error');
    } finally {
      busyCreateProfRef.current = false;
    }
  };

  const handleToggleStatus = async (curso: CursoDB) => {
    const isCurrentlyClosed = curso.estatus === 'Cerrado';
    const actionText = isCurrentlyClosed ? 'abrir/reabrir' : 'cerrar';
    const nextStatus = isCurrentlyClosed ? 'Abierto' : 'Cerrado';

    const result = await Swal.fire({
      title: `¿Quieres ${actionText} este curso?`,
      text: isCurrentlyClosed
        ? "El curso volverá a estar disponible para inscripciones."
        : "El curso se cerrará y no se aceptarán más inscripciones.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#00D084',
      cancelButtonColor: '#d33',
      confirmButtonText: isCurrentlyClosed ? 'Sí, abrir' : 'Sí, cerrar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/academia/cursos/${curso.id_curso}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ estatus: nextStatus })
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const json = await res.json();
        if (json.success) {
          Swal.fire('Éxito', `Curso ${isCurrentlyClosed ? 'abierto' : 'cerrado'} correctamente.`, 'success');
          fetchCursos();
        } else {
          Swal.fire('Error', json.message || 'No se pudo actualizar el estado del curso', 'error');
        }
      } catch (error) {
        Swal.fire('Error', 'Problema de conexión al servidor', 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `${API_URL}/api/academia/cursos/${editingId}` : `${API_URL}/api/academia/cursos`;
      const method = editingId ? 'PUT' : 'POST';

      const finalPrice = Number(formData.precio) === 0 ? 'Gratis' : `$${formData.precio}`;
      const payload = {
        ...formData,
        titulo: formData.nombre,
        precio: finalPrice,
        nivel_academico: 'Libre'
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        Swal.fire('Éxito', `Curso ${editingId ? 'actualizado' : 'creado'} correctamente`, 'success');
        handleCloseModal();
        fetchCursos();
      } else {
        Swal.fire('Error', json.message || 'Error al guardar el curso', 'error');
      }
    } catch (error) {
      Swal.fire('Error', 'Problema de conexión al servidor', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar curso?',
      text: 'Esta acción eliminará permanentemente el curso y sus módulos configurados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/academia/cursos/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const json = await res.json();
        if (json.success) {
          Swal.fire('Eliminado', 'El curso fue eliminado permanentemente.', 'success');
          fetchCursos();
        } else {
          Swal.fire('Error', json.message || 'No se pudo eliminar el curso', 'error');
        }
      } catch (error) {
        Swal.fire('Error', 'Problema de conexión al servidor', 'error');
      }
    }
  };

  if (viewingCurso) {
    return <ListaInscritosCurso curso={viewingCurso} onBack={() => { setViewingCurso(null); fetchCursos() }} token={token} />;
  }

  return (
    <div className="w-full flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto h-full relative flex flex-col">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Cursos & Talleres</h3>
          <p className="text-xs text-slate-400 mt-0.5">{cursos.length} programas registrados</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00D084] text-white text-xs font-semibold hover:bg-[#00B870] transition-colors whitespace-nowrap"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Curso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><span className="text-sm text-slate-500 font-semibold">Cargando cursos...</span></div>
      ) : (
        <>
          {/* ── MOBILE: cards ── */}
          <div className="sm:hidden flex flex-col gap-3">
            {cursos.map(c => (
              <div key={c.id_curso} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <p className="font-semibold text-slate-800 text-sm leading-tight">{c.titulo || c.nombre}</p>
                    {c.categoria && (
                      <span className="self-start text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">{c.categoria}</span>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[c.estatus] || 'bg-gray-100'}`}>
                    {c.estatus}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  <span>{c.instructor_nombre || 'Sin Instructor'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    {c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : 'Por definir'}
                  </span>
                </div>
                {/* Cupos bar */}
                {!(Number(c.solo_informativo) === 1 || c.solo_informativo === true || (c.estatus as string) === 'Solo Informativo') && (() => {
                  const totales = getSafeNumber(c.cupos_totales, 0);
                  const ins = calcInscritos(c);
                  const isIlimitado = totales >= 999999;
                  const pct = totales > 0 ? Math.max(0, Math.min(100, (ins / totales) * 100)) : 0;
                  return isIlimitado ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Cupos Ilimitados</span>
                      <span className="text-[10px] text-slate-500 ml-auto tabular-nums">{ins} inscritos</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00D084] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap tabular-nums">{ins}/{totales} inscritos</span>
                    </div>
                  );
                })()}
                <div className="flex gap-2 mt-2 border-t pt-2 border-gray-100 justify-end">
                  <button
                    onClick={() => setViewingCurso(c)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#00B870] bg-[#E9FAF4] hover:bg-[#D3F5E7] active:scale-95 rounded-xl transition-colors transition-transform shadow-sm shadow-[#00D084]/5"
                  >
                    <Users size={12} />
                    <span>Inscritos</span>
                  </button>
                  <button
                    onClick={() => handleOpenModal(c)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                  >
                    <Pencil size={12} />
                    <span>Editar</span>
                  </button>
                  {c.estatus === 'Cerrado' ? (
                    <button
                      onClick={() => handleToggleStatus(c)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                    >
                      <Unlock size={12} />
                      <span>Abrir</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(c)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                    >
                      <Lock size={12} />
                      <span>Cerrar</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id_curso)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                    title="Eliminar curso"
                  >
                    <Trash2 size={12} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px] table-auto">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-400 tracking-wide uppercase whitespace-nowrap w-[30%]">CURSO</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-400 tracking-wide uppercase whitespace-nowrap w-[20%]">INSTRUCTOR</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-400 tracking-wide uppercase whitespace-nowrap w-[20%]">INSCRITOS</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-400 tracking-wide uppercase whitespace-nowrap w-[15%]">FECHA INICIO</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-400 tracking-wide uppercase whitespace-nowrap w-[15%]">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cursos.map(c => {
                  const totales = getSafeNumber(c.cupos_totales, 0);
                  const ins = calcInscritos(c);
                  const isIlimitado = totales >= 999999;
                  const pct = totales > 0 ? Math.max(0, Math.min(100, (ins / totales) * 100)) : 0;
                  return (
                    <tr key={c.id_curso} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-left">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-800 text-xs leading-tight">{c.titulo || c.nombre}</p>
                            {(c.solo_informativo === 1 || c.solo_informativo === true) && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wider">Solo Informativo</span>
                            )}
                          </div>
                          {c.categoria && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">{c.categoria}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap text-center">{c.instructor_nombre || 'Sin Instructor'}</td>
                      <td className="px-4 py-3 text-center">
                        {isIlimitado ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Ilimitados</span>
                            <span className="text-xs text-slate-500 tabular-nums">({ins} inscritos)</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                              <div className="h-full bg-[#00D084] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">{ins}/{totales}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap text-center">{c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : 'Por definir'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingCurso(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#00B870] bg-[#E9FAF4] hover:bg-[#D3F5E7] active:scale-95 rounded-xl transition-colors transition-transform shadow-sm shadow-[#00D084]/5"
                            title="Ver inscritos"
                          >
                            <Users size={12} />
                            <span>Inscritos</span>
                          </button>
                          <button
                            onClick={() => handleOpenModal(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                            title="Editar curso"
                          >
                            <Pencil size={12} />
                            <span>Editar</span>
                          </button>
                          {c.estatus === 'Cerrado' ? (
                            <button
                              onClick={() => handleToggleStatus(c)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                              title="Reabrir inscripciones"
                            >
                              <Unlock size={12} />
                              <span>Abrir</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(c)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                              title="Cerrar inscripciones"
                            >
                              <Lock size={12} />
                              <span>Cerrar</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(c.id_curso)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 rounded-xl transition-colors transition-transform shadow-sm"
                            title="Eliminar curso"
                          >
                            <Trash2 size={12} />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="transition-opacity transition-transform bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-800">{editingId ? 'Editar Curso' : 'Nuevo Curso'}</h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5 pr-4">
                {/* Drag & Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[#00D084]', 'bg-[#E9FAF4]') }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-[#00D084]', 'bg-[#E9FAF4]') }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-[#00D084]', 'bg-[#E9FAF4]');
                    const file = e.dataTransfer.files?.[0];
                    if (file) uploadImage(file);
                  }}
                  onClick={() => document.getElementById('image-upload')?.click()}
                  className="relative group cursor-pointer border-2 border-dashed border-gray-200 rounded-2xl p-6 transition-colors hover:border-[#00D084] hover:bg-[#E9FAF4]/50 flex flex-col items-center justify-center text-center gap-3 overflow-hidden"
                >
                  <input id="image-upload" type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                  }} />

                  {formData.imagen_url ? (
                    <>
                      <img src={formData.imagen_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity" />
                      <div className="relative z-10 w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                        <img src={formData.imagen_url} alt="Thumbnail" className="w-full h-full object-cover" />
                      </div>
                      <p className="relative z-10 text-xs font-bold text-[#00B870]">Imagen cargada · Cambiar</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-slate-400 group-hover:text-[#00D084] group-hover:scale-110 transition-colors transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Arrastra una imagen de portada</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-widest">o haz clic para buscar</p>
                      </div>
                    </>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-20">
                      <div className="w-5 h-5 border-2 border-[#00D084] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-black text-[#00D084] uppercase tracking-widest">Subiendo...</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre del Curso / Cohorte</label>
                  <input required
                    placeholder="Ej. Curso de Ética Inmobiliaria"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors"
                    value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descripción del Programa</label>
                  <textarea
                    rows={3}
                    placeholder="Describe los objetivos y alcances del curso..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors resize-none"
                    value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Categoría / Tipo de Actividad</label>
                    <select
                      required
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors"
                      value={formData.categoria}
                      onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                    >
                      <option value="Taller">Taller</option>
                      <option value="Conferencia">Conferencia</option>
                      <option value="Workshop">Workshop</option>
                      <option value="Webinar">Webinar</option>
                      <option value="Diplomado">Diplomado</option>
                      <option value="Certificación">Certificación</option>
                      <option value="Seminario">Seminario</option>
                      <option value="Charla">Charla</option>
                      <option value="Curso">Curso</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estatus del Curso</label>
                    <select
                      value={formData.estatus}
                      onChange={e => setFormData({ ...formData, estatus: e.target.value as any })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors"
                    >
                      <option value="Abierto">Abierto (Recibiendo Inscripciones)</option>
                      <option value="Cerrado">Cerrado / Concluido</option>
                      <option value="En curso">En curso</option>
                      <option value="Próximamente">Próximamente</option>
                    </select>
                  </div>
                </div>

                {/* Modo Solo Informativo Toggle */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 border border-emerald-200/80 rounded-2xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <span>📢 Publicar en Landing como Noticia / Afiche (Solo Informativo)</span>
                        {formData.solo_informativo === 1 && (
                          <span className="bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-black">En Landing</span>
                        )}
                      </h5>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        Al activar esta opción, la afiche o imagen promocional se publicitará automáticamente en el carrusel de <strong>Noticias de la Landing Principal</strong> (vista en grande de solo imagen).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={formData.solo_informativo === 1}
                        onChange={(e) => setFormData({ ...formData, solo_informativo: e.target.checked ? 1 : 0 })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo de Cupos</label>
                    <select
                      value={formData.cupos_totales === 999999 ? 'ilimitado' : 'limitado'}
                      onChange={(e) => {
                        const isIlimitado = e.target.value === 'ilimitado';
                        setFormData({
                          ...formData,
                          cupos_totales: isIlimitado ? 999999 : 30
                        });
                      }}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors"
                    >
                      <option value="limitado">Definidos / Limitados</option>
                      <option value="ilimitado">Abierto / Ilimitados</option>
                    </select>
                  </div>
                  {formData.cupos_totales !== 999999 && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cantidad de Cupos</label>
                      <input type="number" required min="1"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors"
                        value={formData.cupos_totales} onChange={e => {
                          const val = e.currentTarget.valueAsNumber;
                          setFormData({ ...formData, cupos_totales: Number.isFinite(val) ? val : 0 });
                        }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fecha de Inicio Estimada</label>
                  <input type="date" required
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors"
                    value={formData.fecha_inicio ? formData.fecha_inicio.substring(0, 10) : ''} onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  />
                </div>

                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Módulos del Curso</label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextNum = formData.modulos.length + 1;
                        setFormData({
                          ...formData,
                          modulos: [
                            ...formData.modulos,
                            { nombre_modulo: `Módulo ${nextNum}`, id_profesor: null, orden: nextNum - 1 }
                          ]
                        });
                      }}
                      className="text-xs font-bold text-[#00B870] hover:underline"
                    >
                      + Agregar Módulo
                    </button>
                  </div>

                  {formData.modulos.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay módulos definidos. Se creará uno por defecto.</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.modulos.map((mod, index) => (
                        <div key={(mod as any).id_modulo || (mod as any).id || mod.nombre_modulo || `modulo-${index}`} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 min-w-[20px]">{index + 1}</span>
                          <input
                            type="text"
                            required
                            placeholder="Nombre del módulo"
                            value={mod.nombre_modulo}
                            onChange={(e) => {
                              const newMods = [...formData.modulos];
                              newMods[index].nombre_modulo = e.target.value;
                              setFormData({ ...formData, modulos: newMods });
                            }}
                            className="flex-1 bg-white rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084]"
                          />
                          <select
                            value={mod.id_profesor || ''}
                            onChange={(e) => {
                              if (e.target.value === 'NEW_PROFESOR') {
                                setCurrentModIndex(index);
                                handleOpenProfModal();
                                e.target.value = mod.id_profesor ? String(mod.id_profesor) : '';
                                return;
                              }
                              const val = e.target.value ? Number(e.target.value) : null;
                              const newMods = [...formData.modulos];
                              newMods[index].id_profesor = val;
                              setFormData({ ...formData, modulos: newMods });
                            }}
                            className="bg-white rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084]"
                          >
                            <option value="">Profesor (Opcional)</option>
                            {profesores.map(p => (
                              <option key={p.id_profesor} value={p.id_profesor}>
                                {p.nombres} {p.apellidos} {p.codigo_afiliado ? `(${p.codigo_afiliado})` : ''}
                              </option>
                            ))}
                            <option value="NEW_PROFESOR" className="text-[#00B870] font-bold">+ Crear Nuevo Profesor...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const newMods = formData.modulos.filter((_, idx) => idx !== index)
                                .map((m, idx) => ({ ...m, orden: idx }));
                              setFormData({ ...formData, modulos: newMods });
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-bold px-1"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0 bg-slate-50/50">
                <button type="button" onClick={handleCloseModal} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors transition-transform active:scale-95">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-8 py-2.5 text-sm font-bold text-white bg-[#00D084] hover:bg-[#00B870] rounded-xl transition-colors transition-transform shadow-lg shadow-[#00D084]/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? 'Procesando...' : editingId ? 'Actualizar Programa' : 'Crear Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secondary Modal: Nuevo Profesor */}
      {isProfModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="transition-opacity transition-transform bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Registrar Profesor</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Vincular o crear docente</p>
              </div>
              <button onClick={() => setIsProfModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-5 border-b border-gray-100 bg-slate-50/30 flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setProfRegisterMode('existente')}
                className={`flex-grow py-1.5 text-xs font-bold rounded-lg border transition-colors ${profRegisterMode === 'existente'
                  ? 'bg-[#E9FAF4] text-[#00B870] border-[#00D084]/20 shadow-sm'
                  : 'bg-white text-slate-500 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                Persona Existente
              </button>
              <button
                type="button"
                onClick={() => setProfRegisterMode('nuevo')}
                className={`flex-grow py-1.5 text-xs font-bold rounded-lg border transition-colors ${profRegisterMode === 'nuevo'
                  ? 'bg-[#E9FAF4] text-[#00B870] border-[#00D084]/20 shadow-sm'
                  : 'bg-white text-slate-500 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                Persona Nueva
              </button>
            </div>

            <form onSubmit={handleCreateProfesor} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-4 pr-3">
                {profRegisterMode === 'existente' ? (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Seleccionar Persona</label>
                    {loadingPersonas ? (
                      <div className="text-xs text-slate-400 italic">Cargando personas...</div>
                    ) : (
                      <select
                        required
                        value={selectedPersonaId}
                        onChange={e => setSelectedPersonaId(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors"
                      >
                        <option value="">-- Elige una persona --</option>
                        {personasDisponibles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombres} {p.apellidos} - V-{p.cedula} {p.codigo_afiliado ? `(${p.codigo_afiliado})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-normal">
                      Solo se muestran personas registradas en el sistema (afiliados, postulantes, estudiantes) que no son profesores actualmente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombres</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Juan Carlos"
                          value={profFormData.nombres}
                          onChange={e => setProfFormData({ ...profFormData, nombres: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Apellidos</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Perez"
                          value={profFormData.apellidos}
                          onChange={e => setProfFormData({ ...profFormData, apellidos: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
                        <select
                          value={profFormData.cedula_tipo}
                          onChange={e => setProfFormData({ ...profFormData, cedula_tipo: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
                        >
                          <option value="V">V</option>
                          <option value="E">E</option>
                          <option value="P">P</option>
                          <option value="J">J</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cédula</label>
                        <input
                          type="text"
                          required
                          placeholder="Solo números"
                          value={profFormData.cedula}
                          onChange={e => setProfFormData({ ...profFormData, cedula: e.target.value.replace(/\D/g, '') })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</label>
                      <input
                        type="email"
                        required
                        placeholder="perez@example.com"
                        value={profFormData.email}
                        onChange={e => setProfFormData({ ...profFormData, email: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej. 04141234567"
                        value={profFormData.telefono}
                        onChange={e => setProfFormData({ ...profFormData, telefono: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 flex justify-end gap-2.5 flex-shrink-0 bg-slate-50/50">
                <button type="button" onClick={() => setIsProfModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00D084] hover:bg-[#00B870] rounded-xl transition-colors shadow-md shadow-[#00D084]/20"
                >
                  Guardar Profesor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ListaInscritosCurso = ({ curso, onBack, token }: { curso: CursoDB, onBack: () => void, token: string | null }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Inscribir State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollMode, setEnrollMode] = useState<'afiliado' | 'nuevo'>('afiliado');
  const [afiliadosLista, setAfiliadosLista] = useState<any[]>([]);
  const [afiliadoSearch, setAfiliadoSearch] = useState('');
  const [afiliadoSearchField, setAfiliadoSearchField] = useState<'nombre' | 'cedula' | 'email'>('nombre');
  const [showAfiliadoSearchDropdown, setShowAfiliadoSearchDropdown] = useState(false);
  const [selectedAfiliadoId, setSelectedAfiliadoId] = useState<string>('');
  const [submittingEnroll, setSubmittingEnroll] = useState(false);
  const [enrollFormData, setEnrollFormData] = useState({
    nombreCompleto: '',
    email: '',
    cedulaPrefix: 'V',
    cedulaRif: '',
    codigoPais: '+58',
    telefono: '',
    nivelProfesional: 'Nivel Profesional',
    esCorredorInmobiliario: true
  });

  const handleOpenEnrollModal = async () => {
    setIsEnrollModalOpen(true);
    setAfiliadoSearch('');
    setSelectedAfiliadoId('');
    setEnrollFormData({
      nombreCompleto: '',
      email: '',
      cedulaPrefix: 'V',
      cedulaRif: '',
      codigoPais: '+58',
      telefono: '',
      nivelProfesional: 'Nivel Profesional',
      esCorredorInmobiliario: true
    });

    try {
      const resAfil = await fetch(`${API_URL}/api/afiliados`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resAfil.ok) throw new Error(`HTTP error! status: ${resAfil.status}`);
      const jsonAfil = await resAfil.json();
      if (jsonAfil.success && Array.isArray(jsonAfil.data)) {
        setAfiliadosLista(jsonAfil.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAfiliado = (af: any) => {
    setSelectedAfiliadoId(String(af.id_afiliado || af.id));
    const nombre = [af.nombres, af.apellidos].filter(Boolean).join(' ') || af.razon_social || af.nombre || '';
    const rawCed = String(af.cedula || af.rif || '');
    const prefix = rawCed.includes('-') ? rawCed.split('-')[0].toUpperCase() : 'V';
    const numCed = rawCed.includes('-') ? rawCed.split('-')[1] : rawCed;
    const rawTel = String(af.telefono || af.telefono_movil || '');
    const codeTel = rawTel.startsWith('+') ? (rawTel.match(/^(\+\d{1,4})/)?.[1] || '+58') : '+58';
    const numTel = rawTel.replace(/^(\+\d{1,4}\s?)/, '');

    setEnrollFormData({
      nombreCompleto: nombre,
      email: af.email || '',
      cedulaPrefix: ['V', 'E', 'J', 'G', 'P'].includes(prefix) ? prefix : 'V',
      cedulaRif: numCed,
      codigoPais: codeTel,
      telefono: numTel,
      nivelProfesional: 'Nivel Profesional',
      esCorredorInmobiliario: true
    });
  };

  const handleSubmitEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollFormData.nombreCompleto.trim() || !enrollFormData.email.trim()) {
      Swal.fire('Atención', 'Nombre completo y correo electrónico son requeridos', 'warning');
      return;
    }

    const payload = {
      ...enrollFormData,
      cedulaRif: enrollFormData.cedulaRif ? `${enrollFormData.cedulaPrefix || 'V'}-${enrollFormData.cedulaRif.replace(/^[VEJGP]-?/i, '')}` : '',
      telefono: enrollFormData.telefono ? `${enrollFormData.codigoPais || '+58'} ${enrollFormData.telefono.replace(/^(\+\d{1,4}\s?)/, '')}` : ''
    };

    setSubmittingEnroll(true);
    try {
      const res = await fetch(`${API_URL}/api/academia/cursos/${curso.id_curso}/asignar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Error al inscribir estudiante');
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Error al inscribir estudiante');
      }

      Swal.fire('¡Estudiante Inscrito!', 'El estudiante ha sido inscrito correctamente en el curso.', 'success');
      setIsEnrollModalOpen(false);
      fetchRows();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al inscribir estudiante', 'error');
    } finally {
      setSubmittingEnroll(false);
    }
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ cursoId: curso.id_curso.toString(), estatus: 'Todos' });
      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [curso.id_curso, token]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ cursoId: curso.id_curso.toString(), estatus: 'Todos' });
        const json = await apiFetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!active) return;
        if (json.success) setRows(json.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [curso.id_curso, token]);

  const procesar = async (id: number, action: 'aprobar' | 'rechazar' | 'completar') => {
    try {
      const endpoint = action === 'aprobar' ? 'aprobar-directo' : action;
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: action === 'rechazar' ? JSON.stringify({ notaAdmin: '' }) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        Swal.fire({ title: 'Éxito', text: 'Estado actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
        fetchRows();
      } else {
        Swal.fire('Error', json.message || 'Error al procesar', 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Fallo de conexión', 'error');
    }
  };

  const handleDeleteInscripcion = async (idInscripcion: number, nombre: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar inscrito?',
      text: `¿Estás seguro de eliminar a "${nombre}" de este curso? Esta acción removerá el registro de inscripción.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      Swal.fire({
        title: 'Eliminando...',
        text: 'Por favor espera un momento.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await fetch(`${API_URL}/api/academia/inscripciones/${idInscripcion}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al eliminar');

      Swal.fire({
        title: '¡Inscrito Eliminado!',
        text: 'El participante fue eliminado exitosamente del curso.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });

      fetchRows();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo eliminar el inscrito', 'error');
    }
  };

  // Selecciones múltiples para acciones en lote
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map(r => r.id_inscripcion));
    }
  };

  const toggleSelectRow = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchGraduar = async () => {
    if (selectedIds.length === 0) return;
    const confirm = await Swal.fire({
      title: '¿Graduar seleccionados?',
      text: `Se graduará a los ${selectedIds.length} participantes seleccionados en este programa.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, graduar participantes',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    setIsProcessingBatch(true);
    Swal.fire({
      title: 'Procesando graduaciones...',
      text: `Graduando ${selectedIds.length} participantes...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/completar`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        if (res.ok) successCount++;
      }
      Swal.fire('¡Proceso Completado!', `Se graduó con éxito a ${successCount} participantes.`, 'success');
      setSelectedIds([]);
      fetchRows();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al graduar participantes', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchRevocar = async () => {
    if (selectedIds.length === 0) return;
    const confirm = await Swal.fire({
      title: '¿Revocar seleccionados?',
      text: `Se cambiará a estado revocado/rechazado la inscripción de ${selectedIds.length} participantes.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, revocar inscripciones',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    setIsProcessingBatch(true);
    Swal.fire({
      title: 'Revocando inscripciones...',
      text: `Procesando ${selectedIds.length} participantes...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/rechazar`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ notaAdmin: '' })
        });
        if (res.ok) successCount++;
      }
      Swal.fire('¡Proceso Completado!', `Se revocaron ${successCount} inscripciones.`, 'success');
      setSelectedIds([]);
      fetchRows();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al revocar inscripciones', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchEliminar = async () => {
    if (selectedIds.length === 0) return;
    const confirm = await Swal.fire({
      title: '¿Eliminar inscritos seleccionados?',
      text: `Se eliminarán permanentemente ${selectedIds.length} participantes del curso. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar permanentemente',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    setIsProcessingBatch(true);
    Swal.fire({
      title: 'Eliminando inscritos...',
      text: `Eliminando ${selectedIds.length} registros...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) successCount++;
      }
      Swal.fire('¡Eliminación Completada!', `Se eliminaron ${successCount} participantes.`, 'success');
      setSelectedIds([]);
      fetchRows();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al eliminar inscritos', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 flex-1 bg-white">
      {/* Header Premium */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-gray-200 text-slate-400 hover:text-[#00D084] hover:border-[#00D084] hover:shadow-lg hover:shadow-[#00D084]/10 transition-colors transition-transform active:scale-95 group"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-slate-900 text-lg sm:text-xl tracking-tight leading-none">{curso.titulo || curso.nombre}</h3>
              <span className="px-2 py-0.5 rounded-md bg-[#E9FAF4] text-[#00B870] text-[10px] font-black uppercase tracking-widest">Inscritos</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestión de participantes y admisiones</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenEnrollModal}
            className="flex items-center gap-2 bg-[#00D084] hover:bg-[#00B870] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md shadow-[#00D084]/20 transition-colors transition-transform active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Inscribir Estudiante</span>
          </button>

          {!(Number(curso.solo_informativo) === 1 || curso.solo_informativo === true || (curso.estatus as string) === 'Solo Informativo') && (
            <div className="hidden sm:flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Disponibilidad</span>
                <span className="text-sm font-bold text-slate-700 tabular-nums">
                  {getSafeNumber(curso.cupos_disponibles, 0)} <span className="text-slate-300 font-medium">/ {getSafeNumber(curso.cupos_totales, 0) >= 999999 ? '∞' : getSafeNumber(curso.cupos_totales, 0)}</span>
                </span>
              </div>
              <div className="w-px h-8 bg-gray-100 mx-1" />
              <div className="w-10 h-10 rounded-xl bg-[#E9FAF4] flex items-center justify-center text-[#00D084]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toolbar for Batch Actions */}
      {selectedIds.length > 0 && (
        <div className="mx-6 my-3 p-3 bg-white border border-[#00D084]/30 rounded-2xl flex items-center justify-between shadow-xl shadow-[#00D084]/10 animate-in fade-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#E9FAF4] text-[#00B870] font-black text-xs flex items-center justify-center border border-[#00D084]/20 shadow-xs">
              {selectedIds.length}
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 tracking-tight">
                {selectedIds.length === 1 ? '1 participante seleccionado' : `${selectedIds.length} participantes seleccionados`}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">Acciones disponibles para el lote</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchGraduar}
              disabled={isProcessingBatch}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9FAF4] text-[#00B870] hover:bg-[#D3F5E7] active:scale-95 text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#00D084]/20 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>Graduar ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={handleBatchRevocar}
              disabled={isProcessingBatch}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 active:scale-95 text-xs font-bold transition-all shadow-xs cursor-pointer border border-amber-200/60 disabled:opacity-50"
            >
              <XCircle size={14} />
              <span>Revocar ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={handleBatchEliminar}
              disabled={isProcessingBatch}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 text-xs font-bold transition-all shadow-xs cursor-pointer border border-rose-200/60 disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>Eliminar ({selectedIds.length})</span>
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Cancelar selección"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-auto bg-white">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-8 h-8 border-3 border-[#00D084] border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cargando lista...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 relative">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-300">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              </div>
            </div>
            <h4 className="text-lg font-bold text-slate-800 mb-2">Sin participantes registrados</h4>
            <p className="text-sm text-slate-400 max-w-xs mx-auto font-medium">Aún no se han recibido solicitudes de preinscripción para este programa académico.</p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                <tr>
                  <th className="px-4 py-4 text-center w-12">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-[#00D084] focus:ring-[#00D084] cursor-pointer accent-[#00D084]"
                      title="Seleccionar todos"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Participante</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Identificación</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Fecha Registro</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Estatus</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 tracking-widest uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => {
                  const isSelected = selectedIds.includes(r.id_inscripcion);
                  return (
                    <tr
                      key={r.id_inscripcion}
                      className={`transition-colors group ${isSelected ? 'bg-[#E9FAF4]/60' : 'hover:bg-slate-50/30'}`}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(r.id_inscripcion)}
                          className="w-4 h-4 rounded border-slate-300 text-[#00D084] focus:ring-[#00D084] cursor-pointer accent-[#00D084]"
                        />
                      </td>
                      <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#E9FAF4] text-[#00B870] flex items-center justify-center font-black text-xs shrink-0 border border-[#00D084]/10 shadow-sm">
                          {r.estudiante_nombre?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 leading-tight">{formatNombreCard(r.estudiante_nombre)}</span>

                          <span className="text-[10px] font-semibold text-slate-400 lowercase">{r.estudiante_email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 tabular-nums bg-gray-100 px-2 py-1 rounded-md">{r.estudiante_cedula || 'S/N'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 tabular-nums">
                      {new Date(r.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      {r.completado === 1 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Completado
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${r.estatus === 'Preinscrito' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          r.estatus === 'Inscrito' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            'bg-red-50 text-red-500 border-red-100'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.estatus === 'Preinscrito' ? 'bg-amber-500' :
                            r.estatus === 'Inscrito' ? 'bg-emerald-500' :
                              'bg-red-500'
                            }`} />
                          {r.estatus === 'Preinscrito' ? 'Pendiente' : r.estatus === 'Inscrito' ? 'Admitido' : r.estatus}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-transform transform translate-x-2 group-hover:translate-x-0">
                        {r.estatus === 'Preinscrito' && (
                          <>
                            <button onClick={() => procesar(r.id_inscripcion, 'aprobar')} className="px-3 py-2 bg-[#00D084] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#00B870] shadow-sm active:scale-95 transition-colors transition-transform">Validar</button>
                            <button onClick={() => procesar(r.id_inscripcion, 'rechazar')} className="px-3 py-2 bg-white text-red-500 border border-red-100 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors">Rechazar</button>
                          </>
                        )}
                        {r.estatus === 'Inscrito' && r.completado !== 1 && (
                          <>
                            <button onClick={() => procesar(r.id_inscripcion, 'completar')} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4" /></svg>
                              Graduar
                            </button>
                            <button onClick={() => procesar(r.id_inscripcion, 'rechazar')} className="px-3 py-2 border border-red-100 text-red-400 bg-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-colors">Revocar</button>
                          </>
                        )}
                        {r.completado === 1 && (
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Finalizado</span>
                        )}
                        <button
                          onClick={() => handleDeleteInscripcion(r.id_inscripcion, r.estudiante_nombre)}
                          className="p-2 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg transition-colors border border-rose-100 hover:border-rose-600 cursor-pointer shrink-0"
                          title="Eliminar participante del curso"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL INSCRIBIR ESTUDIANTE EN ESTE CURSO ── */}
      {isEnrollModalOpen && (
        <div className="transition-opacity fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E9FAF4] text-[#00B870] flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Inscribir en {curso.titulo || curso.nombre}</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Asignar estudiante directamente a este curso</p>
                </div>
              </div>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEnroll} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Tipo de Inscrito Switcher */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Origen del Estudiante *
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => { setEnrollMode('afiliado'); setSelectedAfiliadoId(''); }}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${enrollMode === 'afiliado'
                        ? 'bg-white text-[#00B870] shadow-xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Afiliado Existente</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEnrollMode('nuevo'); setSelectedAfiliadoId(''); }}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${enrollMode === 'nuevo'
                        ? 'bg-white text-[#00B870] shadow-xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Persona No Afiliada</span>
                    </button>
                  </div>
                </div>

                {/* Si elige Afiliado Existente */}
                {enrollMode === 'afiliado' && (
                  <div className="space-y-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 relative z-30">
                    <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">
                      Buscar en Directorio de Afiliados
                    </label>

                    <div className="relative">
                      {/* Buscador de Nómina de Afiliados al estilo Directorio de Miembros */}
                      <div className="relative flex items-center rounded-xl bg-white border border-emerald-200 focus-within:ring-2 focus-within:ring-[#00D084]/20 transition-colors text-xs h-10 shadow-xs z-30">
                        {/* Dropdown Criterion Selector */}
                        <div className="relative shrink-0 border-r border-emerald-100 h-full flex items-center pl-3 pr-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAfiliadoSearchDropdown(prev => !prev);
                            }}
                            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 hover:text-[#00B870] transition-colors"
                          >
                            <span>
                              {afiliadoSearchField === 'nombre' && 'Nombre'}
                              {afiliadoSearchField === 'cedula' && 'Cédula'}
                              {afiliadoSearchField === 'email' && 'Correo'}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-emerald-600 transition-transform ${showAfiliadoSearchDropdown ? 'rotate-180' : ''}`} />
                          </button>

                          {showAfiliadoSearchDropdown && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAfiliadoSearchDropdown(false);
                                }}
                              />
                              <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-emerald-200 rounded-xl shadow-xl py-1.5 z-50 min-w-[120px] fade-in slide-in-from-top-1 duration-150">
                                {[
                                  { key: 'nombre', label: 'Nombre' },
                                  { key: 'cedula', label: 'Cédula / RIF' },
                                  { key: 'email', label: 'Correo' },
                                ].map(option => (
                                  <button
                                    key={option.key}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAfiliadoSearchField(option.key as any);
                                      setShowAfiliadoSearchDropdown(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${afiliadoSearchField === option.key
                                      ? 'bg-[#E9FAF4] text-[#00B870] font-extrabold'
                                      : 'text-slate-600 hover:bg-slate-50'
                                      }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="relative flex-grow h-full flex items-center pr-2">
                          <Search className="w-3.5 h-3.5 text-emerald-600 ml-2 shrink-0" />
                          <input
                            type="text"
                            value={afiliadoSearch}
                            onChange={(e) => setAfiliadoSearch(e.target.value)}
                            placeholder={
                              afiliadoSearchField === 'nombre'
                                ? 'Buscar por nombre completo...'
                                : afiliadoSearchField === 'cedula'
                                  ? 'Buscar por cédula o RIF...'
                                  : 'Buscar por correo electrónico...'
                            }
                            className="w-full h-full pl-2 pr-6 bg-transparent text-slate-800 font-semibold placeholder-slate-400 outline-none text-xs"
                          />
                          {afiliadoSearch && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAfiliadoSearch(''); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lista filtrada de afiliados FLOTANTE / position absolute */}
                      {afiliadoSearch.trim().length > 0 && (
                        <div className="transition-opacity transition-transform absolute left-0 right-0 top-full mt-1.5 z-50 max-h-48 overflow-y-auto divide-y divide-emerald-100/60 bg-white rounded-2xl border border-emerald-200 shadow-2xl fade-in slide-in-from-top-1 duration-150">
                          {(Array.isArray(afiliadosLista) ? afiliadosLista : [])
                            .filter((af: any) => {
                              if (!af) return false;
                              const q = afiliadoSearch.toLowerCase();
                              const nombre = [af.nombres, af.apellidos, af.razon_social, af.nombre].filter(Boolean).join(' ').toLowerCase();
                              const cedula = String(af.cedula || af.rif || af.cedula_rif || '').toLowerCase();
                              const email = String(af.email || '').toLowerCase();

                              if (afiliadoSearchField === 'nombre') return nombre.includes(q);
                              if (afiliadoSearchField === 'cedula') return cedula.includes(q);
                              if (afiliadoSearchField === 'email') return email.includes(q);
                              return nombre.includes(q) || email.includes(q) || cedula.includes(q);
                            })
                            .slice(0, 8)
                            .map((af: any) => {
                              const nombre = [af.nombres, af.apellidos].filter(Boolean).join(' ') || af.razon_social || af.nombre || 'Sin nombre';
                              const isSel = String(af.id_afiliado || af.id) === selectedAfiliadoId;
                              return (
                                <button
                                  key={af.id_afiliado || af.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelectAfiliado(af);
                                    setAfiliadoSearch('');
                                  }}
                                  className={`w-full text-left p-3 text-xs flex items-center justify-between transition-colors ${isSel ? 'bg-[#E9FAF4] text-[#00B870] font-bold' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                  <div className="min-w-0">
                                    <p className="font-bold truncate">{nombre}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{af.email || 'Sin correo'} • C.I: {af.cedula || 'S/N'}</p>
                                  </div>
                                  {isSel && <CheckCircle2 className="w-4 h-4 text-[#00B870] shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Campos de datos del estudiante */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Nombre Completo del Estudiante *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. María Pérez"
                      value={enrollFormData.nombreCompleto}
                      onChange={(e) => setEnrollFormData({ ...enrollFormData, nombreCompleto: e.target.value })}
                      className="w-full text-xs font-semibold rounded-xl border border-gray-200 px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Correo Electrónico *
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={enrollFormData.email}
                        onChange={(e) => setEnrollFormData({ ...enrollFormData, email: e.target.value })}
                        className="w-full text-xs font-semibold rounded-xl border border-gray-200 px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Tipo y Cédula / RIF
                      </label>
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#00D084]/20 focus-within:border-[#00D084] transition-colors bg-white">
                        <select
                          value={enrollFormData.cedulaPrefix || 'V'}
                          onChange={(e) => setEnrollFormData({ ...enrollFormData, cedulaPrefix: e.target.value })}
                          className="bg-slate-50 border-r border-gray-200 px-2.5 text-xs font-black text-slate-700 outline-none cursor-pointer shrink-0"
                        >
                          <option value="V">V-</option>
                          <option value="E">E-</option>
                          <option value="J">J-</option>
                          <option value="G">G-</option>
                          <option value="P">P-</option>
                        </select>
                        <input
                          type="text"
                          placeholder="12345678"
                          value={enrollFormData.cedulaRif}
                          onChange={(e) => setEnrollFormData({ ...enrollFormData, cedulaRif: e.target.value.replace(/[^\d]/g, '') })}
                          className="w-full text-xs font-semibold px-3 py-2.5 text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Teléfono de Contacto
                    </label>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#00D084]/20 focus-within:border-[#00D084] transition-colors bg-white">
                      <select
                        value={enrollFormData.codigoPais || '+58'}
                        onChange={(e) => setEnrollFormData({ ...enrollFormData, codigoPais: e.target.value })}
                        className="bg-slate-50 border-r border-gray-200 px-2.5 text-xs font-black text-slate-700 outline-none cursor-pointer shrink-0 max-w-[110px]"
                      >
                        <option value="+58">🇻🇪 +58</option>
                        <option value="+57">🇨🇴 +57</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+34">🇪🇸 +34</option>
                        <option value="+52">🇲🇽 +52</option>
                        <option value="+56">🇨🇱 +56</option>
                        <option value="+54">🇦🇷 +54</option>
                        <option value="+51">🇵🇪 +51</option>
                        <option value="+593">🇪🇨 +593</option>
                        <option value="+507">🇵🇦 +507</option>
                        <option value="+1-809">🇩🇴 +1</option>
                      </select>
                      <input
                        type="text"
                        placeholder="0414-1234567"
                        value={enrollFormData.telefono}
                        onChange={(e) => setEnrollFormData({ ...enrollFormData, telefono: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2.5 text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEnroll}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#00D084] hover:bg-[#00B870] rounded-xl shadow-md shadow-[#00D084]/20 transition-colors transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingEnroll ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Inscribiendo...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Inscribir en {curso.titulo || curso.nombre}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CursosAdminPanel;

