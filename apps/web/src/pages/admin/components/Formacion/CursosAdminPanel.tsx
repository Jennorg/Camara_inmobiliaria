import React, { useState, useEffect } from 'react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import { formatNombreCard } from '@/utils/formatters';
import { Calendar, Users, Pencil, Lock, Unlock } from 'lucide-react';

import { uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared';

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
    modulos: [{ nombre_modulo: 'Módulo General', id_profesor: null, orden: 0 }],
  });

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const fetchCursos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/academia/cursos`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) {
        setCursos(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfesores = async () => {
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
      console.error(e);
    } finally {
      setLoadingPersonas(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCursos();
      fetchProfesores();
    }
  }, [token]);

  const handleOpenModal = (curso?: CursoDB) => {
    fetchProfesores(); // Refresh list when modal opens
    if (curso) {
      setEditingId(curso.id_curso);
      setFormData({
        nombre: curso.nombre,
        descripcion: curso.descripcion || '',
        imagen_url: curso.imagen_url || '',
        cupos_totales: curso.cupos_totales,
        precio: curso.precio === 'Gratis' ? '0' : curso.precio?.replace('$', '').trim() || '0',
        fecha_inicio: curso.fecha_inicio || '',
        id_instructor: curso.id_instructor || 1,
        categoria: curso.categoria || 'Taller',
        estatus: (curso.estatus as any) || 'Abierto',
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

  const handleCreateProfesor = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const json = await res.json();
      if (json.success) {
        Swal.fire('Éxito', 'Profesor registrado correctamente', 'success');
        setIsProfModalOpen(false);
        // Reload professors
        const resProfs = await fetch(`${API_URL}/api/academia/profesores`, {
          headers: { Authorization: `Bearer ${token}` }
        });
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
        precio: finalPrice,
        nivel_academico: 'Libre'
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

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
      title: '¿Estás seguro?',
      text: "El curso cambiará a estado 'Cerrado' pero mantendrá su historial",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#00D084',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cerrar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/academia/cursos/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
          Swal.fire('Cerrado', 'El curso ahora está cerrado.', 'success');
          fetchCursos();
        } else {
          Swal.fire('Error', json.message || 'No se pudo cerrar el curso', 'error');
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
    <div className="p-4 sm:p-6 overflow-y-auto h-full relative">
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
                {c.cupos_totales >= 999999 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Cupos Ilimitados</span>
                    <span className="text-[10px] text-slate-500 ml-auto tabular-nums">{c.cupos_totales - c.cupos_disponibles} inscritos</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00D084] rounded-full" style={{ width: `${Math.max(0, Math.min(100, ((c.cupos_totales - c.cupos_disponibles) / c.cupos_totales) * 100))}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap tabular-nums">{(c.cupos_totales - c.cupos_disponibles)}/{c.cupos_totales} inscritos</span>
                  </div>
                )}
                <div className="flex gap-2 mt-2 border-t pt-2 border-gray-100 justify-end">
                  <button 
                    onClick={() => setViewingCurso(c)} 
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#00B870] bg-[#E9FAF4] hover:bg-[#D3F5E7] active:scale-95 rounded-xl transition-all shadow-sm shadow-[#00D084]/5"
                  >
                    <Users size={12} />
                    <span>Inscritos</span>
                  </button>
                  <button 
                    onClick={() => handleOpenModal(c)} 
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 rounded-xl transition-all shadow-sm"
                  >
                    <Pencil size={12} />
                    <span>Editar</span>
                  </button>
                  {c.estatus === 'Cerrado' ? (
                    <button 
                      onClick={() => handleToggleStatus(c)} 
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 rounded-xl transition-all shadow-sm"
                    >
                      <Unlock size={12} />
                      <span>Abrir</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleToggleStatus(c)} 
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 rounded-xl transition-all shadow-sm"
                    >
                      <Lock size={12} />
                      <span>Cerrar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50/60">
                  {['CURSO', 'INSTRUCTOR', 'INSCRITOS', 'FECHA INICIO', 'ACCIONES'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 tracking-wide uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cursos.map(c => {
                  const ins = c.cupos_totales - c.cupos_disponibles;
                  return (
                  <tr key={c.id_curso} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <p className="font-semibold text-slate-800 text-xs leading-tight max-w-[200px]">{c.titulo || c.nombre}</p>
                        {c.categoria && (
                          <span className="self-start text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">{c.categoria}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{c.instructor_nombre || 'Sin Instructor'}</td>
                    <td className="px-4 py-3">
                      {c.cupos_totales >= 999999 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Ilimitados</span>
                          <span className="text-xs text-slate-500 tabular-nums">({ins} inscritos)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full w-16 overflow-hidden">
                            <div className="h-full bg-[#00D084] rounded-full" style={{ width: `${Math.max(0, Math.min(100, (ins / c.cupos_totales) * 100))}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">{ins}/{c.cupos_totales}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : 'Por definir'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => setViewingCurso(c)} 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#00B870] bg-[#E9FAF4] hover:bg-[#D3F5E7] active:scale-95 rounded-xl transition-all shadow-sm shadow-[#00D084]/5"
                          title="Ver inscritos"
                        >
                          <Users size={12} />
                          <span>Inscritos</span>
                        </button>
                        <button 
                          onClick={() => handleOpenModal(c)} 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 rounded-xl transition-all shadow-sm"
                          title="Editar curso"
                        >
                          <Pencil size={12} />
                          <span>Editar</span>
                        </button>
                        {c.estatus === 'Cerrado' ? (
                          <button 
                            onClick={() => handleToggleStatus(c)} 
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 rounded-xl transition-all shadow-sm"
                            title="Reabrir inscripciones"
                          >
                            <Unlock size={12} />
                            <span>Abrir</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleToggleStatus(c)} 
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 rounded-xl transition-all shadow-sm"
                            title="Cerrar inscripciones"
                          >
                            <Lock size={12} />
                            <span>Cerrar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
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
                    className="relative group cursor-pointer border-2 border-dashed border-gray-200 rounded-2xl p-6 transition-all hover:border-[#00D084] hover:bg-[#E9FAF4]/50 flex flex-col items-center justify-center text-center gap-3 overflow-hidden"
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
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-slate-400 group-hover:text-[#00D084] group-hover:scale-110 transition-all">
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
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                      value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descripción del Programa</label>
                    <textarea 
                      rows={3}
                      placeholder="Describe los objetivos y alcances del curso..."
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all resize-none"
                      value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Categoría / Tipo de Actividad</label>
                      <select
                        required
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
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
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                      >
                        <option value="Abierto">Abierto (Recibiendo Inscripciones)</option>
                        <option value="Cerrado">Cerrado / Concluido</option>
                        <option value="En curso">En curso</option>
                        <option value="Próximamente">Próximamente</option>
                      </select>
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
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                      >
                        <option value="limitado">Definidos / Limitados</option>
                        <option value="ilimitado">Abierto / Ilimitados</option>
                      </select>
                    </div>
                    {formData.cupos_totales !== 999999 && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cantidad de Cupos</label>
                        <input type="number" required min="1"
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                          value={formData.cupos_totales} onChange={e => setFormData({...formData, cupos_totales: Number(e.target.value)})} 
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fecha de Inicio Estimada</label>
                    <input type="date" required
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
                      value={formData.fecha_inicio ? formData.fecha_inicio.substring(0, 10) : ''} onChange={e => setFormData({...formData, fecha_inicio: e.target.value})} 
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
                          <div key={index} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
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
                  <button type="button" onClick={handleCloseModal} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all active:scale-95">
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={uploading} 
                    className="px-8 py-2.5 text-sm font-bold text-white bg-[#00D084] hover:bg-[#00B870] rounded-xl transition-all shadow-lg shadow-[#00D084]/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
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
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[80vh]">
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
                className={`flex-grow py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  profRegisterMode === 'existente'
                    ? 'bg-[#E9FAF4] text-[#00B870] border-[#00D084]/20 shadow-sm'
                    : 'bg-white text-slate-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Persona Existente
              </button>
              <button
                type="button"
                onClick={() => setProfRegisterMode('nuevo')}
                className={`flex-grow py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  profRegisterMode === 'nuevo'
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
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all"
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
                <button type="button" onClick={() => setIsProfModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00D084] hover:bg-[#00B870] rounded-xl transition-all shadow-md shadow-[#00D084]/20"
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

  const fetchRows = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ cursoId: curso.id_curso.toString(), estatus: 'Todos' });
      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) setRows(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [curso.id_curso]);

  const procesar = async (id: number, action: 'aprobar' | 'rechazar' | 'completar') => {
    try {
      const endpoint = action === 'aprobar' ? 'aprobar-directo' : action;
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: action === 'rechazar' ? JSON.stringify({ notaAdmin: '' }) : undefined,
      });
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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Premium */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-gray-200 text-slate-400 hover:text-[#00D084] hover:border-[#00D084] hover:shadow-lg hover:shadow-[#00D084]/10 transition-all active:scale-95 group"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-slate-900 text-lg sm:text-xl tracking-tight leading-none">{curso.nombre}</h3>
              <span className="px-2 py-0.5 rounded-md bg-[#E9FAF4] text-[#00B870] text-[10px] font-black uppercase tracking-widest">Inscritos</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestión de participantes y admisiones</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Disponibilidad</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">
              {curso.cupos_disponibles} <span className="text-slate-300 font-medium">/ {curso.cupos_totales}</span>
            </span>
          </div>
          <div className="w-px h-8 bg-gray-100 mx-1" />
          <div className="w-10 h-10 rounded-xl bg-[#E9FAF4] flex items-center justify-center text-[#00D084]">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
        </div>
      </div>
      
      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white">
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
          <div className="h-full overflow-x-auto scrollbar-hide">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 sticky top-0 z-10 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Participante</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Identificación</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Fecha Registro</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 tracking-widest uppercase">Estatus</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 tracking-widest uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.id_inscripcion} className="hover:bg-slate-50/30 transition-colors group">
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
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          r.estatus === 'Preinscrito' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          r.estatus === 'Inscrito' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          'bg-red-50 text-red-500 border-red-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            r.estatus === 'Preinscrito' ? 'bg-amber-500' :
                            r.estatus === 'Inscrito' ? 'bg-emerald-500' :
                            'bg-red-500'
                          }`} />
                          {r.estatus === 'Preinscrito' ? 'Pendiente' : r.estatus === 'Inscrito' ? 'Admitido' : r.estatus}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                         {r.estatus === 'Preinscrito' && (
                           <>
                             <button onClick={() => procesar(r.id_inscripcion, 'aprobar')} className="px-3 py-2 bg-[#00D084] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#00B870] shadow-sm active:scale-95 transition-all">Validar</button>
                             <button onClick={() => procesar(r.id_inscripcion, 'rechazar')} className="px-3 py-2 bg-white text-red-500 border border-red-100 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">Rechazar</button>
                           </>
                         )}
                         {r.estatus === 'Inscrito' && r.completado !== 1 && (
                           <>
                             <button onClick={() => procesar(r.id_inscripcion, 'completar')} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-1.5">
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4" /></svg>
                               Graduar
                             </button>
                             <button onClick={() => procesar(r.id_inscripcion, 'rechazar')} className="px-3 py-2 border border-red-100 text-red-400 bg-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all">Revocar</button>
                           </>
                         )}
                         {r.completado === 1 && (
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Finalizado</span>
                         )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CursosAdminPanel;

