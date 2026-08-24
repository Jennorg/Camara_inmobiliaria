import React from 'react'
import { useFormContext } from 'react-hook-form'
import { UserCheck, User, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'

const COUNTRIES = [
  { code: '+58', flag: '🇻🇪', label: 'Venezuela' },
  { code: '+1',  flag: '🇺🇸', label: 'USA' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia' },
  { code: '+5 Panama', flag: '🇵🇦', label: 'Panamá' },
  { code: '+1',  flag: '🇵🇷', label: 'Puerto Rico' },
]

export default function RepresentativeSection() {
  const { register, formState: { errors } } = useFormContext()

  return (
    <div className="transition-opacity transition-transform space-y-6 fade-in slide-in-from-bottom-4 duration-500 delay-100">
      <div className="flex items-center gap-4 border-b border-white/5 pb-4">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <UserCheck className="text-emerald-400" size={20} />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-100">Representante Legal</h3>
          <p className="text-[10px] text-emerald-100/40 font-medium uppercase tracking-widest mt-0.5">Persona Autorizada</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.representanteNombres ? 'text-red-400' : 'text-emerald-100/60'}`}>
            Nombres <span className="text-emerald-500">*</span>
          </label>
          <Input 
            {...register('representanteNombres')}
            placeholder="Ej. Carlos"
            icon={<User size={16} />}
            className={errors.representanteNombres ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
          />
          {errors.representanteNombres && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.representanteNombres.message as string}</p>}
        </div>

        <div className="space-y-2">
          <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.representanteApellidos ? 'text-red-400' : 'text-emerald-100/60'}`}>
            Apellidos <span className="text-emerald-500">*</span>
          </label>
          <Input 
            {...register('representanteApellidos')}
            placeholder="Ej. Mendoza"
            icon={<User size={16} />}
            className={errors.representanteApellidos ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
          />
          {errors.representanteApellidos && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.representanteApellidos.message as string}</p>}
        </div>

        <div className="space-y-2">
          <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.cedulaRepresentante ? 'text-red-400' : 'text-emerald-100/60'}`}>
            Cédula <span className="text-emerald-500">*</span>
          </label>
          <div className="flex gap-2">
            <select 
              {...register('cedulaRepresentantePrefix')}
              className="h-[58px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:border-emerald-500 transition-colors"
            >
              {['V', 'E', 'P'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <Input 
              {...register('cedulaRepresentante')}
              placeholder="00000000"
              className={errors.cedulaRepresentante ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
            />
          </div>
          {errors.cedulaRepresentante && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.cedulaRepresentante.message as string}</p>}
        </div>

        <div className="space-y-2">
          <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.emailRepresentante ? 'text-red-400' : 'text-emerald-100/60'}`}>
            Correo Personal <span className="text-emerald-500">*</span>
          </label>
          <Input 
            {...register('emailRepresentante')}
            type="email"
            placeholder="carlos@empresa.com"
            icon={<Mail size={16} />}
            className={errors.emailRepresentante ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
          />
          {errors.emailRepresentante && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.emailRepresentante.message as string}</p>}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.telefono ? 'text-red-400' : 'text-emerald-100/60'}`}>
            Teléfono de Contacto <span className="text-emerald-500">*</span>
          </label>
          <div className="flex gap-2">
            <select 
              {...register('phonePrefix')}
              className="h-[58px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:border-emerald-500 transition-colors"
            >
              {COUNTRIES.map(c => <option key={`${c.code}-${c.label}`} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <Input 
              {...register('telefono')}
              placeholder="4XX 0000000"
              className={errors.telefono ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
            />
          </div>
          {errors.telefono && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.telefono.message as string}</p>}
        </div>
      </div>
    </div>
  )
}

function HashIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
    >
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  )
}
