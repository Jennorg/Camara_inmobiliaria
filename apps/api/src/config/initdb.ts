/**
 * initdb.ts — Inicialización del esquema de base de datos en Turso/LibSQL.
 *
 * Uso:
 *   pnpm tsx src/config/initdb.ts
 *
 * Reinicio completo:
 *   pnpm tsx src/config/initdb.ts --reset
 */

import { db } from '../lib/db.js'
import bcrypt from 'bcryptjs'

const statements = [
  `PRAGMA foreign_keys = ON`,

  // ===========================================================
  // SEGURIDAD Y USUARIOS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER     PRIMARY KEY,
    email               TEXT        UNIQUE NOT NULL,
    password_hash       TEXT        NOT NULL,
    roles               TEXT        NOT NULL DEFAULT '["afiliado"]',
    activo              INTEGER     NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en           TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en      TEXT,
    eliminado_en        TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_activos ON users(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // PERSONAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS personas (
    id                  INTEGER     PRIMARY KEY,
    nombres             TEXT        NOT NULL,
    apellidos           TEXT        NOT NULL,
    cedula_tipo         TEXT        NOT NULL DEFAULT 'V' CHECK (cedula_tipo IN ('V','E','P')),
    cedula              TEXT        UNIQUE NOT NULL CHECK (cedula NOT GLOB '*[^0-9]*'),
    email               TEXT        UNIQUE NOT NULL,
    telefono            TEXT,
    fecha_nacimiento    TEXT,
    profesion           TEXT,
    direccion           TEXT,
    nivel_academico     TEXT        CHECK (nivel_academico IS NULL OR nivel_academico IN ('Bachiller','TSU','Nivel Profesional','Postgrado')),
    foto_url            TEXT,
    creado_en           TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en      TEXT,
    eliminado_en        TEXT,
    CONSTRAINT chk_email_formato CHECK (email LIKE '%@%.%')
  )`,
  `CREATE INDEX IF NOT EXISTS idx_personas_email ON personas(email)`,
  `CREATE INDEX IF NOT EXISTS idx_personas_activos ON personas(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // EMPRESAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS empresas (
    id_empresa              INTEGER     PRIMARY KEY,
    id_user                 INTEGER     UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    razon_social            TEXT        NOT NULL,
    rif_tipo                TEXT        NOT NULL DEFAULT 'J' CHECK (rif_tipo IN ('J','G','P','V','E')),
    rif_numero              TEXT        UNIQUE NOT NULL CHECK (rif_numero NOT GLOB '*[^0-9]*'),
    email                   TEXT        UNIQUE NOT NULL,
    direccion               TEXT,
    telefono                TEXT,
    website                 TEXT,
    logo_url                TEXT,
    notas                   TEXT,
    fecha_registro          TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en          TEXT,
    eliminado_en            TEXT,
    id_representante_legal  INTEGER     REFERENCES afiliados(id_afiliado) ON DELETE SET NULL,
    redes_sociales          TEXT        DEFAULT '{}',
    CONSTRAINT chk_email_formato CHECK (email LIKE '%@%.%')
  )`,
  `CREATE INDEX IF NOT EXISTS idx_empresas_rif ON empresas(rif_numero)`,
  `CREATE INDEX IF NOT EXISTS idx_empresas_activos ON empresas(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // AFILIADOS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS afiliados (
    id_afiliado                 INTEGER     PRIMARY KEY,
    id_user                     INTEGER     UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    id_persona                  INTEGER     UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    codigo                      TEXT        UNIQUE,
    tipo_afiliado               TEXT        NOT NULL DEFAULT 'Natural'
                                            CHECK (tipo_afiliado IN ('Natural','Corporativo','Agente Corporativo')),
    notas                       TEXT,
    estatus                     TEXT        NOT NULL DEFAULT '1_PREINSCRIPCION'
                                            CHECK (estatus IN (
                                              '1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA',
                                              '4_VERIFICACION','5_CIBIR','6_INSCRIPCION',
                                              'Requiere Acción','Afiliado','Moroso','Suspendido','Rechazado'
                                            )),
    cibir_acreditado            INTEGER     NOT NULL DEFAULT 0 CHECK (cibir_acreditado IN (0,1)),
    optar_acreditacion          INTEGER     NOT NULL DEFAULT 0 CHECK (optar_acreditacion IN (0,1)),
    id_empresa                  INTEGER     REFERENCES empresas(id_empresa) ON DELETE SET NULL,
    fecha_registro              TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    fecha_ultimo_cambio_estatus TEXT,
    fecha_afiliacion            TEXT,
    ano_inicio_servicio         INTEGER,
    actualizado_en              TEXT,
    eliminado_en                TEXT,
    redes_sociales              TEXT        DEFAULT '{}',
    activo                      INTEGER     NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    CONSTRAINT chk_empresa_asignada CHECK (
      (tipo_afiliado IN ('Corporativo','Agente Corporativo') AND id_empresa IS NOT NULL) OR
      (tipo_afiliado = 'Natural')
    )
  )`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_estatus ON afiliados(estatus)`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_empresa ON afiliados(id_empresa)`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_persona ON afiliados(id_persona)`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_activos ON afiliados(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // ACREDITACIONES CIBIR
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS acreditaciones_cibir (
    id               INTEGER PRIMARY KEY,
    id_afiliado      INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    modulo           INTEGER NOT NULL CHECK (modulo BETWEEN 1 AND 5),
    estatus          TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','aprobado','rechazado')),
    evaluado_por     INTEGER REFERENCES users(id),
    fecha_evaluacion TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    observaciones    TEXT,
    UNIQUE(id_afiliado, modulo)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_acreditaciones_afiliado ON acreditaciones_cibir(id_afiliado)`,

  // ===========================================================
  // DOCUMENTOS (unificados)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS documentos (
    id_documento    INTEGER PRIMARY KEY,
    entidad_tipo    TEXT    NOT NULL CHECK (entidad_tipo IN ('afiliado','empresa','estudiante','curso')),
    entidad_id      INTEGER NOT NULL,
    nombre_archivo  TEXT    NOT NULL,
    url             TEXT    NOT NULL,
    tipo_archivo    TEXT,
    fecha_subida    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_en    TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documentos_entidad ON documentos(entidad_tipo, entidad_id)`,

  // ===========================================================
  // TOKENS DE ACCIÓN (unificados)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS tokens_accion (
    id              INTEGER PRIMARY KEY,
    token           TEXT    UNIQUE NOT NULL,
    tipo            TEXT    NOT NULL CHECK (tipo IN ('reset_password','invitacion_empresa','verificacion_email','preinscripcion')),
    email           TEXT,
    data_json       TEXT,
    usado           INTEGER NOT NULL DEFAULT 0,
    fecha_expiracion TEXT   NOT NULL,
    creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,

  // ===========================================================
  // ESTUDIANTES
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS estudiantes (
    id_estudiante     INTEGER     PRIMARY KEY,
    id_user           INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    id_persona        INTEGER     REFERENCES personas(id) ON DELETE SET NULL,
    id_empresa        INTEGER     REFERENCES empresas(id_empresa) ON DELETE SET NULL,
    programa_interes  TEXT,
    es_corredor_inmobiliario INTEGER CHECK (es_corredor_inmobiliario IS NULL OR es_corredor_inmobiliario IN (0,1)),
    tipo              TEXT        NOT NULL DEFAULT 'Regular' CHECK (tipo IN ('Regular','Invitado','Afiliado','Corporativo')),
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en    TEXT,
    eliminado_en      TEXT,
    UNIQUE(id_persona),
    UNIQUE(id_empresa),
    CONSTRAINT chk_tipo_estudiante CHECK (
      (id_persona IS NOT NULL AND id_empresa IS NULL) OR
      (id_persona IS NULL AND id_empresa IS NOT NULL)
    )
  )`,
  `CREATE INDEX IF NOT EXISTS idx_estudiantes_persona ON estudiantes(id_persona)`,
  `CREATE INDEX IF NOT EXISTS idx_estudiantes_empresa ON estudiantes(id_empresa)`,
  `CREATE INDEX IF NOT EXISTS idx_estudiantes_user ON estudiantes(id_user)`,

  // ===========================================================
  // MÓDULO ACADÉMICO (cursos e inscripciones)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cursos (
    id_curso          INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    slug              TEXT        UNIQUE NOT NULL,
    descripcion       TEXT,
    contenido         TEXT,
    categoria         TEXT,
    fecha_inicio      TEXT,
    fecha_fin         TEXT,
    modalidad         TEXT,
    estatus           TEXT        DEFAULT 'Abierto',
    solo_informativo  INTEGER     DEFAULT 0,
    orden             INTEGER     DEFAULT 0,
    imagen_url        TEXT,
    banner_url        TEXT,
    cupos_totales     INTEGER,
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en    TEXT,
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cursos_activos ON cursos(eliminado_en) WHERE eliminado_en IS NULL`,

  `CREATE TABLE IF NOT EXISTS inscripciones_cursos (
    id_inscripcion    INTEGER     PRIMARY KEY,
    id_estudiante     INTEGER     NOT NULL REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE,
    id_curso          INTEGER     REFERENCES cursos(id_curso) ON DELETE CASCADE,
    programa_codigo   TEXT,
    tipo_inscripcion  TEXT        NOT NULL CHECK (tipo_inscripcion IN ('curso','programa')),
    estatus           TEXT        NOT NULL DEFAULT 'Preinscrito' CHECK (estatus IN ('Preinscrito','Entrevista','Inscrito','Pagado','Rechazado','Cancelado')),
    estatus_academico TEXT        DEFAULT 'Inscrito' CHECK (estatus_academico IN ('Inscrito','Cursando','Aprobado','Reprobado','Retirado')),
    id_empresa        INTEGER     REFERENCES empresas(id_empresa),
    fecha_inscripcion TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en    TEXT,
    completado        INTEGER     DEFAULT 0 CHECK (completado IN (0,1)),
    nota_admin        TEXT,
    aprobado_por      INTEGER     REFERENCES users(id),
    UNIQUE(id_curso, id_estudiante)
  )`,

  `CREATE TABLE IF NOT EXISTS certificados (
    id_certificado      INTEGER     PRIMARY KEY,
    id_inscripcion      INTEGER     NOT NULL UNIQUE REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE CASCADE,
    codigo_validacion   TEXT        NOT NULL UNIQUE,
    url                 TEXT        NOT NULL,
    fecha_emision       TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_en        TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_certificados_inscripcion ON certificados(id_inscripcion)`,
  `CREATE INDEX IF NOT EXISTS idx_certificados_codigo ON certificados(codigo_validacion)`,

  // ===========================================================
  // PROFESORES
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS profesores (
    id_profesor       INTEGER     PRIMARY KEY AUTOINCREMENT,
    id_persona        INTEGER     UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    id_afiliado       INTEGER     UNIQUE REFERENCES afiliados(id_afiliado) ON DELETE SET NULL,
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en    TEXT
  )`,

  // ===========================================================
  // MÓDULOS DE CURSOS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS modulos_curso (
    id_curso      INTEGER NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
    nombre_modulo TEXT NOT NULL,
    orden         INTEGER DEFAULT 0,
    id_profesor   INTEGER REFERENCES profesores(id_profesor) ON DELETE SET NULL,
    PRIMARY KEY (id_curso, nombre_modulo)
  )`,

  `CREATE TABLE IF NOT EXISTS modulos_inscripcion (
    id              INTEGER PRIMARY KEY,
    id_inscripcion  INTEGER NOT NULL REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE CASCADE,
    nombre_modulo   TEXT NOT NULL,
    estatus         TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente','Aprobado','Rechazado')),
    aprobado_por    INTEGER REFERENCES users(id),
    nota_admin      TEXT,
    fecha_evaluacion TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE(id_inscripcion, nombre_modulo)
  )`,


  // ===========================================================
  // ENTREVISTAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS entrevistas (
    id_entrevista   INTEGER PRIMARY KEY,
    id_afiliado     INTEGER REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    id_inscripcion  INTEGER REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE CASCADE,
    fecha           TEXT    NOT NULL,
    hora            TEXT,
    lugar           TEXT,
    estatus         TEXT    NOT NULL DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente','Realizada','Cancelada')),
    notas           TEXT,
    creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en  TEXT,
    eliminado_en    TEXT,
    CONSTRAINT chk_entrevista_exclusiva CHECK (
      (id_afiliado IS NOT NULL AND id_inscripcion IS NULL) OR
      (id_afiliado IS NULL AND id_inscripcion IS NOT NULL)
    )
  )`,
  `CREATE INDEX IF NOT EXISTS idx_entrevistas_afiliado ON entrevistas(id_afiliado)`,
  `CREATE INDEX IF NOT EXISTS idx_entrevistas_inscripcion ON entrevistas(id_inscripcion)`,
  `CREATE INDEX IF NOT EXISTS idx_entrevistas_estatus ON entrevistas(estatus)`,

  // ===========================================================
  // CMS - NOTICIAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cms_noticias (
    id_noticia        INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    slug              TEXT        UNIQUE NOT NULL,
    resumen           TEXT,
    contenido         TEXT,
    imagen_url        TEXT,
    categoria         TEXT,
    tag               TEXT,
    fecha_publicacion TEXT        DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    publicado         INTEGER     DEFAULT 0 CHECK (publicado IN (0,1)),
    orden             INTEGER     DEFAULT 0,
    fecha_evento      TEXT,
    hora_evento       TEXT,
    lugar_evento      TEXT,
    posicion_imagen   TEXT        DEFAULT 'center center',
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cms_noticias_activas ON cms_noticias(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // CMS - CURSOS (informativo)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cms_cursos (
    id_cms_curso      INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    slug              TEXT        UNIQUE NOT NULL,
    descripcion_corta TEXT,
    modalidad         TEXT,
    imagen_url        TEXT,
    publicado         INTEGER     DEFAULT 1 CHECK (publicado IN (0,1)),
    eliminado_en      TEXT
  )`,

  // ===========================================================
  // CMS - CONVENIOS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cms_convenios (
    id_convenio       INTEGER     PRIMARY KEY,
    nombre            TEXT        NOT NULL,
    descripcion       TEXT,
    logo_url          TEXT,
    link_web          TEXT,
    activo            INTEGER     DEFAULT 1 CHECK (activo IN (0,1)),
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cms_convenios_activos ON cms_convenios(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // DIRECTIVA DE LA CÁMARA (basada en afiliados)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS directiva_cargos (
    id              INTEGER PRIMARY KEY,
    id_afiliado     INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    cargo           TEXT    NOT NULL,
    cargo_canonical TEXT    NOT NULL DEFAULT '',
    periodo         TEXT,
    orden           INTEGER DEFAULT 0,
    activo          INTEGER DEFAULT 1 CHECK (activo IN (0,1)),
    foto_junta_url  TEXT,
    creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en  TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_directiva_afiliado ON directiva_cargos(id_afiliado)`,
  `CREATE INDEX IF NOT EXISTS idx_directiva_activos ON directiva_cargos(activo)`,

  // ===========================================================
  // CMS - HITOS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cms_hitos (
    id_hito           INTEGER     PRIMARY KEY,
    año               TEXT        NOT NULL,
    titulo            TEXT        NOT NULL,
    descripcion       TEXT,
    orden             INTEGER     DEFAULT 0,
    eliminado_en      TEXT
  )`,

  // ===========================================================
  // CMS - NORMATIVAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cms_normativas (
    id_normativa      INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    descripcion       TEXT,
    url_archivo       TEXT        NOT NULL,
    categoria         TEXT,
    orden             INTEGER     DEFAULT 0,
    activo            INTEGER     DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cms_normativas_activas ON cms_normativas(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // CMS - CONFIGURACIÓN
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cms_configuracion (
    clave             TEXT        PRIMARY KEY,
    valor             TEXT,
    actualizado_en    TEXT        DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,

  // ===========================================================
  // NOTIFICACIONES
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS notificaciones (
    id                  INTEGER     PRIMARY KEY,
    id_user             INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo                TEXT        NOT NULL DEFAULT 'SISTEMA',
    prioridad           TEXT        NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA','NORMAL','ALTA','URGENTE')),
    titulo              TEXT        NOT NULL,
    mensaje             TEXT        NOT NULL,
    data_json           TEXT        DEFAULT '{}',
    leido               INTEGER     NOT NULL DEFAULT 0 CHECK (leido IN (0,1)),
    enviado_email       INTEGER     NOT NULL DEFAULT 0 CHECK (enviado_email IN (0,1)),
    creado_en           TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    leido_en            TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notificaciones_user ON notificaciones(id_user)`,
  `CREATE INDEX IF NOT EXISTS idx_notificaciones_leido ON notificaciones(id_user, leido)`,

  // ===========================================================
  // REFRESH TOKENS (SESIONES DESLIZANTES)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS user_refresh_tokens (
    id                  INTEGER     PRIMARY KEY,
    id_user             INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash          TEXT        UNIQUE NOT NULL,
    expira_en           TEXT        NOT NULL,
    creado_en           TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_hash ON user_refresh_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_user ON user_refresh_tokens(id_user)`,

  // ===========================================================
  // SOLICITUDES DE CAMBIO DE ESTADO
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS solicitudes_cambio_estado (
    id_solicitud           INTEGER     PRIMARY KEY AUTOINCREMENT,
    id_afiliado            INTEGER     NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    tipo_actual            TEXT        NOT NULL CHECK (tipo_actual IN ('Natural','Corporativo','Agente Corporativo')),
    tipo_solicitado        TEXT        NOT NULL CHECK (tipo_solicitado IN ('Natural','Corporativo','Agente Corporativo')),
    id_empresa_solicitada  INTEGER     REFERENCES empresas(id_empresa) ON DELETE SET NULL,
    datos_empresa          TEXT        DEFAULT '{}',
    documentos_empresa     TEXT        DEFAULT '[]',
    estatus                TEXT        NOT NULL DEFAULT 'Pendiente_Admin'
                                       CHECK (estatus IN ('Pendiente_Empresa', 'Pendiente_Admin', 'Aprobado', 'Rechazado_Empresa', 'Rechazado_Admin')),
    observaciones_empresa  TEXT,
    observaciones_admin    TEXT,
    creado_en              TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en         TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_solicitudes_cambio_afiliado ON solicitudes_cambio_estado(id_afiliado)`
]

async function run() {
  console.log('--- TURSO DB INITIALIZATION ---')

  const reset = process.env.INITDB_RESET === '1' || process.argv.includes('--reset')

  if (reset) {
    console.log('  ⚠ RESET MODE: Dropping all tables...')
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")

    await db.execute(`PRAGMA foreign_keys = OFF`)

    for (const row of tables.rows) {
      try {
        await db.execute(`DROP TABLE IF EXISTS "${row.name}"`)
        console.log(`    · Dropped ${row.name}`)
      } catch (e: any) {
        if (e.message.includes('no such table')) {
          console.log(`    · ${row.name} already gone (skipped)`)
        } else {
          console.error(`    · ERROR dropping ${row.name}: ${e.message}`)
        }
      }
    }

    await db.execute(`PRAGMA foreign_keys = ON`)
  }

  console.log('  ⚠ Creating tables and indices...')
  for (const sql of statements) {
    try {
      await db.execute(sql)
      const label = sql.length > 50 ? sql.substring(0, 47) + '...' : sql
      console.log(`  · OK: ${label.replace(/\n/g, ' ')}`)
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log(`  · Skip: Table/Index already exists`)
      } else {
        console.error(`  · FATAL ERROR during creation: ${e.message}`)
        throw e;
      }
    }
  }

  console.log('  ⚠ Cleaning up cedula and rif_numero (removing prefixes and non-digits)...')
  try {
    // personas: quitar prefijos comunes V, E, P, guiones y puntos
    await db.execute(`UPDATE personas SET cedula = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cedula, 'V', ''), 'E', ''), 'P', ''), '-', ''), '.', '') WHERE cedula GLOB '*[^0-9]*'`)
    // empresas: quitar prefijos J, G, P, V, E, guiones y puntos
    await db.execute(`UPDATE empresas SET rif_numero = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(rif_numero, 'J', ''), 'G', ''), 'P', ''), 'V', ''), 'E', ''), '-', ''), '.', '') WHERE rif_numero GLOB '*[^0-9]*'`)
    // Migración: asegurar que exista foto_junta_url en directiva_cargos
    try {
      await db.execute(`ALTER TABLE directiva_cargos ADD COLUMN foto_junta_url TEXT`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: asegurar que exista asignado_por en inscripciones_cursos
    try {
      await db.execute(`ALTER TABLE inscripciones_cursos ADD COLUMN asignado_por INTEGER`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    console.log('  · OK: Data cleaned.')
  } catch (e: any) {
    console.warn(`  · WARNING: Data cleaning failed: ${e.message}`)
  }

  console.log('\n--- SEEDING INITIAL DATA ---')

  const adminEmail = 'admin@ciebo.com'
  const hashedPassword = await bcrypt.hash('admin123', 10)

  try {
    // 1. ADMIN
    const adminRes = await db.execute({
      sql: `INSERT INTO users (email, password_hash, roles, activo) VALUES (?, ?, ?, ?)`,
      args: [adminEmail, hashedPassword, '["admin", "super_admin"]', 1]
    })
    const adminId = Number(adminRes.lastInsertRowid)

    const persAdmin = await db.execute({
      sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email) VALUES (?, ?, ?, ?, ?)`,
      args: ['Admin', 'Cámara', 'V', '00000000', adminEmail]
    })
    const personaIdAdmin = Number(persAdmin.lastInsertRowid)

    await db.execute({
      sql: `INSERT INTO afiliados (id_user, id_persona, tipo_afiliado, estatus) VALUES (?, ?, ?, ?)`,
      args: [adminId, personaIdAdmin, 'Natural', 'Afiliado']
    })

    console.log(`  · Admin user ${adminEmail} created (ID: ${adminId}).`)
  } catch (e: any) {
    console.log(`  · Admin user already exists (error: ${e.message})`)
  }

  // Convenios de ejemplo
  const convenios = [
    {
      nombre: 'Universidad Católica Andrés Bello (UCAB)',
      descripcion: 'Convenio de cooperación académica para diplomados y certificaciones inmobiliarias.',
      link_web: 'https://www.ucab.edu.ve/',
      logo_url: 'https://www.ucab.edu.ve/wp-content/uploads/2019/04/Logo_UCAB_2.png'
    },
  ]

  for (const conv of convenios) {
    try {
      await db.execute({
        sql: `INSERT INTO cms_convenios (nombre, descripcion, link_web, logo_url) VALUES (?, ?, ?, ?)`,
        args: [conv.nombre, conv.descripcion, conv.link_web, conv.logo_url]
      })
      console.log(`  · Convenio ${conv.nombre} creado.`)
    } catch (e) {
      console.log(`  · Convenio ${conv.nombre} ya existe.`)
    }
  }

  // Normativas de ejemplo
  const normativas = [
    { titulo: "ESTATUTOS CIV", categoria: "Reglamentos y Estatutos", url: "https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/normativas/48add48d-420a-4ae5-ab70-5fc02369b56e-Estatutos-CIV.pdf" },
    { titulo: "CÓDIGO DE ÉTICA DEL PROFESIONAL INMOBILIARIO", categoria: "Reglamentos y Estatutos", url: "https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/normativas/812fd943-a934-4ab9-a7e1-cf4d0831c10f-Codigo-etica-vigencia_-29-09-2.020-ONCDOFT.pdf" },
    { titulo: "REGLAMENTO CERTIFICACIÓN DEL PROFESIONAL INMOBILIARIO CIV", categoria: "Reglamentos y Estatutos", url: "https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/normativas/6e9fd86a-a714-414e-b38d-ae999297e522-REGLAMENTO-DE-CERTIFICACION-CIV-APROBADO-JUNTA-DIRECTIVA-1-1.pdf" },
    { titulo: "LEY PARA LA REGULARIZACIÓN Y CONTROL DE LOS ARRENDAMIENTOS DE VIVIENDA", categoria: "Reglamentos y Estatutos", url: "https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/normativas/15705918-16ba-42c6-9637-a2cb0eb53a2f-mietengesetz-venezuela-1.pdf" },
    { titulo: "ACTA DE ASAMBLEA ORDINARIA CIEB (SEPT 2012)", categoria: "Actas de Asamblea", url: "https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/normativas/2723a35a-a51f-40d2-ad23-08aef4c57104-Acta_Asamblea_Ordinaria_de_la_Camara.pdf" },
    { titulo: "ACTA CONSTITUTIVA Y ESTATURIA DE LA CÁMARA", categoria: "Actas de Asamblea", url: "https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/normativas/b2cf8ff2-5ef7-45c3-b113-ad2e97f44eab-Acta-1.pdf" },
    { titulo: "LEY DE FISCALIZACIÓN Y FINANCIAMIENTO DE LAS ONG", categoria: "Leyes y Decretos", url: "https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/normativas/8262feae-4105-41e7-8cf4-1d6a7baa741a-GACETA-6855_(1).pdf" }
  ]

  for (const n of normativas) {
    try {
      await db.execute({
        sql: `INSERT INTO cms_normativas (titulo, categoria, url_archivo, orden, activo) VALUES (?, ?, ?, 0, 1)`,
        args: [n.titulo, n.categoria, n.url]
      })
      console.log(`  · Normativa ${n.titulo} creada.`)
    } catch (e) {
      console.log(`  · Normativa ${n.titulo} ya existe.`)
    }
  }

  console.log('\n--- DB INIT COMPLETE ---')
  console.log('⚠ La directiva (directiva_cargos) debe poblarse manualmente con afiliados reales.')
}

run().catch(console.error)