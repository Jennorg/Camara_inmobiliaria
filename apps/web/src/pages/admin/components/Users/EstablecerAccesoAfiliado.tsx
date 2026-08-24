import React, { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, Search, ShieldCheck } from 'lucide-react'
import { API_URL } from '@/config/env'
import { AfiliadoDTO } from '@/types/afiliados'
import { formatNombreCard } from '@/utils/formatters'

type Props = {
  token: string | null
  /** Si se pasa, el formulario queda fijado a ese afiliado (p. ej. detalle en Afiliados). */
  afiliado?: AfiliadoDTO | null
  compact?: boolean
  onSuccess?: (msg: string) => void
}

export default function EstablecerAccesoAfiliado({ token, afiliado, compact, onSuccess }: Props) {
  const [afiliados, setAfiliados] = useState<AfiliadoDTO[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [pickedId, setPickedId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localMsg, setLocalMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    [token]
  )

  const selected = afiliado ?? afiliados.find(a => a.id_afiliado === pickedId) ?? null

  useEffect(() => {
    let active = true
    if (afiliado || !token) return
    const controller = new AbortController()

    const loadAfiliados = async () => {
      setLoadingList(true)
      try {
        const r = await fetch(`${API_URL}/api/afiliados`, {
          headers: authHeaders,
          signal: controller.signal
        })
        if (!r.ok) throw new Error('Error al cargar afiliados')
        const d = await r.json()
        if (!active || controller.signal.aborted) return
        if (d.success) setAfiliados(d.data as AfiliadoDTO[])
      } catch (err: unknown) {
        if (!active || controller.signal.aborted || (err as Error).name === 'AbortError') return
        console.error('Error al cargar afiliados para acceso:', err)
      } finally {
        if (active) setLoadingList(false)
      }
    }

    loadAfiliados()
    return () => {
      active = false
      controller.abort()
    }
  }, [afiliado, token, authHeaders])

  const [prevSelected, setPrevSelected] = useState(selected)
  if (prevSelected !== selected) {
    setPrevSelected(selected)
    if (selected) {
      const defaultEmail = selected.tipo_afiliado === 'Corporativo'
        ? (selected.empresa_email || selected.email || '')
        : (selected.email || '')
      setEmail(defaultEmail)
      setPassword('')
      setLocalMsg(null)
    }
  }

  const filteredPick = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return afiliados.slice(0, 40)
    return afiliados
      .filter(a => {
        const nombre = formatNombreCard(a.nombre_completo).toLowerCase()
        return (
          nombre.includes(q) ||
          (a.codigo?.toLowerCase().includes(q) ?? false) ||
          (a.email?.toLowerCase().includes(q) ?? false) ||
          String(a.id_afiliado).includes(q)
        )
      })
      .slice(0, 40)
  }, [afiliados, search])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !password) return
    setSaving(true)
    setLocalMsg(null)
    try {
      const r = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}/acceso-panel`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ password, email: email.trim() || undefined }),
      })
      if (!r.ok) throw new Error('Error al guardar acceso')
      const d = await r.json()
      if (d.success) {
        const msg = d.message as string
        setLocalMsg({ type: 'ok', text: msg })
        setPassword('')
        if (d.data?.email) setEmail(d.data.email)
        onSuccess?.(msg)
        if (!afiliado) {
          setAfiliados(prev =>
            prev.map(a =>
              a.id_afiliado === selected.id_afiliado ? { ...a, id_user: d.data?.userId ?? a.id_user } : a
            )
          )
        }
      } else {
        setLocalMsg({ type: 'err', text: d.message || 'No se pudo guardar el acceso' })
      }
    } catch {
      setLocalMsg({ type: 'err', text: 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  const tieneCuenta = Boolean(selected?.id_user)

  return (
    <form
      onSubmit={submit}
      className={`bg-white border border-slate-100 rounded-2xl shadow-sm ${
        compact ? 'p-4 space-y-3' : 'p-6 space-y-4'
      }`}
    >
      <div className='flex items-start gap-3'>
        <div className='w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0'>
          <KeyRound size={20} />
        </div>
        <div className='min-w-0 flex-1'>
          <h2 className={`font-black text-slate-800 ${compact ? 'text-sm' : 'text-base'}`}>
            Acceso al panel del afiliado
          </h2>
          <p className='text-xs text-slate-400 mt-0.5'>
            Define o actualiza la contraseña para que el afiliado pueda iniciar sesión de inmediato.
          </p>
        </div>
      </div>

      {!afiliado && (
        <div className='space-y-2'>
          <label className='block text-[10px] font-bold text-slate-400 uppercase tracking-wider'>
            Buscar afiliado
          </label>
          <div className='relative'>
            <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' />
            <input
              type='text'
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Nombre, código de afiliado o email...'
              className='w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-400'
            />
          </div>
          {loadingList ? (
            <p className='text-xs text-slate-400 flex items-center gap-2'>
              <Loader2 size={14} className='animate-spin' /> Cargando afiliados...
            </p>
          ) : (
            <select
              value={pickedId}
              onChange={e => setPickedId(e.target.value ? Number(e.target.value) : '')}
              className='w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700'
              required
            >
              <option value=''>Selecciona un afiliado...</option>
              {filteredPick.map(a => (
                <option key={a.id_afiliado} value={a.id_afiliado}>
                  {a.nombre_completo ? formatNombreCard(a.nombre_completo) : (a.email || a.empresa_email || 'Sin nombre')}
                  {a.codigo ? ` · ${a.codigo}` : ''}
                  {a.id_user ? ' · cuenta activa' : ' · sin cuenta'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {selected && (
        <>
          <div
            className={`rounded-xl px-3 py-2 text-xs font-medium border ${
              tieneCuenta
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-100'
            }`}
          >
            {tieneCuenta
              ? 'Este afiliado ya tiene cuenta vinculada. Al guardar solo se actualiza la contraseña.'
              : 'Sin cuenta vinculada. Se creará una cuenta de afiliado con el correo indicado.'}
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {selected.tipo_afiliado === 'Corporativo' && (
              <div className='space-y-1.5 sm:col-span-2'>
                <label className='block text-[10px] font-bold text-slate-400 uppercase'>Origen del correo de acceso</label>
                <div className='flex flex-col sm:flex-row gap-4 bg-slate-50 border border-slate-100 p-3 rounded-xl'>
                  <label className='flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600'>
                    <input
                      type='radio'
                      name='emailSource'
                      checked={email === (selected.email || '')}
                      onChange={() => setEmail(selected.email || '')}
                      className='text-emerald-600 focus:ring-emerald-500'
                    />
                    Correo Personal ({selected.email || 'no definido'})
                  </label>
                  {selected.empresa_email && (
                    <label className='flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600'>
                      <input
                        type='radio'
                        name='emailSource'
                        checked={email === (selected.empresa_email || '')}
                        onChange={() => setEmail(selected.empresa_email || '')}
                        className='text-emerald-600 focus:ring-emerald-500'
                      />
                      Correo de la Empresa ({selected.empresa_email})
                    </label>
                  )}
                </div>
              </div>
            )}
            <div className='space-y-1.5 sm:col-span-2'>
              <label className='block text-[10px] font-bold text-slate-400 uppercase'>Correo de acceso</label>
              <input
                type='email'
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className='w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400'
                placeholder='correo@ejemplo.com'
              />
            </div>
            <div className='space-y-1.5 sm:col-span-2'>
              <label className='block text-[10px] font-bold text-slate-400 uppercase'>Contraseña</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className='w-full rounded-xl border border-slate-100 bg-slate-50 pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-400'
                  placeholder='Mínimo 8 caracteres'
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-300 hover:text-emerald-500 focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {localMsg && (
            <p
              className={`text-xs font-medium px-3 py-2 rounded-lg ${
                localMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {localMsg.text}
            </p>
          )}

          <div className='flex justify-end'>
            <button
              type='submit'
              disabled={saving || !password}
              className='inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 disabled:opacity-50 w-full sm:w-auto'
            >
              {saving ? (
                <Loader2 size={14} className='animate-spin' />
              ) : (
                <ShieldCheck size={14} />
              )}
              {tieneCuenta ? 'Actualizar contraseña' : 'Crear acceso y contraseña'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
