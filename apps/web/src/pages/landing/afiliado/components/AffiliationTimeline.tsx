import React from 'react';
import { Check, ClipboardList, Mail, UserCheck, Calendar, Users, Award, CreditCard, ShieldCheck, GraduationCap } from 'lucide-react';

const STEPS = [
  { id: '1_PREINSCRIPCION', label: 'Preinscripción', icon: ClipboardList, desc: 'Solicitud inicial registrada' },
  { id: '2_EXPEDIENTE', label: 'Expediente', icon: Mail, desc: 'Carga de documentos y recaudos' },
  { id: '3_ENTREVISTA', label: 'Entrevista', icon: Calendar, desc: 'Cita con la comisión de admisión' },
  { id: '4_VERIFICACION', label: 'Verificación', icon: ShieldCheck, desc: 'Validación de referencias y datos' },
  { id: '5_CIBIR', label: 'CIBIR', icon: GraduationCap, desc: 'Validación de conocimientos inmobiliarios' },
  { id: '6_INSCRIPCION', label: 'Inscripción', icon: CreditCard, desc: 'Aprobación final y pago de arancel' },
  { id: 'Afiliado', label: 'Afiliación', icon: Check, desc: 'Miembro activo de la Cámara' },
];

interface AffiliationTimelineProps {
  currentStatus: string;
}

const AffiliationTimeline = ({ currentStatus }: AffiliationTimelineProps) => {
  const currentIndex = STEPS.findIndex(s => s.id === currentStatus);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Tu Proceso de Afiliación</h2>
          <p className="text-sm text-slate-400 font-medium">Sigue el progreso de tu solicitud en tiempo real.</p>
        </div>

        {/* Timeline Desktop */}
        <div className="hidden lg:flex items-start justify-between relative">
          {/* Connector Line */}
          <div className="absolute top-7 left-0 w-full h-1 bg-slate-100 -z-0 rounded-full" />
          <div 
            className="absolute top-7 left-0 h-1 bg-emerald-500 -z-0 rounded-full transition-all duration-1000"
            style={{ width: `${(activeIndex / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex flex-col items-center gap-4 relative z-10 w-full px-2 text-center">
                <div 
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                    isCompleted ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                    isCurrent ? 'bg-primary text-white shadow-emerald-900/20 scale-110' : 
                    'bg-white text-slate-300 border-2 border-slate-100'
                  }`}
                >
                  {isCompleted ? <Check size={24} strokeWidth={3} /> : <Icon size={24} />}
                </div>
                <div className="space-y-1">
                  <p className={`text-[11px] font-black uppercase tracking-wider ${isCurrent ? 'text-primary' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                    Paso {idx + 1}
                  </p>
                  <p className={`text-xs font-bold leading-tight ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Mobile/Tablet */}
        <div className="lg:hidden space-y-4">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const Icon = step.icon;

            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  isCurrent ? 'bg-emerald-50 border-emerald-100 ring-2 ring-emerald-500/10' : 
                  isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 
                  'bg-white border-slate-50 opacity-40'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-emerald-500 text-white' : 
                  isCurrent ? 'bg-primary text-white' : 
                  'bg-slate-100 text-slate-400'
                }`}>
                  {isCompleted ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Paso {idx + 1}</span>
                    {isCurrent && <span className="bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Actual</span>}
                  </div>
                  <h4 className={`text-sm font-bold ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</h4>
                  <p className="text-[11px] text-slate-400 font-medium">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Info Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-start gap-4">
           <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm flex-shrink-0">
              <ClipboardList size={20} />
           </div>
           <div>
              <h5 className="text-sm font-bold text-slate-800">Estado Actual: {STEPS[activeIndex]?.label || 'Procesando...'}</h5>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                {activeIndex === 6 
                  ? "¡Felicidades! Ya eres un miembro activo de la Cámara Inmobiliaria de Bolívar."
                  : `Tu solicitud está siendo procesada. Actualmente te encuentras en la etapa de ${(STEPS[activeIndex]?.label || '').toLowerCase()}. ${STEPS[activeIndex]?.desc || ''}.`
                }
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliationTimeline;
