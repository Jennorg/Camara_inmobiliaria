import React, { useState, useEffect } from 'react';
import { GraduationCap, ArrowRight, ChevronRight } from 'lucide-react';
import { SkeletonCard } from '@/components/Skeleton';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import Swal from 'sweetalert2';

interface CursoDB {
  id_curso: number;
  nombre: string;
  nivel_academico: string | null;
  precio: string | null;
  imagen_url: string | null;
  estatus: string;
  isFlagship?: boolean;
  codigo?: string;
}

const FLAGSHIP_PROGRAMS: CursoDB[] = [
  { 
    id_curso: -1, 
    nombre: 'PREANI', 
    nivel_academico: 'Estudios Avanzados', 
    precio: 'Consultar', 
    imagen_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800', 
    estatus: 'Activo',
    isFlagship: true,
    codigo: 'PREANI'
  },
  { 
    id_curso: -2, 
    nombre: 'PEGI', 
    nivel_academico: 'Especialización', 
    precio: 'Consultar', 
    imagen_url: 'https://images.unsplash.com/photo-1454165833767-12469a92c90b?auto=format&fit=crop&q=80&w=800', 
    estatus: 'Activo',
    isFlagship: true,
    codigo: 'PEGI'
  },
  { 
    id_curso: -3, 
    nombre: 'PADI', 
    nivel_academico: 'Actualización', 
    precio: 'Consultar', 
    imagen_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=800', 
    estatus: 'Activo',
    isFlagship: true,
    codigo: 'PADI'
  },
  { 
    id_curso: -4, 
    nombre: 'CIBIR', 
    nivel_academico: 'Gremial', 
    precio: 'Consultar', 
    imagen_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800', 
    estatus: 'Activo',
    isFlagship: true,
    codigo: 'CIBIR'
  }
];

interface WidgetAcademicoProps {
  onViewAll?: () => void;
  limit?: number;
}

const WidgetAcademico = ({ onViewAll, limit = 4 }: WidgetAcademicoProps) => {
  const [courses, setCourses] = useState<CursoDB[]>([]);
  const [enrolledCodes, setEnrolledCodes] = useState<string[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth(); // Para obtener info básica y prellenar modal

  useEffect(() => {
    // 1. Fetch catálogo
    const fetchCatalogo = fetch(`${API_URL}/api/public/cursos`).then(res => res.json());
    
    // 2. Fetch inscripciones del usuario si está logueado
    const fetchInscripciones = token 
      ? fetch(`${API_URL}/api/afiliados/me/cursos`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json())
      : Promise.resolve({ success: true, data: [] });

    Promise.all([fetchCatalogo, fetchInscripciones])
      .then(([catalogoJson, inscripcionesJson]) => {
        if (catalogoJson.success) {
          const dynamicCourses = catalogoJson.data;
          const combined = [...FLAGSHIP_PROGRAMS, ...dynamicCourses];
          setCourses(limit > 0 ? combined.slice(0, limit) : combined);
        }
        
        if (inscripcionesJson.success && inscripcionesJson.data) {
          const codes = inscripcionesJson.data
            .filter((c: any) => c.programa_codigo)
            .map((c: any) => c.programa_codigo);
          const ids = inscripcionesJson.data
            .filter((c: any) => c.id_curso)
            .map((c: any) => c.id_curso);
          setEnrolledCodes(codes);
          setEnrolledCourseIds(ids);
        }
      })
      .catch(() => {
        setCourses(FLAGSHIP_PROGRAMS);
      })
      .finally(() => setLoading(false));
  }, [limit, token]);

  const handleInscribir = (curso: CursoDB) => {
    const processInscripcion = (nombre: string, email: string) => {
      const url = curso.isFlagship 
        ? `${API_URL}/api/public/preinscripciones`
        : `${API_URL}/api/public/cursos/${curso.id_curso}/preinscribir`;

      const body = curso.isFlagship
        ? {
            programaCodigo: curso.codigo,
            nombreCompleto: nombre,
            email: email,
            cedulaRif: '—', 
            telefono: '—',
            nivelProfesional: 'No especificado',
            esCorredorInmobiliario: false
          }
        : {
            nombreCompleto: nombre,
            email: email
          };

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          Swal.fire('¡Solicitud enviada!', json.message || 'Te contactaremos pronto.', 'success');
        } else {
          Swal.fire('Atención', json.message || 'Hubo un error al procesar tu solicitud.', 'warning');
        }
      })
      .catch(() => {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
      });
    };

    if (user?.email) {
      // Usuario logueado: No pedir datos, solo confirmar
      Swal.fire({
        title: `¿Inscribirse en ${curso.nombre}?`,
        text: `Usaremos los datos de tu cuenta (${user.email}) para la preinscripción.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, inscribirme',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#00D084',
      }).then((result) => {
        if (result.isConfirmed) {
          const nombreFallback = user.email.split('@')[0];
          processInscripcion(nombreFallback, user.email);
        }
      });
    } else {
      // Usuario no logueado: Pedir datos
      Swal.fire({
        title: `Preinscripción a: ${curso.nombre}`,
        text: 'Por favor confirma tus datos de contacto básicos.',
        icon: 'info',
        html: `
          <div class="text-left mt-3">
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Nombre Completo</label>
            <input id="swal-nombre" class="w-full border rounded p-2 mb-3" placeholder="Tu nombre">
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Correo Electrónico</label>
            <input id="swal-email" type="email" class="w-full border rounded p-2" placeholder="tu@email.com">
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Formalizar Inscripción',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#00D084',
        preConfirm: () => {
          const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value;
          const email = (document.getElementById('swal-email') as HTMLInputElement).value;
          if (!nombre || !email) {
            Swal.showValidationMessage('Nombre y correo son requeridos');
            return false;
          }
          return { nombre, email };
        }
      }).then((result) => {
        if (result.isConfirmed) {
          processInscripcion(result.value.nombre, result.value.email);
        }
      });
    }
  };

  return (
    <DashboardCard
      title="Catálogo Académico Destacado"
      icon={GraduationCap}
      actionText="Ver todo el catálogo"
      actionIcon={ArrowRight}
      onAction={onViewAll}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 py-2 min-h-[12rem]">
        {loading ? (
          Array.from({ length: limit > 0 ? limit : 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : courses.length === 0 ? (
          <div className="col-span-full flex items-center justify-center p-10"><span className="text-sm font-semibold text-slate-400">Pronto se anunciarán nuevos cursos.</span></div>
        ) : (
          courses.map((course) => {
            const isEnrolled = course.isFlagship 
              ? enrolledCodes.includes(course.codigo!)
              : enrolledCourseIds.includes(course.id_curso);

            return (
            <div 
              key={course.id_curso} 
              className={`group ${isEnrolled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`} 
              onClick={() => !isEnrolled && handleInscribir(course)}
            >
              <div
                className="relative h-44 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center"
                style={{ border: '1px solid var(--color-border-accent)' }}
              >
                {course.imagen_url ? (
                  <img
                    src={course.imagen_url}
                    alt={course.nombre}
                    className={`w-full h-full object-cover transition-transform duration-500 ${!isEnrolled && 'group-hover:scale-110'}`}
                  />
                ) : (
                  <GraduationCap className={`text-gray-300 w-16 h-16 transition-transform duration-500 ${!isEnrolled && 'group-hover:scale-110'}`} />
                )}
                {/* Overlay */}
                {!isEnrolled && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(to top, var(--color-primary) 0%, transparent 60%)` }}
                  />
                )}
                {/* Badge Status */}
                {course.estatus === 'Próximamente' && (
                  <div
                    className="absolute top-3 left-3 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg bg-blue-500"
                  >
                    Próximamente
                  </div>
                )}
                {/* Badge Enrolled */}
                {isEnrolled && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <span className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                      Ya Inscrito
                    </span>
                  </div>
                )}
                {/* Price */}
                <div className="absolute bottom-3 right-3 text-white font-black text-sm drop-shadow-md bg-black/40 px-2 py-0.5 rounded">
                  {course.precio || 'Gratis'}
                </div>
              </div>

              <div className="mt-3">
                <span
                  className="text-[9px] font-bold uppercase tracking-widest mb-1 block"
                  style={{ color: 'var(--color-accent-hover)' }}
                >
                  {course.nivel_academico || 'Libre'}
                </span>
                <h4
                  className="font-extrabold text-sm leading-tight transition-colors"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {course.nombre}
                </h4>
                {!isEnrolled && (
                  <div
                    className="mt-3 flex items-center text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0"
                    style={{ color: 'var(--color-accent-hover)' }}
                  >
                    Formalizar Inscripción <ChevronRight size={12} className="ml-1" />
                  </div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
    </DashboardCard>
  );
};

export default WidgetAcademico;
