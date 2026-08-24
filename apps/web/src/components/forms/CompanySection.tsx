import React from 'react'
import { useFormContext } from 'react-hook-form'
import { Building2, Mail, Phone } from 'lucide-react'
import { Input } from '@/components/ui/input'

const COUNTRIES = [
  { code: '+58', flag: '🇻🇪', label: 'Venezuela' },
  { code: '+1',  flag: '🇺🇸', label: 'USA' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia' },
  { code: '+5 Panama', flag: '🇵🇦', label: 'Panamá' },
  { code: '+1',  flag: '🇵🇷', label: 'Puerto Rico' },
]

export default function CompanySection() {
  const { register, formState: { errors } } = useFormContext()

  return (
    <div className="transition-opacity transition-transform space-y-6 fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 border-b border-white/5 pb-4">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Building2 className="text-emerald-400" size={20} />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-100">Datos de la Empresa</h3>
          <p className="text-[10px] text-emerald-100/40 font-medium uppercase tracking-widest mt-0.5">Información Legal de la Entidad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-2">
          <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.razonSocial ? 'text-red-400' : 'text-emerald-100/60'}`}>
            Razón Social <span className="text-emerald-500">*</span>
          </label>
          <Input 
            {...register('razonSocial')}
            placeholder="Ej. Inversiones Mendoza, C.A."
            icon={<Building2 size={16} />}
            className={errors.razonSocial ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
          />
          {errors.razonSocial && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.razonSocial.message as string}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.rifNumber ? 'text-red-400' : 'text-emerald-100/60'}`}>
              RIF de la Empresa <span className="text-emerald-500">*</span>
            </label>
            <div className="flex gap-2">
              <select 
                {...register('rifPrefix')}
                className="h-[58px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              >
                {['J', 'G', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <Input 
                {...register('rifNumber')}
                placeholder="000000000"
                className={errors.rifNumber ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
              />
            </div>
            {errors.rifNumber && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.rifNumber.message as string}</p>}
          </div>
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.emailEmpresa ? 'text-red-400' : 'text-emerald-100/60'}`}>
              Correo Corporativo <span className="text-emerald-500">*</span>
            </label>
            <Input 
              {...register('emailEmpresa')}
              type="email"
              placeholder="info@empresa.com"
              icon={<Mail size={16} />}
              className={errors.emailEmpresa ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
            />
            {errors.emailEmpresa && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.emailEmpresa.message as string}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${errors.telefonoEmpresa ? 'text-red-400' : 'text-emerald-100/60'}`}>
              Teléfono de la Empresa (Opcional)
            </label>
            <div className="flex gap-2">
              <select 
                {...register('phonePrefixEmpresa')}
                className="h-[58px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              >
                {COUNTRIES.map(c => <option key={`${c.code}-${c.label}`} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
              <Input 
                {...register('telefonoEmpresa')}
                placeholder="4XX 0000000"
                className={errors.telefonoEmpresa ? 'border-red-500 ring-2 ring-red-500/10' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
              />
            </div>
            {errors.telefonoEmpresa && <p className="transition-opacity transition-transform text-[10px] text-red-400 font-bold ml-1 uppercase fade-in slide-in-from-left-2 duration-300">{errors.telefonoEmpresa.message as string}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
