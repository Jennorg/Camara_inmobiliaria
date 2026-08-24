import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Clock, Award } from 'lucide-react';
import { SkeletonCard } from '@/components/Skeleton';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import { apiFetch } from '@/lib/apiClient';

interface ModuloCurso {
  nombre_modulo: string;
  profesor?: string | null;
  estatus: string;
  fecha_evaluacion: string | null;
  nota_admin?: string | null;
}

interface MiCurso {
  id_inscripcion: number;
  programa_codigo: string | null;
  tipo_inscripcion: string;
  estatus: string;
  estatus_academico: string;
  completado: number;
  fecha_inscripcion: string;
  curso_nombre: string;
  nivel_academico: string | null;
  imagen_url: string | null;
  modulos?: ModuloCurso[];
  num_modulos?: number;
}

const WidgetMisCursos = () => {
  const [cursos, setCursos] = useState<MiCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;

    apiFetch(`${API_URL}/api/afiliados/me/cursos`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((json) => {
        if (!active) return;
        if (json.success) {
          // Excluir solo Cancelados y Rechazados
          const cursosActivos = json.data.filter((c: MiCurso) => c.estatus !== 'Cancelado' && c.estatus !== 'Rechazado');
          setCursos(cursosActivos);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Error fetching mis cursos:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  if (loading) {
    return (
      <DashboardCard title="Mis Cursos Actuales" icon={BookOpen}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </DashboardCard>
    );
  }

  if (cursos.length === 0) {
    return (
      <DashboardCard title="Mis Cursos y Programas" icon={BookOpen} description="Progreso de tus inscripciones actuales">
        <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-white border border-gray-100 rounded-2xl shadow-xs">
          <BookOpen size={48} className="text-gray-300 mb-4" />
          <p className="font-medium text-lg">No estás inscrito en ningún curso o programa.</p>
          <p className="text-sm mt-1">Cuando te preinscribas, aparecerá aquí tu progreso.</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Mis Cursos y Programas" icon={BookOpen} description="Progreso de tus inscripciones actuales">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cursos.map((curso) => (
          <div key={curso.id_inscripcion} className="flex flex-col border border-gray-100 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-colors bg-white relative">
            <div className="h-32 bg-gray-100 overflow-hidden relative">
              {curso.imagen_url ? (
                <img src={curso.imagen_url} alt={curso.curso_nombre} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-emerald-600 to-emerald-800 flex items-center justify-center">
                  <BookOpen className="text-white opacity-20" size={48} />
                </div>
              )}
              {/* Badge de Estatus */}
              <div className="absolute top-3 right-3">
                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm backdrop-blur-md bg-white/90 ${
                  curso.estatus_academico === 'Aprobado' ? 'text-green-700' :
                  curso.estatus_academico === 'Finalizado' ? 'text-green-700' :
                  curso.estatus_academico === 'Cursando' ? 'text-emerald-700' : 'text-slate-700'
                }`}>
                  {curso.estatus_academico}
                </span>
              </div>
            </div>

            <div className="p-5 flex flex-col flex-1">
              <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider mb-1">
                {curso.nivel_academico || 'Programa'}
              </span>
              <h4 className="font-bold text-[var(--color-text-base)] text-lg leading-tight mb-4">
                {curso.curso_nombre}
              </h4>

              {/* Lógica Especial para el CIBIR - Mostrar Módulos */}
              {curso.programa_codigo === 'CIBIR' && (
                <div className="mt-auto pt-4 border-t border-gray-50">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Progreso de Módulos (CIBIR)</h5>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(moduloNum => {
                      const modRecord = curso.modulos?.find(m => m.nombre_modulo === `Módulo ${moduloNum}` || m.nombre_modulo.startsWith(`Módulo ${moduloNum}:`));
                      const isAprobado = modRecord?.estatus === 'aprobado';
                      const cibirNombres = [
                        'Negocio de Bienes Raíces',
                        'Nociones Jurídicas',
                        'Comercialización Inmobiliaria',
                        'Hábitos y Buenas Prácticas',
                        'Principios de Valoración'
                      ];
                      const nombreMostrar = modRecord?.nombre_modulo || `Módulo ${moduloNum}: ${cibirNombres[moduloNum - 1]}`;
                      return (
                        <div key={moduloNum} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {isAprobado ? (
                              <CheckCircle size={16} className="text-green-500" />
                            ) : (
                              <Clock size={16} className="text-slate-300" />
                            )}
                            <span className={isAprobado ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                              {nombreMostrar}
                            </span>
                          </div>
                          {isAprobado && modRecord?.fecha_evaluacion && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(modRecord.fecha_evaluacion).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lógica para Cursos con Módulos (no CIBIR) */}
              {curso.programa_codigo !== 'CIBIR' && curso.modulos && curso.modulos.length > 0 && (
                <div className="mt-auto pt-4 border-t border-gray-50">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Progreso de Módulos</h5>
                  <div className="space-y-2">
                    {curso.modulos.map(mod => {
                      const estatusLower = mod.estatus?.toLowerCase();
                      const isAprobado = estatusLower === 'aprobado';
                      const isRechazado = estatusLower === 'rechazado';
                      return (
                        <div key={mod.nombre_modulo} className="flex flex-col gap-1 text-sm border-b border-slate-50 last:border-b-0 pb-1.5 last:pb-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isAprobado ? (
                                <CheckCircle size={15} className="text-green-500 shrink-0" />
                              ) : isRechazado ? (
                                <span className="w-3.5 h-3.5 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-black text-[9px] shrink-0 font-mono">!</span>
                              ) : (
                                <Clock size={15} className="text-slate-300 shrink-0" />
                              )}
                              <span className={[
                                'text-xs truncate font-semibold',
                                isAprobado ? 'text-slate-800' : isRechazado ? 'text-red-500 font-bold' : 'text-slate-400'
                              ].join(' ')}>
                                {mod.nombre_modulo} {mod.profesor ? `· Prof. ${mod.profesor}` : ''}
                              </span>
                            </div>
                            {isAprobado && mod.fecha_evaluacion && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(mod.fecha_evaluacion).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {isRechazado && mod.nota_admin && (
                            <p className="text-[10px] text-red-400 italic pl-5 leading-tight">
                              Nota: {mod.nota_admin}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {Number(curso.completado) === 1 && curso.programa_codigo !== 'CIBIR' && (
                <div className="mt-auto pt-4 border-t border-emerald-50">
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    <Award size={13} className="shrink-0" />
                    <p className="text-[11px] font-semibold">Curso aprobado · Ve a <strong>Mis Certificados</strong> para ver tu comprobante</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
};

export default WidgetMisCursos;
