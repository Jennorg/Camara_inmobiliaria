import { Request, Response } from 'express'
import { db } from '../lib/db.js'

export const getAnalyticsData = async (req: Request, res: Response): Promise<void> => {
  try {
    const results = await db.batch([
      // 0. Afiliados activos
      "SELECT COUNT(*) as c FROM afiliados WHERE estatus = 'Afiliado'",
      // 1. Solicitudes pendientes en proceso
      "SELECT COUNT(*) as c FROM afiliados WHERE estatus IN ('1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA','4_VERIFICACION','5_CIBIR','6_INSCRIPCION') AND NOT (tipo_afiliado = 'Agente Corporativo' AND estatus = '1_PREINSCRIPCION')",
      // 2. Afiliados rechazados
      "SELECT COUNT(*) as c FROM afiliados WHERE estatus = 'Rechazado'",
      // 3. CIBIR distribución
      `SELECT
         SUM(CASE WHEN estatus = 'aprobado' THEN 1 ELSE 0 END) as aprobado,
         SUM(CASE WHEN estatus = 'pendiente' THEN 1 ELSE 0 END) as pendiente,
         SUM(CASE WHEN estatus = 'rechazado' THEN 1 ELSE 0 END) as rechazado
       FROM acreditaciones_cibir`,
      // 4. PREANI distribución
      `SELECT
         SUM(CASE WHEN estatus IN ('Inscrito', 'Pagado') THEN 1 ELSE 0 END) as aprobado,
         SUM(CASE WHEN estatus IN ('Preinscrito', 'Entrevista') THEN 1 ELSE 0 END) as pendiente,
         SUM(CASE WHEN estatus IN ('Rechazado', 'Cancelado') THEN 1 ELSE 0 END) as rechazado
       FROM inscripciones_cursos WHERE programa_codigo = 'PREANI' AND id_curso IS NULL`,
      // 5. PEGI distribución
      `SELECT
         SUM(CASE WHEN estatus IN ('Inscrito', 'Pagado') THEN 1 ELSE 0 END) as aprobado,
         SUM(CASE WHEN estatus IN ('Preinscrito', 'Entrevista') THEN 1 ELSE 0 END) as pendiente,
         SUM(CASE WHEN estatus IN ('Rechazado', 'Cancelado') THEN 1 ELSE 0 END) as rechazado
       FROM inscripciones_cursos WHERE programa_codigo = 'PEGI' AND id_curso IS NULL`,
      // 6. PADI distribución
      `SELECT
         SUM(CASE WHEN estatus IN ('Inscrito', 'Pagado') THEN 1 ELSE 0 END) as aprobado,
         SUM(CASE WHEN estatus IN ('Preinscrito', 'Entrevista') THEN 1 ELSE 0 END) as pendiente,
         SUM(CASE WHEN estatus IN ('Rechazado', 'Cancelado') THEN 1 ELSE 0 END) as rechazado
       FROM inscripciones_cursos WHERE programa_codigo = 'PADI' AND id_curso IS NULL`,
      // 7. Embudo de admisión (candidatos activos por etapa)
      "SELECT estatus as label, COUNT(*) as value FROM afiliados WHERE estatus NOT IN ('Afiliado', 'Rechazado') GROUP BY estatus",
      // 8. Tipos de afiliados activos
      "SELECT tipo_afiliado as label, COUNT(*) as value FROM afiliados WHERE estatus = 'Afiliado' GROUP BY tipo_afiliado",
      // 9. Notificaciones recientes
      "SELECT creado_en, titulo, mensaje, tipo FROM notificaciones ORDER BY creado_en DESC LIMIT 10",
      // 10. Afiliados con cédula pendiente
      `SELECT COUNT(DISTINCT a.id_afiliado) as c 
       FROM afiliados a 
       JOIN personas p ON a.id_persona = p.id 
       WHERE p.cedula IS NULL 
          OR TRIM(p.cedula) = '' 
          OR LOWER(p.cedula) LIKE '%ndint%' 
          OR LOWER(p.cedula) LIKE '%pendiente%'`,
      // 11. Afiliados con RIF pendiente
      `SELECT COUNT(DISTINCT a.id_afiliado) as c 
       FROM afiliados a 
       JOIN empresas e ON a.id_empresa = e.id_empresa 
       WHERE e.rif_numero IS NULL 
          OR TRIM(e.rif_numero) = '' 
          OR LOWER(e.rif_numero) LIKE '%pendiente%' 
          OR LOWER(e.rif_numero) LIKE '%ndint%'`,
      // 12. Afiliados con Email pendiente
      `SELECT COUNT(DISTINCT a.id_afiliado) as c 
       FROM afiliados a 
       JOIN personas p ON a.id_persona = p.id 
       LEFT JOIN empresas e ON a.id_empresa = e.id_empresa 
       WHERE p.email IS NULL OR TRIM(p.email) = '' OR LOWER(p.email) LIKE '%pendiente%'`,
      // 13. Total afiliados
      `SELECT COUNT(*) as c FROM afiliados`,
      // 14. Afiliados únicos con al menos un dato pendiente (Cédula, RIF, Email, Teléfono o Foto)
      `SELECT COUNT(DISTINCT a.id_afiliado) as c 
       FROM afiliados a 
       JOIN personas p ON a.id_persona = p.id 
       LEFT JOIN empresas e ON a.id_empresa = e.id_empresa 
       WHERE (p.cedula IS NULL OR TRIM(p.cedula) = '' OR LOWER(p.cedula) LIKE '%ndint%' OR LOWER(p.cedula) LIKE '%pendiente%')
          OR (a.id_empresa IS NOT NULL AND (e.rif_numero IS NULL OR TRIM(e.rif_numero) = '' OR LOWER(e.rif_numero) LIKE '%pendiente%' OR LOWER(e.rif_numero) LIKE '%ndint%'))
          OR (p.email IS NULL OR TRIM(p.email) = '' OR LOWER(p.email) LIKE '%pendiente%')
          OR (p.telefono IS NULL OR TRIM(p.telefono) = '' OR LOWER(p.telefono) LIKE '%pendiente%')
          OR (p.foto_url IS NULL OR TRIM(p.foto_url) = '' OR LOWER(p.foto_url) LIKE '%pendiente%')`,
      // 15. Afiliados Corporativos con Logo cargado
      `SELECT COUNT(DISTINCT a.id_afiliado) as c 
       FROM afiliados a 
       JOIN empresas e ON a.id_empresa = e.id_empresa 
       WHERE a.tipo_afiliado = 'Corporativo' 
         AND e.logo_url IS NOT NULL 
         AND e.logo_url != ''`,
      // 16. Total Afiliados Corporativos
      `SELECT COUNT(*) as c FROM afiliados WHERE tipo_afiliado = 'Corporativo'`,
      // 17. Teléfono pendiente
      `SELECT COUNT(DISTINCT a.id_afiliado) as c 
       FROM afiliados a 
       JOIN personas p ON a.id_persona = p.id 
       LEFT JOIN empresas e ON a.id_empresa = e.id_empresa 
       WHERE (p.telefono IS NULL OR TRIM(p.telefono) = '' OR LOWER(p.telefono) LIKE '%pendiente%')
         AND (a.id_empresa IS NULL OR e.telefono IS NULL OR TRIM(e.telefono) = '' OR LOWER(e.telefono) LIKE '%pendiente%')`,
      // 18. Foto de perfil pendiente
      `SELECT COUNT(DISTINCT a.id_afiliado) as c 
       FROM afiliados a 
       JOIN personas p ON a.id_persona = p.id 
       WHERE p.foto_url IS NULL OR TRIM(p.foto_url) = '' OR LOWER(p.foto_url) LIKE '%pendiente%'`
    ])

    // 0 - Afiliados activos
    const totalActivos = Number(results[0].rows[0]?.c || 0)

    // 1 - Pendientes
    const solicitudesPendientes = Number(results[1].rows[0]?.c || 0)

    // 2 - Rechazados
    const totalRechazados = Number(results[2].rows[0]?.c || 0)

    // 3 - CIBIR
    const cibirRow = results[3].rows[0] as any
    const cibirAprobados  = Number(cibirRow?.aprobado  || 0)
    const cibirPendientes = Number(cibirRow?.pendiente || 0)
    const cibirRechazados = Number(cibirRow?.rechazado || 0)

    // 4 - PREANI
    const preaniRow = results[4].rows[0] as any
    const preaniAprobados  = Number(preaniRow?.aprobado  || 0)
    const preaniPendientes = Number(preaniRow?.pendiente || 0)
    const preaniRechazados = Number(preaniRow?.rechazado || 0)

    // 5 - PEGI
    const pegiRow = results[5].rows[0] as any
    const pegiAprobados  = Number(pegiRow?.aprobado  || 0)
    const pegiPendientes = Number(pegiRow?.pendiente || 0)
    const pegiRechazados = Number(pegiRow?.rechazado || 0)

    // 6 - PADI
    const padiRow = results[6].rows[0] as any
    const padiAprobados  = Number(padiRow?.aprobado  || 0)
    const padiPendientes = Number(padiRow?.pendiente || 0)
    const padiRechazados = Number(padiRow?.rechazado || 0)

    // 7 - Embudo de admisión
    const EMBUDO_LABELS: Record<string, string> = {
      '1_PREINSCRIPCION': 'Preinscripcion',
      '2_EXPEDIENTE':     'Expediente',
      '3_ENTREVISTA':     'Entrevista',
      '4_VERIFICACION':   'Verificacion',
      '5_CIBIR':          'CIBIR',
      '6_INSCRIPCION':    'Inscripcion',
    }
    const EMBUDO_COLORS: Record<string, string> = {
      '1_PREINSCRIPCION': '#64748b',
      '2_EXPEDIENTE':     '#f59e0b',
      '3_ENTREVISTA':     '#3b82f6',
      '4_VERIFICACION':   '#a855f7',
      '5_CIBIR':          '#10b981',
      '6_INSCRIPCION':    '#ec4899',
    }
    const admissionSlices = results[7].rows.map((r: any) => ({
      label: EMBUDO_LABELS[r.label] || (r.label || '').replace(/^\d+_/, ''),
      value: Number(r.value || 0),
      color: EMBUDO_COLORS[r.label] || '#94a3b8',
    }))

    // 8 - Tipos de afiliados
    const TIPO_COLORS: Record<string, string> = {
      'Natural':           '#3b82f6',
      'Corporativo':       '#10b981',
      'Agente Corporativo':'#f59e0b',
    }
    const memberTypeSlices = results[8].rows.map((r: any) => ({
      label: r.label || 'Natural',
      value: Number(r.value || 0),
      color: TIPO_COLORS[r.label || ''] || '#6366f1',
    }))

    // 9 - Actividad reciente
    const activities = results[9].rows.map((r: any) => {
      let type: 'cibir' | 'curso' | 'cms' | 'finance' = 'curso'
      if (r.tipo === 'CIBIR') type = 'cibir'
      else if (r.tipo === 'CMS') type = 'cms'
      else if (r.tipo === 'FINANZAS') type = 'finance'
        return {
          creado_en: r.creado_en,
          titulo: r.titulo,
          mensaje: r.mensaje,
          tipo: r.tipo,
          type,
        }
      })

    const finalActivities = activities.length > 0 ? activities : [
      { creado_en: new Date().toISOString(), titulo: 'Sistema de analiticas activo', mensaje: 'Las metricas se actualizan en tiempo real desde la base de datos', tipo: 'FINANZAS', type: 'finance' }
    ]

    // 10, 11, 12, 13, 14, 15, 16, 17, 18
    const pendingCedula = Number(results[10].rows[0]?.c || 0)
    const pendingRif = Number(results[11].rows[0]?.c || 0)
    const pendingEmail = Number(results[12].rows[0]?.c || 0)
    const pendingUnique = Number(results[14].rows[0]?.c || 0)
    const corpConLogo = Number(results[15].rows[0]?.c || 0)
    const corpTotal = Number(results[16].rows[0]?.c || 0)
    const pendingTelefono = Number(results[17].rows[0]?.c || 0)
    const pendingFoto = Number(results[18].rows[0]?.c || 0)

    res.json({
      success: true,
      data: {
        kpis: {
          afiliadosActivos:    totalActivos,
          solicitudesPendientes,
          afiliadosAprobados:  totalActivos,
          afiliadosRechazados: totalRechazados,
          afiliadosConPendientes: pendingUnique,
          afiliadosCorpConLogo: corpConLogo,
          totalAfiliadosCorp: corpTotal,
        },
        admissionSlices,
        memberTypeSlices,
        corpLogoSlices: [
          { label: 'Con Logo', value: corpConLogo, color: '#10b981' },
          { label: 'Sin Logo', value: Math.max(0, corpTotal - corpConLogo), color: '#94a3b8' }
        ],
        pendingDataSlices: [
          { label: 'Cédula Pendiente', value: pendingCedula, color: '#f87171' },
          { label: 'RIF Pendiente', value: pendingRif, color: '#fbbf24' },
          { label: 'Email Pendiente', value: pendingEmail, color: '#60a5fa' },
          { label: 'Teléfono Pendiente', value: pendingTelefono, color: '#a855f7' },
          { label: 'Foto Pendiente', value: pendingFoto, color: '#ec4899' },
        ],
        cibirSlices: [
          { label: 'Aprobados',  value: cibirAprobados,  color: '#10b981' },
          { label: 'Pendientes', value: cibirPendientes, color: '#f59e0b' },
          { label: 'Rechazados', value: cibirRechazados, color: '#ef4444' },
        ],
        preaniSlices: [
          { label: 'Aprobados',  value: preaniAprobados,  color: '#10b981' },
          { label: 'Pendientes', value: preaniPendientes, color: '#f59e0b' },
          { label: 'Rechazados', value: preaniRechazados, color: '#ef4444' },
        ],
        pegiSlices: [
          { label: 'Aprobados',  value: pegiAprobados,  color: '#10b981' },
          { label: 'Pendientes', value: pegiPendientes, color: '#f59e0b' },
          { label: 'Rechazados', value: pegiRechazados, color: '#ef4444' },
        ],
        padiSlices: [
          { label: 'Aprobados',  value: padiAprobados,  color: '#10b981' },
          { label: 'Pendientes', value: padiPendientes, color: '#f59e0b' },
          { label: 'Rechazados', value: padiRechazados, color: '#ef4444' },
        ],
        activities: finalActivities,
      }
    })
  } catch (error: any) {
    console.error('getAnalyticsData:', error)
    res.status(500).json({ success: false, message: 'Error al cargar metricas: ' + error.message })
  }
}
