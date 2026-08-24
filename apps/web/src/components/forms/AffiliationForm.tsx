import React, { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Check, Loader2, ArrowRight, Info, AlertCircle } from 'lucide-react'
import CompanySection from './CompanySection'
import RepresentativeSection from './RepresentativeSection'
import { Button } from '@/components/ui/button'
import { apiUrl } from '@/config/env'

const affiliationSchema = z.object({
  razonSocial: z.string().min(3, 'La razón social es muy corta'),
  rifPrefix: z.string(),
  rifNumber: z.string().min(7, 'RIF inválido'),
  emailEmpresa: z.string().email('Email corporativo inválido'),
  phonePrefixEmpresa: z.string().optional(),
  telefonoEmpresa: z.string().optional(),
  representanteNombres: z.string().min(2, 'Nombre muy corto'),
  representanteApellidos: z.string().min(2, 'Apellido muy corto'),
  cedulaRepresentantePrefix: z.string(),
  cedulaRepresentante: z.string().min(6, 'Cédula inválida'),
  emailRepresentante: z.string().email('Email personal inválido'),
  phonePrefix: z.string(),
  telefono: z.string().min(7, 'Teléfono inválido'),
})

type AffiliationValues = z.infer<typeof affiliationSchema>

interface Props {
  programaCodigo: string
  onSuccess?: () => void
}

export default function AffiliationForm({ programaCodigo, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const methods = useForm<AffiliationValues>({
    resolver: zodResolver(affiliationSchema),
    defaultValues: {
      rifPrefix: 'J',
      cedulaRepresentantePrefix: 'V',
      phonePrefix: '+58',
    }
  })

  const onSubmit = async (data: AffiliationValues) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const body = {
        programaCodigo,
        tipoAfiliado: 'Corporativo',
        nombreCompleto: data.razonSocial.trim(),
        razonSocial: data.razonSocial.trim(),
        rif_tipo: data.rifPrefix,
        rif_numero: data.rifNumber.replace(/\D/g, ''),
        cedulaRif: `${data.rifPrefix}-${data.rifNumber.replace(/\D/g, '')}`,
        email: data.emailEmpresa,
        telefono: `${data.phonePrefix}${data.telefono.replace(/\D/g, '')}`,
        empresaTelefono: data.telefonoEmpresa ? `${data.phonePrefixEmpresa || data.phonePrefix || '+58'}${data.telefonoEmpresa.replace(/\D/g, '')}` : null,
        representanteLegal: `${data.representanteNombres} ${data.representanteApellidos}`.trim(),
        representanteLegalNombres: data.representanteNombres.trim(),
        representanteLegalApellidos: data.representanteApellidos.trim(),
        cedulaRepresentante: `${data.cedulaRepresentantePrefix}-${data.cedulaRepresentante.replace(/\D/g, '')}`,
        emailRepresentante: data.emailRepresentante.trim(),
      }

      const res = await fetch(apiUrl('/api/public/preinscripciones'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al registrar')
      
      const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV || import.meta.env.VITE_NODE_ENV === 'development'
      if (isDev && json.data?.token) {
        window.location.href = `/cursos/verificar?token=${json.data.token}`
        return
      }

      setSubmitted(true)
      onSuccess?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar'
      setErrorMsg(
        msg === 'Failed to fetch'
          ? 'No se pudo establecer conexión con el servidor. Por favor, compruebe su conexión a internet e inténtelo de nuevo.'
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="transition-opacity transition-transform text-center py-24 px-6 fade-in zoom-in duration-700">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-10 ring-1 ring-emerald-500/30 shadow-2xl shadow-emerald-500/20 backdrop-blur-md">
          <Check className="text-emerald-400" size={48} strokeWidth={3} />
        </div>
        <h3 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter italic leading-none">
          ¡Solicitud <span className="text-emerald-500">Recibida</span>!
        </h3>
        <p className="text-emerald-100/40 max-w-md mx-auto leading-relaxed font-medium text-base">
          Hemos recibido los datos de su institución con éxito. Un asesor de la Cámara revisará la información y le contactará vía correo electrónico para formalizar la afiliación.
        </p>
        <div className="mt-12 pt-8 border-t border-white/5 max-w-xs mx-auto">
          <p className="text-[10px] uppercase tracking-[0.4em] font-black text-white/10">
            Cámara Inmobiliaria • 2026
          </p>
        </div>
      </div>
    )
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-12 pb-10">
        {/* Modal informativo del flujo corporativo */}
        {/* <div className="flex items-start gap-4 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left shadow-lg shadow-emerald-500/5">
          <div className="bg-emerald-500 rounded-lg p-1.5 mt-0.5 shadow-lg shadow-emerald-500/20">
            <Info size={16} className="text-white" />
          </div>
          <p className="text-xs leading-relaxed text-emerald-100/80">
            <span className="font-black text-emerald-300 block mb-1 uppercase tracking-widest text-[10px]">Importante: Flujo Corporativo</span>
            Al registrar su empresa, podrá gestionar las afiliaciones de sus empleados y corredores asociados de manera centralizada.
          </p>
        </div> */}

        <div className="flex flex-col gap-10 items-stretch">
          <CompanySection />
          <RepresentativeSection />
        </div>

        <div className="flex flex-col gap-6 pt-4">
          {/* Leyenda de campos requeridos */}
          <div className="flex justify-end">
            <p className="text-[10px] text-emerald-100/40 font-bold uppercase tracking-widest">
              <span className="text-emerald-500">*</span> Campos obligatorios
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <div className="flex items-center gap-3">
                <span>Confirmar Registro de Empresa</span>
                <ArrowRight size={16} />
              </div>
            )}
          </Button>

          {/* Mensaje de error general de validación */}
          {Object.keys(methods.formState.errors).length > 0 && methods.formState.submitCount > 0 && (
            <div className="transition-transform flex items-center gap-3 text-amber-100 bg-amber-500/20 border border-amber-400/40 p-5 rounded-2xl text-xs font-bold justify-center slide-in-from-top-2 duration-300">
              <AlertCircle size={18} className="text-amber-400" />
              Por favor, complete todos los campos obligatorios marcados en rojo.
            </div>
          )}

          {errorMsg && (
            <div className="transition-transform flex items-center gap-3 text-white bg-red-600 border border-red-700 p-5 rounded-2xl text-xs font-bold justify-center shadow-md shadow-red-600/20 slide-in-from-top-2 duration-300">
              <AlertCircle size={18} className="text-white shrink-0" />
              {errorMsg}
            </div>
          )}

          <p className="text-[10px] text-center uppercase tracking-[0.3em] font-black text-white/20 mt-4">
            Cámara Inmobiliaria • Protocolo de Afiliación 2026
          </p>
        </div>
      </form>
    </FormProvider>
  )
}
