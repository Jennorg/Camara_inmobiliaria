import React from 'react';
import { UserPlus, ShieldCheck } from 'lucide-react';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import PreinscripcionProgramaForm from '@/pages/landing/components/PreinscripcionProgramaForm';
import { useAuth } from '@/context/AuthContext';
import { formatNombreCard } from '@/utils/formatters';

const WidgetSolicitudAfiliacion = () => {
  const { user } = useAuth();

  return (
    <DashboardCard
      title="Solicitud de Afiliación"
      icon={UserPlus}
    >
      <div className="flex flex-col lg:flex-row gap-8 items-start py-4">
        <div className="flex-1 space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
            <div className="flex items-center gap-3 text-emerald-700 mb-3">
              <ShieldCheck size={24} />
              <h3 className="font-black uppercase tracking-tight text-lg">Gremialízate con Nosotros</h3>
            </div>
            <p className="text-sm text-emerald-800/80 leading-relaxed font-medium">
              Como estudiante aprobado, ya eres parte de nuestra comunidad. Al afiliarte formalmente a la Cámara Inmobiliaria de Bolívar obtendrás:
            </p>
            <ul className="mt-4 space-y-2 text-xs font-bold text-emerald-900/70">
              <li className="flex items-center gap-2">• Código CIBIR de identificación gremial.</li>
              <li className="flex items-center gap-2">• Descuentos exclusivos en todos nuestros cursos.</li>
              <li className="flex items-center gap-2">• Acceso a la bolsa inmobiliaria regional.</li>
              <li className="flex items-center gap-2">• Respaldo institucional y ético.</li>
            </ul>
          </div>
          
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2">
            Hemos pre-llenado algunos datos de tu cuenta de formación para agilizar tu solicitud.
          </p>
        </div>

        <div className="flex-1 w-full bg-slate-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-white/5">
          <PreinscripcionProgramaForm 
            programaCodigo="AFILIACION" 
            ctaLabel="Enviar Solicitud de Afiliación"
            initialData={{
              email: user?.email || '',
              nombreCompleto: formatNombreCard(user?.nombre_completo) || '',
              cedulaRif: user?.cedula || '',
              telefono: user?.telefono || '',
              nivelProfesional: user?.nivel_profesional || '',
              esCorredorInmobiliario: user?.es_corredor_inmobiliario
            }}
          />
        </div>
      </div>
    </DashboardCard>
  );
};

export default WidgetSolicitudAfiliacion;
