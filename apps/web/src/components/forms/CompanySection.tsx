import React from 'react'
import { useFormContext } from 'react-hook-form'
import { Building2, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function CompanySection() {
  const { register, formState: { errors } } = useFormContext()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Razón Social</label>
          <Input 
            {...register('razonSocial')}
            placeholder="Ej. Inversiones Mendoza, C.A."
            icon={<Building2 size={16} />}
            className={errors.razonSocial ? 'border-red-500' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
          />
          {errors.razonSocial && <p className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.razonSocial.message as string}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">RIF de la Empresa</label>
            <div className="flex gap-2">
              <select 
                {...register('rifPrefix')}
                className="h-[58px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:border-emerald-500 transition-all"
              >
                {['J', 'G', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <Input 
                {...register('rifNumber')}
                placeholder="000000000"
                className={errors.rifNumber ? 'border-red-500' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
              />
            </div>
            {errors.rifNumber && <p className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.rifNumber.message as string}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Correo Corporativo</label>
            <Input 
              {...register('emailEmpresa')}
              type="email"
              placeholder="info@empresa.com"
              icon={<Mail size={16} />}
              className={errors.emailEmpresa ? 'border-red-500' : 'bg-white text-slate-800 border-slate-200 focus:border-emerald-500'}
            />
            {errors.emailEmpresa && <p className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.emailEmpresa.message as string}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
