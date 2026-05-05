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
    reset_token_hash    TEXT,
    reset_token_expira  TEXT,
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
    cedula              TEXT        UNIQUE NOT NULL,
    email               TEXT        UNIQUE NOT NULL,
    telefono            TEXT,
    fecha_nacimiento    TEXT,
    profesion           TEXT,
    direccion           TEXT,
    nivel_academico     TEXT        CHECK (nivel_academico IS NULL OR nivel_academico IN ('Bachiller','TSU','Universitario','Postgrado')),
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
    rif_numero              TEXT        UNIQUE NOT NULL,
    email                   TEXT        UNIQUE NOT NULL,
    direccion               TEXT,
    telefono                TEXT,
    website                 TEXT,
    logo_url                TEXT,
    banner_url              TEXT,
    notas                   TEXT,
    estatus                 TEXT        NOT NULL DEFAULT 'Afiliado' CHECK (estatus IN ('Afiliado','Moroso','Suspendido','Rechazado')),
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
    codigo_cibir                TEXT        UNIQUE,
    tipo_afiliado               TEXT        NOT NULL DEFAULT 'Natural'
                                            CHECK (tipo_afiliado IN ('Natural','Corporativo','Agente Corporativo')),
    notas                       TEXT,
    estatus                     TEXT        NOT NULL DEFAULT '1_PREINSCRIPCION'
                                            CHECK (estatus IN (
                                              '1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA',
                                              '4_VERIFICACION','5_CIBIR','6_INSCRIPCION',
                                              'Requiere Acción','Afiliado','Moroso','Suspendido','Rechazado'
                                            )),
    cibir_convalidado           INTEGER     NOT NULL DEFAULT 0 CHECK (cibir_convalidado IN (0,1)),
    inscripcion_pagada          INTEGER     NOT NULL DEFAULT 0 CHECK (inscripcion_pagada IN (0,1)),
    id_empresa                  INTEGER     REFERENCES empresas(id_empresa) ON DELETE SET NULL,
    fecha_registro              TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    fecha_ultimo_cambio_estatus TEXT,
    actualizado_en              TEXT,
    eliminado_en                TEXT,
    redes_sociales              TEXT        DEFAULT '{}',
    activo                      INTEGER     NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    CONSTRAINT chk_empresa_asignada CHECK (
      (tipo_afiliado IN ('Corporativo','Agente Corporativo') AND id_empresa IS NOT NULL) OR
      (tipo_afiliado = 'Natural' AND id_empresa IS NULL)
    )
  )`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_estatus ON afiliados(estatus)`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_empresa ON afiliados(id_empresa)`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_persona ON afiliados(id_persona)`,
  `CREATE INDEX IF NOT EXISTS idx_afiliados_activos ON afiliados(eliminado_en) WHERE eliminado_en IS NULL`,

  // ===========================================================
  // CONSOLIDACIÓN DE MÓDULOS CIBIR (nueva)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS convalidaciones_cibir (
    id               INTEGER PRIMARY KEY,
    id_afiliado      INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    modulo           INTEGER NOT NULL CHECK (modulo BETWEEN 1 AND 5),
    estatus          TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','aprobado','rechazado')),
    evaluado_por     INTEGER REFERENCES users(id),
    fecha_evaluacion TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    observaciones    TEXT,
    UNIQUE(id_afiliado, modulo)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_convalidaciones_afiliado ON convalidaciones_cibir(id_afiliado)`,

  // ===========================================================
  // DOCUMENTOS DE AFILIADOS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS documentos_afiliado (
    id_documento      INTEGER     PRIMARY KEY,
    id_afiliado       INTEGER     NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    nombre_documento  TEXT        NOT NULL,
    url_documento     TEXT        NOT NULL,
    tipo_archivo      TEXT,
    fecha_subida      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_docs_afiliado ON documentos_afiliado(id_afiliado)`,

  // ===========================================================
  // DOCUMENTOS DE EMPRESAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS documentos_empresa (
    id_documento      INTEGER     PRIMARY KEY,
    id_empresa        INTEGER     NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
    nombre_documento  TEXT        NOT NULL,
    url_documento     TEXT        NOT NULL,
    tipo_archivo      TEXT,
    fecha_subida      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_docs_empresa ON documentos_empresa(id_empresa)`,

  // ===========================================================
  // INVITACIONES A EMPRESAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS invitaciones_empresa (
    id_invitacion       INTEGER   PRIMARY KEY,
    id_empresa          INTEGER   NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
    token               TEXT      UNIQUE NOT NULL,
    nombre_empresa      TEXT      NOT NULL,
    activo              INTEGER   NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    fecha_expiracion    TEXT,
    creado_en           TEXT      NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_en        TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invitaciones_empresa ON invitaciones_empresa(id_empresa)`,
  `CREATE INDEX IF NOT EXISTS idx_invitaciones_activas ON invitaciones_empresa(eliminado_en) WHERE eliminado_en IS NULL`,

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
  // VERIFICACIONES DE EMAIL
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS verificaciones_email (
    id          INTEGER  PRIMARY KEY,
    email       TEXT     NOT NULL,
    codigo      TEXT     NOT NULL,
    expira_en   INTEGER  NOT NULL,
    usado       INTEGER  DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS verificaciones_preinscripciones (
    id                        INTEGER PRIMARY KEY,
    token_verificacion        TEXT UNIQUE NOT NULL,
    email                     TEXT NOT NULL,
    nombres                   TEXT,
    apellidos                 TEXT,
    cedula                    TEXT,
    telefono                  TEXT,
    nivel_academico           TEXT CHECK (nivel_academico IS NULL OR nivel_academico IN ('Bachiller','TSU','Universitario','Postgrado')),
    profesion                 TEXT,
    tipo_afiliado             TEXT CHECK (tipo_afiliado IN ('Natural','Corporativo','Agente Corporativo')),
    id_empresa                INTEGER REFERENCES empresas(id_empresa) ON DELETE SET NULL,
    razon_social              TEXT,
    rif_tipo                  TEXT,
    rif_numero                TEXT,
    representante_legal_nombres   TEXT,
    representante_legal_apellidos TEXT,
    representante_legal_cedula    TEXT,
    representante_legal_email     TEXT,
    programa_interes          TEXT,
    es_corredor_inmobiliario  INTEGER CHECK (es_corredor_inmobiliario IS NULL OR es_corredor_inmobiliario IN (0,1)),
    estatus                   TEXT NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','verificado','completado','expirado')),
    fecha_expiracion          TEXT NOT NULL,
    creado_en                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    procesado_en              TEXT,
    eliminado_en              TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ver_preins_email ON verificaciones_preinscripciones(email)`,
  `CREATE INDEX IF NOT EXISTS idx_ver_preins_estatus ON verificaciones_preinscripciones(estatus)`,

  // ===========================================================
  // CENTRALIZACIÓN FINANCIERA
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS transacciones (
    id_transaccion    INTEGER     PRIMARY KEY,
    id_user           INTEGER     NOT NULL REFERENCES users(id),
    concepto          TEXT        NOT NULL,
    entidad_tipo      TEXT        NOT NULL,
    entidad_id        INTEGER     NOT NULL,
    monto             INTEGER     NOT NULL,
    metodo_pago       TEXT,
    referencia        TEXT        UNIQUE,
    estatus           TEXT        DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente','Verificando','Conciliado','Rechazado','Reembolsado')),
    fecha_pago        TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    conciliado_por    INTEGER     REFERENCES users(id),
    notas             TEXT,
    actualizado_en    TEXT,
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transacciones_user ON transacciones(id_user)`,
  `CREATE INDEX IF NOT EXISTS idx_transacciones_conciliador ON transacciones(conciliado_por)`,

  // ===========================================================
  // MÓDULO ACADÉMICO
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS instructores (
    id_instructor     INTEGER     PRIMARY KEY,
    nombre            TEXT        NOT NULL,
    especialidad      TEXT,
    perfil            TEXT,
    email             TEXT,
    telefono          TEXT,
    activo            INTEGER     DEFAULT 1 CHECK (activo IN (0,1)),
    eliminado_en      TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS cursos (
    id_curso          INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    slug              TEXT        UNIQUE NOT NULL,
    descripcion       TEXT,
    contenido         TEXT,
    categoria         TEXT        CHECK (categoria IN ('Taller','Diplomado','Certificación','Webinar')),
    id_instructor     INTEGER     REFERENCES instructores(id_instructor),
    precio_miembro    INTEGER     DEFAULT 0,
    precio_publico    INTEGER     DEFAULT 0,
    fecha_inicio      TEXT,
    fecha_fin         TEXT,
    modalidad         TEXT        CHECK (modalidad IN ('Presencial','Online','Híbrido')),
    estatus           TEXT        DEFAULT 'Borrador' CHECK (estatus IN ('Borrador','Publicado','Finalizado','Cancelado')),
    imagen_url        TEXT,
    banner_url        TEXT,
    cupos_totales     INTEGER,
    cupos_disponibles INTEGER,
    destacado         INTEGER     DEFAULT 0,
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en    TEXT,
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cursos_instructor ON cursos(id_instructor)`,
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
    certificado_url   TEXT,
    notas             TEXT,
    entrevista_fecha  TEXT,
    entrevista_hora   TEXT,
    entrevista_lugar  TEXT,
    entrevista_estatus TEXT       DEFAULT 'N/A' CHECK (entrevista_estatus IN ('N/A','Pendiente','Realizada','Cancelada')),
    nota_admin        TEXT,
    aprobado_por      INTEGER     REFERENCES users(id),
    UNIQUE(id_curso, id_estudiante)
  )`,

  `CREATE TABLE IF NOT EXISTS documentos_adjuntos (
    id_documento      INTEGER     PRIMARY KEY,
    entidad_tipo      TEXT        NOT NULL CHECK (entidad_tipo IN ('estudiante','afiliado','empresa','curso')),
    entidad_id        INTEGER     NOT NULL,
    tipo_doc          TEXT        NOT NULL,
    url               TEXT        NOT NULL,
    nombre_archivo    TEXT,
    fecha_documento   TEXT,
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_docs_entidad ON documentos_adjuntos(entidad_tipo, entidad_id)`,

  // ===========================================================
  // MÓDULO LEGAL Y DISCIPLINARIO
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS denuncias (
    id_denuncia          INTEGER     PRIMARY KEY,
    id_denunciante       INTEGER     REFERENCES users(id),
    nombre_denunciante   TEXT,
    email_denunciante    TEXT,
    tipo_denuncia        TEXT        NOT NULL CHECK (tipo_denuncia IN ('Ética','Ejercicio Ilegal','Inmobiliaria','Otros')),
    asunto               TEXT        NOT NULL,
    descripcion          TEXT        NOT NULL,
    estatus              TEXT        DEFAULT 'Recibida' CHECK (estatus IN ('Recibida','En Revisión','Investigación','Resuelta','Desestimada')),
    fecha_creacion       TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    ultima_actualizacion TEXT,
    eliminado_en         TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_denuncias_usuario ON denuncias(id_denunciante)`,
  `CREATE INDEX IF NOT EXISTS idx_denuncias_estatus ON denuncias(estatus)`,

  `CREATE TABLE IF NOT EXISTS historial_denuncias (
    id_historial      INTEGER     PRIMARY KEY,
    id_denuncia       INTEGER     NOT NULL REFERENCES denuncias(id_denuncia) ON DELETE CASCADE,
    estatus_anterior  TEXT,
    estatus_nuevo     TEXT        NOT NULL,
    comentarios       TEXT,
    cambiado_por      INTEGER     NOT NULL REFERENCES users(id),
    fecha_cambio      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_historial_denuncia ON historial_denuncias(id_denuncia)`,
  `CREATE INDEX IF NOT EXISTS idx_historial_cambiador ON historial_denuncias(cambiado_por)`,

  `CREATE TABLE IF NOT EXISTS evidencias_legales (
    id_evidencia      INTEGER     PRIMARY KEY,
    id_denuncia       INTEGER     NOT NULL REFERENCES denuncias(id_denuncia) ON DELETE CASCADE,
    nombre_archivo    TEXT,
    url_archivo       TEXT        NOT NULL,
    creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_evidencias_denuncia ON evidencias_legales(id_denuncia)`,

  `CREATE TABLE IF NOT EXISTS planes_gestion (
    id_plan           INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    periodo           TEXT,
    archivo_url       TEXT        NOT NULL,
    activo            INTEGER     DEFAULT 1 CHECK (activo IN (0,1)),
    eliminado_en      TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS actas_y_convocatorias (
    id_acta           INTEGER     PRIMARY KEY,
    tipo              TEXT        NOT NULL CHECK (tipo IN ('Acta Asamblea','Convocatoria','Circular','Reglamento')),
    titulo            TEXT        NOT NULL,
    fecha_publicacion TEXT        NOT NULL,
    archivo_url       TEXT        NOT NULL,
    eliminado_en      TEXT
  )`,

  // ===========================================================
  // CMS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cms_noticias (
    id_noticia        INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    slug              TEXT        UNIQUE NOT NULL,
    resumen           TEXT,
    contenido         TEXT,
    imagen_url        TEXT,
    categoria         TEXT,
    fecha_publicacion TEXT        DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    publicado         INTEGER     DEFAULT 0 CHECK (publicado IN (0,1)),
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cms_noticias_activas ON cms_noticias(eliminado_en) WHERE eliminado_en IS NULL`,

  `CREATE TABLE IF NOT EXISTS cms_cursos (
    id_cms_curso      INTEGER     PRIMARY KEY,
    titulo            TEXT        NOT NULL,
    slug              TEXT        UNIQUE NOT NULL,
    descripcion_corta TEXT,
    modalidad         TEXT,
    precio            INTEGER,
    imagen_url        TEXT,
    publicado         INTEGER     DEFAULT 1 CHECK (publicado IN (0,1)),
    eliminado_en      TEXT
  )`,

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

  `CREATE TABLE IF NOT EXISTS cms_directiva (
    id_miembro        INTEGER     PRIMARY KEY,
    nombre            TEXT        NOT NULL,
    cargo             TEXT        NOT NULL,
    periodo           TEXT,
    foto_url          TEXT,
    orden             INTEGER     DEFAULT 0,
    activo            INTEGER     DEFAULT 1 CHECK (activo IN (0,1)),
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cms_directiva_activos ON cms_directiva(eliminado_en) WHERE eliminado_en IS NULL`,

  `CREATE TABLE IF NOT EXISTS cms_hitos (
    id_hito           INTEGER     PRIMARY KEY,
    año               TEXT        NOT NULL,
    titulo            TEXT        NOT NULL,
    descripcion       TEXT,
    orden             INTEGER     DEFAULT 0,
    eliminado_en      TEXT
  )`,

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

  `CREATE TABLE IF NOT EXISTS cms_configuracion (
    clave             TEXT        PRIMARY KEY,
    valor             TEXT,
    actualizado_en    TEXT        DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,

  `CREATE TABLE IF NOT EXISTS cms_paginas (
    id_pagina         INTEGER     PRIMARY KEY,
    slug              TEXT        UNIQUE NOT NULL,
    titulo            TEXT        NOT NULL,
    contenido         TEXT,
    meta_title        TEXT,
    meta_desc         TEXT,
    actualizado_en    TEXT        DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_en      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cms_paginas_activas ON cms_paginas(eliminado_en) WHERE eliminado_en IS NULL`
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

  console.log('\n--- SEEDING INITIAL DATA ---')

  const adminEmail = 'admin@admin.com'
  const hashedPassword = await bcrypt.hash('admin123', 10)
  try {
    await db.execute({
      sql: `INSERT INTO users (email, password_hash, roles, activo) VALUES (?, ?, ?, ?)`,
      args: [adminEmail, hashedPassword, '["admin", "super_admin"]', 1]
    })
    console.log(`  · Admin user ${adminEmail} created.`)
  } catch (e) {
    console.log(`  · User ${adminEmail} already exists.`)
  }

  try {
    await db.execute({
      sql: `INSERT INTO instructores (id_instructor, nombre, especialidad) VALUES (?, ?, ?)`,
      args: [1, 'Instructor Global', 'General']
    })
    console.log(`  · Instructor 1 created.`)
  } catch (e) {
    console.log(`  · Instructor 1 already exists.`)
  }

  const convenios = [
    {
      nombre: 'Universidad Católica Andrés Bello (UCAB)',
      descripcion: 'Convenio de cooperación académica para diplomados y certificaciones inmobiliarias.',
      link_web: 'https://www.ucab.edu.ve/'
    },
    {
      nombre: 'Banco Mercantil',
      descripcion: 'Alianza estratégica para facilitar el acceso a servicios financieros de nuestros afiliados.',
      link_web: 'https://www.mercantilbanco.com/'
    }
  ]

  for (const conv of convenios) {
    try {
      await db.execute({
        sql: `INSERT INTO cms_convenios (nombre, descripcion, link_web) VALUES (?, ?, ?)`,
        args: [conv.nombre, conv.descripcion, conv.link_web]
      })
      console.log(`  · Convenio ${conv.nombre} created.`)
    } catch (e) { }
  }

  const directiva = [
    { nombre: 'Francisco Piñango', cargo: 'Presidente', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/f27423cc-13ab-4f52-98d9-a522c3399a7a-francisco.png', orden: 1 },
    { nombre: 'Zulay Amaya', cargo: 'Vicepresidenta', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/5e52879f-0239-4704-90d3-dd91eccd1d81-Zulay.png', orden: 2 },
    { nombre: 'Margaret Vásquez', cargo: 'Directora General', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/44df32ba-c5f7-44b7-b5d6-08c304049f5f-Margaret.png', orden: 3 },
    { nombre: 'Romelina Rodríguez', cargo: 'Directora de Finanzas', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/62a9b887-b201-4a67-ac02-23ec8c145903-Romelia.png', orden: 4 },
    { nombre: 'Margot Castro', cargo: 'Directora de Asuntos Legales', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/2d321e4e-d27b-4360-8fd6-6308d618ac23-Margot.png', orden: 5 },
    { nombre: 'Pedro Vallenilla', cargo: 'Director de Comunicaciones', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/54535e6d-04ae-4b48-b412-043d83874b17-Pedro.png', orden: 6 },
    { nombre: 'Graciela Ledezma', cargo: 'Directora de Formación', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/842e53dc-6a64-41f0-bb29-2156b31436d6-Graciela.png', orden: 7 },
    { nombre: 'Yorjharry Vicent', cargo: 'Director de Eventos', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/0bdc53ba-09a4-48b5-94c0-3eb2036972a4-Yorjharry.png', orden: 8 },
    { nombre: 'Rina Centeno', cargo: 'Directora de Responsabilidad Social', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/369c66b5-ef78-4fd9-9a7a-96a53b05f2b8-Rina.png', orden: 9 },
    { nombre: 'Pedro Castro', cargo: 'Director de Relaciones Interinstitucionales', foto_url: 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/directiva/ddf60ab1-7113-479d-80c4-c9a3fcdde232-Pedro_C.png', orden: 10 },
  ]

  for (const m of directiva) {
    try {
      await db.execute({
        sql: `INSERT INTO cms_directiva (nombre, cargo, foto_url, orden, activo) VALUES (?, ?, ?, ?, 1)`,
        args: [m.nombre, m.cargo, m.foto_url, m.orden]
      })
      console.log(`  · Miembro Directiva ${m.nombre} created.`)
    } catch (e) { }
  }

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
      console.log(`  · Normativa ${n.titulo} created.`)
    } catch (e) { }
  }

  console.log('\nDB Initialization complete!\n')
}

run().catch(console.error)