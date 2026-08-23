import { db } from '../lib/db.js'

async function migrate() {
  console.log('--- STARTING DATABASE SCHEMA MIGRATION ---')

  // 1. Temporarily disable foreign key constraints for table structure changes
  console.log('Disabling foreign key constraints...')
  await db.execute('PRAGMA foreign_keys = OFF')

  try {
    // PRE-CLEANING DATA TO SATISFY CHECK AND UNIQUE CONSTRAINTS
    console.log('Pre-cleaning database records to prevent constraint violations...')

    // A. Delete orphan persona ID 46 to resolve clash on Cedula '139'
    console.log('Deleting orphan persona ID 46 if it exists...')
    await db.execute('DELETE FROM personas WHERE id = 46')

    // B. Clean invalid RIF numbers in empresas table
    console.log('Cleaning invalid RIF numbers in empresas...')
    const invalidEmpresas = await db.execute("SELECT id_empresa, razon_social, rif_numero FROM empresas WHERE rif_numero GLOB '*[^0-9]*'")
    for (const row of invalidEmpresas.rows) {
      const id = row.id_empresa as number
      const originalRif = row.rif_numero as string
      let cleaned = originalRif.replace(/[^0-9]/g, '')
      if (!cleaned) {
        cleaned = '999' + String(id).padStart(5, '0')
      }
      console.log(`  · Cleaning RIF for company ID ${id} "${row.razon_social}": "${originalRif}" -> "${cleaned}"`)
      await db.execute({
        sql: "UPDATE empresas SET rif_numero = ? WHERE id_empresa = ?",
        args: [cleaned, id]
      })
    }

    // C. Clean invalid Cedulas in personas table
    console.log('Cleaning invalid Cedulas in personas...')
    const invalidPersonas = await db.execute("SELECT id, nombres, apellidos, cedula FROM personas WHERE cedula GLOB '*[^0-9]*'")
    for (const row of invalidPersonas.rows) {
      const id = row.id as number
      const originalCedula = row.cedula as string
      let cleaned = originalCedula.replace(/[^0-9]/g, '').trim()
      if (!cleaned) {
        cleaned = '999' + String(id).padStart(5, '0')
      }
      console.log(`  · Cleaning Cedula for persona ID ${id} "${row.nombres} ${row.apellidos}": "${originalCedula}" -> "${cleaned}"`)
      await db.execute({
        sql: "UPDATE personas SET cedula = ? WHERE id = ?",
        args: [cleaned, id]
      })
    }

    // 2. MIGRATING USERS TABLE (drop reset_token_hash, reset_token_expira)
    const usersColumns = await db.execute('PRAGMA table_info(users)')
    const hasOldUsersColumns = usersColumns.rows.some(r => r.name === 'reset_token_hash')
    
    // Idempotency: drop tokens_accion if old token tables still exist to allow a clean retry
    const oldTokensExist = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('invitaciones_empresa', 'verificaciones_email', 'verificaciones_preinscripciones')")
    if (oldTokensExist.rows.length > 0) {
      console.log('Old token tables still exist. Dropping tokens_accion for clean retry...')
      await db.execute('DROP TABLE IF EXISTS tokens_accion')
    }

    await db.execute(`CREATE TABLE IF NOT EXISTS tokens_accion (
      id              INTEGER PRIMARY KEY,
      token           TEXT    UNIQUE NOT NULL,
      tipo            TEXT    NOT NULL CHECK (tipo IN ('reset_password','invitacion_empresa','verificacion_email','preinscripcion')),
      email           TEXT,
      data_json       TEXT,
      usado           INTEGER NOT NULL DEFAULT 0,
      fecha_expiracion TEXT   NOT NULL,
      creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    )`)

    if (hasOldUsersColumns) {
      console.log('Migrating reset tokens from users table to tokens_accion...')
      const oldTokens = await db.execute('SELECT email, reset_token_hash, reset_token_expira FROM users WHERE reset_token_hash IS NOT NULL')
      for (const row of oldTokens.rows) {
        const email = row.email as string
        const token = row.reset_token_hash as string
        const expiration = row.reset_token_expira as string
        
        await db.execute({
          sql: "INSERT OR IGNORE INTO tokens_accion (token, tipo, email, usado, fecha_expiracion, creado_en) VALUES (?, 'reset_password', ?, 0, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
          args: [token, email, expiration || '']
        })
      }

      console.log('Rebuilding users table (dropping reset token columns)...')
      await db.execute(`CREATE TABLE IF NOT EXISTS users_new (
        id                  INTEGER     PRIMARY KEY,
        email               TEXT        UNIQUE NOT NULL,
        password_hash       TEXT        NOT NULL,
        roles               TEXT        NOT NULL DEFAULT '["afiliado"]',
        activo              INTEGER     NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
        creado_en           TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        actualizado_en      TEXT,
        eliminado_en        TEXT
      )`)

      await db.execute(`INSERT INTO users_new (id, email, password_hash, roles, activo, creado_en, actualizado_en, eliminado_en)
        SELECT id, email, password_hash, roles, activo, creado_en, actualizado_en, eliminado_en FROM users`)

      await db.execute('DROP TABLE users')
      await db.execute('ALTER TABLE users_new RENAME TO users')
      await db.execute("CREATE INDEX IF NOT EXISTS idx_users_activos ON users(eliminado_en) WHERE eliminado_en IS NULL")
      console.log('Users table migrated.')
    }

    // 3. MIGRATING EMPRESAS TABLE (drop estatus, banner_url)
    const empresasColumns = await db.execute('PRAGMA table_info(empresas)')
    const hasOldEmpresasColumns = empresasColumns.rows.some(r => r.name === 'estatus')
    if (hasOldEmpresasColumns) {
      console.log('Rebuilding empresas table (dropping estatus and banner_url columns)...')
      await db.execute(`CREATE TABLE IF NOT EXISTS empresas_new (
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
      )`)

      await db.execute(`INSERT INTO empresas_new (
        id_empresa, id_user, razon_social, rif_tipo, rif_numero, email, direccion, telefono, website, logo_url, notas, fecha_registro, actualizado_en, eliminado_en, id_representante_legal, redes_sociales
      ) SELECT id_empresa, id_user, razon_social, rif_tipo, rif_numero, email, direccion, telefono, website, logo_url, notas, fecha_registro, actualizado_en, eliminado_en, id_representante_legal, redes_sociales FROM empresas`)

      await db.execute('DROP TABLE empresas')
      await db.execute('ALTER TABLE empresas_new RENAME TO empresas')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_empresas_rif ON empresas(rif_numero)')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_empresas_activos ON empresas(eliminado_en) WHERE eliminado_en IS NULL')
      console.log('Empresas table migrated.')
    }

    // 4. MIGRATING AFILIADOS TABLE (rename cibir_convalidado to cibir_acreditado, drop inscripcion_pagada)
    const afiliadosColumns = await db.execute('PRAGMA table_info(afiliados)')
    const hasCibirConvalidado = afiliadosColumns.rows.some(r => r.name === 'cibir_convalidado')
    const hasInscripcionPagada = afiliadosColumns.rows.some(r => r.name === 'inscripcion_pagada')
    if (hasCibirConvalidado || hasInscripcionPagada) {
      console.log('Rebuilding afiliados table (renaming cibir_convalidado and dropping inscripcion_pagada)...')
      await db.execute(`CREATE TABLE IF NOT EXISTS afiliados_new (
        id_afiliado                 INTEGER     PRIMARY KEY,
        id_user                     INTEGER     UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        id_persona                  INTEGER     UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
        codigo                      TEXT        UNIQUE,
        tipo_afiliado               TEXT        NOT NULL DEFAULT 'Natural'
                                                CHECK (tipo_afiliado IN ('Natural','Corporativo','Agente Corporativo')),
        notes                       TEXT,
        estatus                     TEXT        NOT NULL DEFAULT '1_PREINSCRIPCION'
                                                CHECK (estatus IN (
                                                  '1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA',
                                                  '4_VERIFICACION','5_CIBIR','6_INSCRIPCION',
                                                  'Requiere Acción','Afiliado','Moroso','Suspendido','Rechazado'
                                                )),
        cibir_acreditado            INTEGER     NOT NULL DEFAULT 0 CHECK (cibir_acreditado IN (0,1)),
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
      )`)

      const cibirColSource = hasCibirConvalidado ? 'cibir_convalidado' : 'cibir_acreditado'

      await db.execute(`INSERT INTO afiliados_new (
        id_afiliado, id_user, id_persona, codigo, tipo_afiliado, notes, estatus, cibir_acreditado, id_empresa, fecha_registro, fecha_ultimo_cambio_estatus, fecha_afiliacion, ano_inicio_servicio, actualizado_en, eliminado_en, redes_sociales, activo
      ) SELECT id_afiliado, id_user, id_persona, codigo, tipo_afiliado, notas, estatus, ${cibirColSource}, id_empresa, fecha_registro, fecha_ultimo_cambio_estatus, fecha_afiliacion, ano_inicio_servicio, actualizado_en, eliminado_en, redes_sociales, activo FROM afiliados`)

      await db.execute('DROP TABLE afiliados')
      await db.execute('ALTER TABLE afiliados_new RENAME TO afiliados')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_afiliados_estatus ON afiliados(estatus)')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_afiliados_empresa ON afiliados(id_empresa)')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_afiliados_persona ON afiliados(id_persona)')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_afiliados_activos ON afiliados(eliminado_en) WHERE eliminado_en IS NULL')
      console.log('Afiliados table migrated.')
    }

    // 5. MIGRATING convalidaciones_cibir TO acreditaciones_cibir
    const convalidacionesTable = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='convalidaciones_cibir'")
    if (convalidacionesTable.rows.length > 0) {
      console.log('Renaming convalidaciones_cibir to acreditaciones_cibir...')
      await db.execute('ALTER TABLE convalidaciones_cibir RENAME TO acreditaciones_cibir')
      await db.execute('DROP INDEX IF EXISTS idx_convalidaciones_afiliado')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_acreditaciones_afiliado ON acreditaciones_cibir(id_afiliado)')
      console.log('Acreditaciones CIBIR table migrated.')
    }

    // 6. UNIFYING DOCUMENTS (documentos)
    // Idempotency: drop documentos if old documents tables still exist to allow a clean retry
    const oldDocsExist = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('documentos_afiliado', 'documentos_empresa', 'documentos_adjuntos')")
    if (oldDocsExist.rows.length > 0) {
      console.log('Old document tables still exist. Dropping new documentos table for clean retry...')
      await db.execute('DROP TABLE IF EXISTS documentos')
    }

    const docsTableRes = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documentos'")
    if (docsTableRes.rows.length === 0) {
      console.log('Creating unified documentos table and migrating files...')
      await db.execute(`CREATE TABLE IF NOT EXISTS documentos (
        id_documento    INTEGER PRIMARY KEY,
        entidad_tipo    TEXT    NOT NULL CHECK (entidad_tipo IN ('afiliado','empresa','estudiante','curso')),
        entidad_id      INTEGER NOT NULL,
        nombre_archivo  TEXT    NOT NULL,
        url             TEXT    NOT NULL,
        tipo_archivo    TEXT,
        fecha_subida    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        eliminado_en    TEXT
      )`)
      await db.execute('CREATE INDEX IF NOT EXISTS idx_documentos_entidad ON documentos(entidad_tipo, entidad_id)')

      // Migrate documentos_afiliado
      const tableAfilDocs = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documentos_afiliado'")
      if (tableAfilDocs.rows.length > 0) {
        const docs = await db.execute('SELECT id_afiliado, nombre_documento, url_documento, tipo_archivo, fecha_subida, eliminado_en FROM documentos_afiliado')
        for (const doc of docs.rows) {
          const nombreArchivo = (doc.nombre_documento as string) || (doc.url_documento as string).split('/').pop() || 'archivo'
          await db.execute({
            sql: `INSERT INTO documentos (entidad_tipo, entidad_id, nombre_archivo, url, tipo_archivo, fecha_subida, eliminado_en) VALUES ('afiliado', ?, ?, ?, ?, ?, ?)`,
            args: [doc.id_afiliado, nombreArchivo, doc.url_documento, doc.tipo_archivo, doc.fecha_subida, doc.eliminado_en]
          })
        }
        await db.execute('DROP TABLE documentos_afiliado')
      }

      // Migrate documentos_empresa
      const tableEmpDocs = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documentos_empresa'")
      if (tableEmpDocs.rows.length > 0) {
        const docs = await db.execute('SELECT id_empresa, nombre_documento, url_documento, tipo_archivo, fecha_subida, eliminado_en FROM documentos_empresa')
        for (const doc of docs.rows) {
          const nombreArchivo = (doc.nombre_documento as string) || (doc.url_documento as string).split('/').pop() || 'archivo'
          await db.execute({
            sql: `INSERT INTO documentos (entidad_tipo, entidad_id, nombre_archivo, url, tipo_archivo, fecha_subida, eliminado_en) VALUES ('empresa', ?, ?, ?, ?, ?, ?)`,
            args: [doc.id_empresa, nombreArchivo, doc.url_documento, doc.tipo_archivo, doc.fecha_subida, doc.eliminado_en]
          })
        }
        await db.execute('DROP TABLE documentos_empresa')
      }

      // Migrate documentos_adjuntos
      const tableAdjDocs = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documentos_adjuntos'")
      if (tableAdjDocs.rows.length > 0) {
        const docs = await db.execute('SELECT entidad_tipo, entidad_id, nombre_archivo, url, tipo_doc, creado_en FROM documentos_adjuntos')
        for (const doc of docs.rows) {
          const nombreArchivo = (doc.nombre_archivo as string) || (doc.url as string).split('/').pop() || 'archivo'
          await db.execute({
            sql: `INSERT INTO documentos (entidad_tipo, entidad_id, nombre_archivo, url, tipo_archivo, fecha_subida, eliminado_en) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
            args: [doc.entidad_tipo, doc.entidad_id, nombreArchivo, doc.url, doc.tipo_doc, doc.creado_en]
          })
        }
        await db.execute('DROP TABLE documentos_adjuntos')
      }
      console.log('Documentos unified.')
    }

    // 7. UNIFYING TOKENS (tokens_accion)
    // We already created tokens_accion above, now let's migrate the obsolete token tables
    const tableInvitaciones = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='invitaciones_empresa'")
    if (tableInvitaciones.rows.length > 0) {
      console.log('Migrating invitaciones_empresa to tokens_accion...')
      const rows = await db.execute('SELECT id_empresa, token, nombre_empresa, activo, fecha_expiracion, creado_en FROM invitaciones_empresa WHERE eliminado_en IS NULL')
      for (const row of rows.rows) {
        const dataJson = JSON.stringify({ id_empresa: row.id_empresa, nombre_empresa: row.nombre_empresa })
        const usado = row.activo === 1 ? 0 : 1
        await db.execute({
          sql: `INSERT OR IGNORE INTO tokens_accion (token, tipo, email, data_json, usado, fecha_expiracion, creado_en) VALUES (?, 'invitacion_empresa', NULL, ?, ?, ?, ?)`,
          args: [row.token, dataJson, usado, row.fecha_expiracion || '', row.creado_en]
        })
      }
      await db.execute('DROP TABLE invitaciones_empresa')
    }

    const tableVerizacionesEmail = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='verificaciones_email'")
    if (tableVerizacionesEmail.rows.length > 0) {
      console.log('Migrating verificaciones_email to tokens_accion...')
      const rows = await db.execute('SELECT token_verificacion, nombre_completo, cedula_rif, email, telefono, fecha_expiracion, usado FROM verificaciones_email')
      for (const row of rows.rows) {
        const dataJson = JSON.stringify({
          nombre_completo: row.nombre_completo,
          cedula_rif: row.cedula_rif,
          telefono: row.telefono
        })
        await db.execute({
          sql: `INSERT OR IGNORE INTO tokens_accion (token, tipo, email, data_json, usado, fecha_expiracion, creado_en) VALUES (?, 'verificacion_email', ?, ?, ?, ?, ?)`,
          args: [row.token_verificacion, row.email, dataJson, row.usado || 0, row.fecha_expiracion, row.fecha_expiracion]
        })
      }
      await db.execute('DROP TABLE verificaciones_email')
    }

    const tablePreinscripciones = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='verificaciones_preinscripciones'")
    if (tablePreinscripciones.rows.length > 0) {
      console.log('Migrating verificaciones_preinscripciones to tokens_accion...')
      const rows = await db.execute('SELECT * FROM verificaciones_preinscripciones WHERE eliminado_en IS NULL')
      for (const row of rows.rows) {
        const meta = {
          nombres: row.nombres,
          apellidos: row.apellidos,
          cedula: row.cedula,
          telefono: row.telefono,
          nivel_academico: row.nivel_academico,
          profesion: row.profesion,
          ano_inicio_servicio: row.ano_inicio_servicio,
          tipo_afiliado: row.tipo_afiliado,
          id_empresa: row.id_empresa,
          razon_social: row.razon_social,
          rif_tipo: row.rif_tipo,
          rif_numero: row.rif_numero,
          empresa_telefono: row.empresa_telefono,
          representante_legal_nombres: row.representante_legal_nombres,
          representante_legal_apellidos: row.representante_legal_apellidos,
          representante_legal_cedula: row.representante_legal_cedula,
          representante_legal_email: row.representante_legal_email,
          programa_interes: row.programa_interes,
          es_corredor_inmobiliario: row.es_corredor_inmobiliario,
          estatus: row.estatus,
          procesado_en: row.procesado_en
        }
        const dataJson = JSON.stringify(meta)
        const usado = row.estatus === 'pendiente' ? 0 : 1
        await db.execute({
          sql: `INSERT OR IGNORE INTO tokens_accion (token, tipo, email, data_json, usado, fecha_expiracion, creado_en) VALUES (?, 'preinscripcion', ?, ?, ?, ?, ?)`,
          args: [row.token_verificacion, row.email, dataJson, usado, row.fecha_expiracion, row.creado_en]
        })
      }
      await db.execute('DROP TABLE verificaciones_preinscripciones')
      console.log('Tokens unified.')
    }

    // 8. MIGRATING INSTRUCTORES TO PROFESORES
    const tableInstructores = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='instructores'")
    if (tableInstructores.rows.length > 0) {
      console.log('Migrating instructores to profesores table...')
      // Idempotency: drop profesores if old instructores table still exists to allow clean retry
      await db.execute('DROP TABLE IF EXISTS profesores')

      await db.execute(`CREATE TABLE IF NOT EXISTS profesores (
        id_profesor       INTEGER     PRIMARY KEY AUTOINCREMENT,
        id_persona        INTEGER     UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
        id_afiliado       INTEGER     UNIQUE REFERENCES afiliados(id_afiliado) ON DELETE SET NULL,
        creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        actualizado_en    TEXT
      )`)

      const instructores = await db.execute('SELECT * FROM instructores')
      for (const ins of instructores.rows) {
        const nombre = ins.nombre as string
        const email = (ins.email as string) || `instructor_${ins.id_instructor}@ciebo.com`
        const telefono = (ins.telefono as string) || null
        const especialidad = (ins.especialidad as string) || null

        let personaId: number | null = null
        const existingPersona = await db.execute({
          sql: 'SELECT id FROM personas WHERE email = ?',
          args: [email]
        })

        if (existingPersona.rows.length > 0) {
          personaId = Number(existingPersona.rows[0].id)
        } else {
          const nameParts = nombre.trim().split(/\s+/)
          const nombres = nameParts[0] || 'Instructor'
          const apellidos = nameParts.slice(1).join(' ') || 'Cámara'
          
          // Generate a purely numeric fallback identity card number to avoid CHECK constraints
          const cedula = '999' + String(ins.id_instructor).padStart(5, '0')

          const newPersona = await db.execute({
            sql: 'INSERT INTO personas (nombres, apellidos, cedula, email, telefono, profesion) VALUES (?, ?, ?, ?, ?, ?)',
            args: [nombres, apellidos, cedula, email, telefono, especialidad]
          })
          personaId = Number(newPersona.lastInsertRowid)
        }

        const existingAfiliado = await db.execute({
          sql: 'SELECT id_afiliado FROM afiliados WHERE id_persona = ?',
          args: [personaId]
        })
        const idAfiliado = existingAfiliado.rows.length > 0 ? Number(existingAfiliado.rows[0].id_afiliado) : null

        await db.execute({
          sql: 'INSERT OR IGNORE INTO profesores (id_persona, id_afiliado) VALUES (?, ?)',
          args: [personaId, idAfiliado]
        })
      }
      await db.execute('DROP TABLE instructores')
      console.log('Instructores migrated.')
    }

    // 9. MIGRATING CURSOS TABLE (drop id_instructor, precio_miembro, precio_publico, cupos_disponibles, destacado)
    const cursosColumns = await db.execute('PRAGMA table_info(cursos)')
    const hasOldCursosColumns = cursosColumns.rows.some(r => r.name === 'id_instructor' || r.name === 'precio_miembro')
    if (hasOldCursosColumns) {
      console.log('Rebuilding cursos table (dropping obsolete academic and public pricing columns)...')
      await db.execute(`CREATE TABLE IF NOT EXISTS cursos_new (
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
        imagen_url        TEXT,
        banner_url        TEXT,
        cupos_totales     INTEGER,
        creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        actualizado_en    TEXT,
        eliminado_en      TEXT
      )`)

      await db.execute(`INSERT INTO cursos_new (
        id_curso, titulo, slug, descripcion, contenido, categoria, fecha_inicio, fecha_fin, modalidad, estatus, imagen_url, banner_url, cupos_totales, creado_en, actualizado_en, eliminado_en
      ) SELECT id_curso, titulo, slug, descripcion, contenido, categoria, fecha_inicio, fecha_fin, modalidad, estatus, imagen_url, banner_url, cupos_totales, creado_en, actualizado_en, eliminado_en FROM cursos`)

      await db.execute('DROP TABLE cursos')
      await db.execute('ALTER TABLE cursos_new RENAME TO cursos')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_cursos_activos ON cursos(eliminado_en) WHERE eliminado_en IS NULL')
      console.log('Cursos table migrated.')
    }

    // 10. CREATE ACADEMIC MODULES TABLES
    console.log('Creating modulos_curso and modulos_inscripcion tables...')
    await db.execute(`CREATE TABLE IF NOT EXISTS modulos_curso (
      id_curso      INTEGER NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
      nombre_modulo TEXT NOT NULL,
      orden         INTEGER DEFAULT 0,
      id_profesor   INTEGER REFERENCES profesores(id_profesor) ON DELETE SET NULL,
      PRIMARY KEY (id_curso, nombre_modulo)
    )`)

    await db.execute(`CREATE TABLE IF NOT EXISTS modulos_inscripcion (
      id              INTEGER PRIMARY KEY,
      id_inscripcion  INTEGER NOT NULL REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE CASCADE,
      nombre_modulo   TEXT NOT NULL,
      estatus         TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente','Aprobado','Rechazado')),
      aprobado_por    INTEGER REFERENCES users(id),
      nota_admin      TEXT,
      fecha_evaluacion TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      UNIQUE(id_inscripcion, nombre_modulo)
    )`)

    const miCols = await db.execute('PRAGMA table_info(modulos_inscripcion)')
    const hasNombreModulo = miCols.rows.some(r => r.name === 'nombre_modulo')
    const hasNumModulo = miCols.rows.some(r => r.name === 'num_modulo')
    if (!hasNombreModulo) {
      console.log('Adding nombre_modulo column to modulos_inscripcion...')
      await db.execute('ALTER TABLE modulos_inscripcion ADD COLUMN nombre_modulo TEXT')
      if (hasNumModulo) {
        await db.execute("UPDATE modulos_inscripcion SET nombre_modulo = 'Módulo ' || num_modulo WHERE (nombre_modulo IS NULL OR nombre_modulo = '') AND num_modulo IS NOT NULL")
      }
    }

    // 11. MIGRATING INSCRIPCIONES_CURSOS (drop columns, migrate interviews, migrate certificate urls, PRESERVE/RESTORE programa_codigo)
    const inscripcionesColumns = await db.execute('PRAGMA table_info(inscripciones_cursos)')
    const hasOldInscripcionesColumns = inscripcionesColumns.rows.some(r => r.name === 'certificado_url' || r.name === 'entrevista_fecha')
    const hasProgCod = inscripcionesColumns.rows.some(r => r.name === 'programa_codigo')
    
    if (hasOldInscripcionesColumns || !hasProgCod) {
      console.log('Rebuilding inscripciones_cursos table (migrating interviews and certificate URLs, keeping/restoring programa_codigo)...')
      
      // Clean up certificates_new or interviews table if they already exist from a previous failed run
      await db.execute('DROP TABLE IF EXISTS entrevistas')
      await db.execute('DROP TABLE IF EXISTS certificados_new')

      // Migrate interviews
      const hasEntrevistaFecha = inscripcionesColumns.rows.some(r => r.name === 'entrevista_fecha')
      if (hasEntrevistaFecha) {
        console.log('Creating entrevistas table and migrating old interviews...')
        await db.execute(`CREATE TABLE IF NOT EXISTS entrevistas (
          id_entrevista   INTEGER PRIMARY KEY,
          id_afiliado     INTEGER REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
          id_inscripcion  INTEGER REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE CASCADE,
          fecha           TEXT    NOT NULL,
          hora            TEXT,
          lugar           TEXT,
          estatus         TEXT    NOT NULL DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente','Realizada','Cancelada')),
          notes           TEXT,
          creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
          actualizado_en  TEXT,
          eliminado_en    TEXT,
          CONSTRAINT chk_entrevista_exclusiva CHECK (
            (id_afiliado IS NOT NULL AND id_inscripcion IS NULL) OR
            (id_afiliado IS NULL AND id_inscripcion IS NOT NULL)
          )
        )`)
        await db.execute('CREATE INDEX IF NOT EXISTS idx_entrevistas_afiliado ON entrevistas(id_afiliado)')
        await db.execute('CREATE INDEX IF NOT EXISTS idx_entrevistas_inscripcion ON entrevistas(id_inscripcion)')
        await db.execute('CREATE INDEX IF NOT EXISTS idx_entrevistas_estatus ON entrevistas(estatus)')

        const interviews = await db.execute('SELECT id_inscripcion, entrevista_fecha, entrevista_hora, entrevista_lugar, entrevista_estatus, notas FROM inscripciones_cursos WHERE entrevista_fecha IS NOT NULL')
        for (const row of interviews.rows) {
          let status = row.entrevista_estatus as string
          if (status === 'N/A' || !status) {
            status = 'Pendiente'
          }
          await db.execute({
            sql: 'INSERT INTO entrevistas (id_inscripcion, fecha, hora, lugar, estatus, notes) VALUES (?, ?, ?, ?, ?, ?)',
            args: [row.id_inscripcion, row.entrevista_fecha, row.entrevista_hora, row.entrevista_lugar, status, row.notes || row.notas || '']
          })
        }
      }

      // Recreate certificados table with url column if url does not exist
      const tableCertificados = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='certificados'")
      if (tableCertificados.rows.length > 0) {
        const certCols = await db.execute('PRAGMA table_info(certificados)')
        const hasUrlCol = certCols.rows.some(r => r.name === 'url')
        if (!hasUrlCol) {
          console.log('Rebuilding certificados table to include url column and importing URLs...')
          await db.execute(`CREATE TABLE IF NOT EXISTS certificados_new (
            id_certificado      INTEGER     PRIMARY KEY,
            id_inscripcion      INTEGER     NOT NULL UNIQUE REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE CASCADE,
            codigo_validacion   TEXT        NOT NULL UNIQUE,
            url                 TEXT        NOT NULL,
            fecha_emision       TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            eliminado_en        TEXT
          )`)

          const certRows = await db.execute('SELECT c.id_certificado, c.id_inscripcion, c.codigo_validacion, c.fecha_emision, c.eliminado_en, i.certificado_url FROM certificados c LEFT JOIN inscripciones_cursos i ON c.id_inscripcion = i.id_inscripcion')
          for (const cert of certRows.rows) {
            const url = (cert.certificado_url as string) || ''
            await db.execute({
              sql: 'INSERT OR IGNORE INTO certificados_new (id_certificado, id_inscripcion, codigo_validacion, url, fecha_emision, eliminado_en) VALUES (?, ?, ?, ?, ?, ?)',
              args: [cert.id_certificado, cert.id_inscripcion, cert.codigo_validacion, url, cert.fecha_emision, cert.eliminado_en]
            })
          }

          await db.execute('DROP TABLE certificados')
          await db.execute('ALTER TABLE certificados_new RENAME TO certificados')
          await db.execute('CREATE INDEX IF NOT EXISTS idx_certificados_inscripcion ON certificados(id_inscripcion)')
          await db.execute('CREATE INDEX IF NOT EXISTS idx_certificados_codigo ON certificados(codigo_validacion)')
        }
      }

      // Recreate inscripciones_cursos preserving/restoring programa_codigo
      await db.execute(`CREATE TABLE IF NOT EXISTS inscripciones_cursos_new (
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
      )`)

      const hasOldProgCod = inscripcionesColumns.rows.some(r => r.name === 'programa_codigo')
      if (hasOldProgCod) {
        console.log('Copying existing programa_codigo data...')
        await db.execute(`INSERT INTO inscripciones_cursos_new (
          id_inscripcion, id_estudiante, id_curso, programa_codigo, tipo_inscripcion, estatus, estatus_academico, id_empresa, fecha_inscripcion, creado_en, actualizado_en, completado, nota_admin, aprobado_por
        ) SELECT id_inscripcion, id_estudiante, id_curso, programa_codigo, tipo_inscripcion, estatus, estatus_academico, id_empresa, fecha_inscripcion, creado_en, actualizado_en, completado, nota_admin, aprobado_por FROM inscripciones_cursos`)
      } else {
        // Heuristic recovery of program types
        console.log('WARNING: Old table did not contain programa_codigo. Attempting heuristic recovery of program types...')
        const currentInscriptions = await db.execute('SELECT id_inscripcion, id_estudiante, id_curso, tipo_inscripcion, estatus, estatus_academico, id_empresa, fecha_inscripcion, creado_en, actualizado_en, completado, nota_admin, aprobado_por FROM inscripciones_cursos')
        
        const byStudent = new Map<number, any[]>()
        for (const row of currentInscriptions.rows) {
          const est = row.id_estudiante as number
          if (!byStudent.has(est)) byStudent.set(est, [])
          byStudent.get(est)!.push(row)
        }

        for (const row of currentInscriptions.rows) {
          const id = row.id_inscripcion as number
          const est = row.id_estudiante as number
          const isProg = row.tipo_inscripcion === 'programa' || row.id_curso === null
          let progCod: string | null = null

          if (isProg) {
            const studentInscriptions = byStudent.get(est) || []
            const progInscriptions = studentInscriptions.filter(i => i.tipo_inscripcion === 'programa' || i.id_curso === null)
            if (progInscriptions.length > 1) {
              progInscriptions.sort((a, b) => (a.id_inscripcion as number) - (b.id_inscripcion as number))
              if ((progInscriptions[0].id_inscripcion as number) === id) {
                progCod = 'AFILIACION'
              } else {
                progCod = 'CIBIR'
              }
            } else {
              progCod = 'AFILIACION'
            }
          }

          await db.execute({
            sql: `INSERT INTO inscripciones_cursos_new (
              id_inscripcion, id_estudiante, id_curso, programa_codigo, tipo_inscripcion, estatus, estatus_academico, id_empresa, fecha_inscripcion, creado_en, actualizado_en, completado, nota_admin, aprobado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              id, est, row.id_curso, progCod, row.tipo_inscripcion || (row.id_curso ? 'curso' : 'programa'),
              row.estatus, row.estatus_academico, row.id_empresa, row.fecha_inscripcion, row.creado_en,
              row.actualizado_en, row.completado, row.nota_admin, row.aprobado_por
            ]
          })
        }
      }

      await db.execute('DROP TABLE inscripciones_cursos')
      await db.execute('ALTER TABLE inscripciones_cursos_new RENAME TO inscripciones_cursos')
      console.log('Inscripciones_cursos table migrated.')
    }

    // 12. MIGRATING cms_directiva TO directiva_cargos (linking to affiliates)
    const tableCmsDirectiva = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cms_directiva'")
    if (tableCmsDirectiva.rows.length > 0) {
      console.log('Migrating cms_directiva to directiva_cargos...')
      // Idempotency: drop directiva_cargos if cms_directiva still exists to allow clean retry
      await db.execute('DROP TABLE IF EXISTS directiva_cargos')

      await db.execute(`CREATE TABLE IF NOT EXISTS directiva_cargos (
        id              INTEGER PRIMARY KEY,
        id_afiliado     INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
        cargo           TEXT    NOT NULL,
        periodo         TEXT,
        orden           INTEGER DEFAULT 0,
        activo          INTEGER DEFAULT 1 CHECK (activo IN (0,1)),
        creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        actualizado_en  TEXT
      )`)
      await db.execute('CREATE INDEX IF NOT EXISTS idx_directiva_afiliado ON directiva_cargos(id_afiliado)')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_directiva_activos ON directiva_cargos(activo)')

      const directiva = await db.execute('SELECT * FROM cms_directiva WHERE eliminado_en IS NULL')
      for (const m of directiva.rows) {
        const nombreCompleto = (m.nombre as string).trim().toLowerCase()
        
        // Search for the affiliate matching the member's name
        const checkAfiliado = await db.execute({
          sql: `
            SELECT a.id_afiliado
            FROM afiliados a
            JOIN personas p ON a.id_persona = p.id
            WHERE LOWER(p.nombres || ' ' || p.apellidos) LIKE ?
               OR LOWER(p.apellidos || ' ' || p.nombres) LIKE ?
               OR ? LIKE '%' || LOWER(p.nombres) || '%'
          `,
          args: [`%${nombreCompleto}%`, `%${nombreCompleto}%`, nombreCompleto]
        })

        if (checkAfiliado.rows.length > 0) {
          const idAfiliado = Number(checkAfiliado.rows[0].id_afiliado)
          await db.execute({
            sql: 'INSERT INTO directiva_cargos (id_afiliado, cargo, periodo, orden, activo) VALUES (?, ?, ?, ?, ?)',
            args: [idAfiliado, m.cargo, m.periodo || '', m.orden || 0, m.activo || 1]
          })
          console.log(`  · Matched directiva member '${m.nombre}' to affiliate ID: ${idAfiliado}`)
        } else {
          console.log(`  · WARNING: Directiva member '${m.nombre}' could not be matched to a registered affiliate. (Skipped matching)`)
        }
      }
      await db.execute('DROP TABLE cms_directiva')
      console.log('Directiva migrated.')
    }

    // 13. MIGRATING cms_cursos TO REMOVE precio COLUMN
    const cmsCursosColumns = await db.execute('PRAGMA table_info(cms_cursos)')
    const hasPrecioCol = cmsCursosColumns.rows.some(r => r.name === 'precio')
    if (hasPrecioCol) {
      console.log('Rebuilding cms_cursos table (dropping precio column)...')
      await db.execute(`CREATE TABLE IF NOT EXISTS cms_cursos_new (
        id_cms_curso      INTEGER     PRIMARY KEY,
        titulo            TEXT        NOT NULL,
        slug              TEXT        UNIQUE NOT NULL,
        descripcion_corta TEXT,
        modalidad         TEXT,
        imagen_url        TEXT,
        publicado         INTEGER     DEFAULT 1 CHECK (publicado IN (0,1)),
        eliminado_en      TEXT
      )`)
      await db.execute(`INSERT INTO cms_cursos_new (id_cms_curso, titulo, slug, descripcion_corta, modalidad, imagen_url, publicado, eliminado_en)
        SELECT id_cms_curso, titulo, slug, descripcion_corta, modalidad, imagen_url, publicado, eliminado_en FROM cms_cursos`)
      await db.execute('DROP TABLE cms_cursos')
      await db.execute('ALTER TABLE cms_cursos_new RENAME TO cms_cursos')
      console.log('Cms_cursos table migrated.')
    }

    // 14. DROPPING OBSOLETE TABLES
    const dropTables = [
      'denuncias',
      'historial_denuncias',
      'evidencias_legales',
      'planes_gestion',
      'actas_y_convocatorias',
      'transacciones'
    ]

    for (const tableName of dropTables) {
      console.log(`Dropping obsolete table: ${tableName}...`)
      await db.execute(`DROP TABLE IF EXISTS ${tableName}`)
    }

    // 14.5. ADD OPTAR_ACREDITACION COLUMN TO AFILIADOS
    console.log('Adding optar_acreditacion column to afiliados table if not exists...')
    try {
      await db.execute(`
        ALTER TABLE afiliados 
        ADD COLUMN optar_acreditacion INTEGER NOT NULL DEFAULT 0 CHECK (optar_acreditacion IN (0, 1))
      `)
      console.log('  · optar_acreditacion column added successfully.')
    } catch (e: any) {
      if (e.message?.includes('duplicate column name') || e.message?.includes('already exists')) {
        console.log('  · optar_acreditacion column already exists.')
      } else {
        console.warn('  · Warning trying to add optar_acreditacion column:', e.message)
      }
    }

    // 14.6. ADD ORDEN COLUMN TO CMS_NOTICIAS
    console.log('Adding orden column to cms_noticias table if not exists...')
    try {
      await db.execute(`
        ALTER TABLE cms_noticias 
        ADD COLUMN orden INTEGER DEFAULT 0
      `)
      console.log('  · orden column added to cms_noticias successfully.')
    } catch (e: any) {
      if (e.message?.includes('duplicate column name') || e.message?.includes('already exists')) {
        console.log('  · orden column already exists in cms_noticias.')
      } else {
        console.warn('  · Warning trying to add orden column to cms_noticias:', e.message)
      }
    }

    // 14.7. ADD ORDEN COLUMN TO CURSOS
    console.log('Adding orden column to cursos table if not exists...')
    try {
      await db.execute(`
        ALTER TABLE cursos 
        ADD COLUMN orden INTEGER DEFAULT 0
      `)
      console.log('  · orden column added to cursos successfully.')
    } catch (e: any) {
      if (e.message?.includes('duplicate column name') || e.message?.includes('already exists')) {
        console.log('  · orden column already exists in cursos.')
      } else {
        console.warn('  · Warning trying to add orden column to cursos:', e.message)
      }
    }

    console.log('--- DATABASE MIGRATION COMPLETED SUCCESSFULLY ---')

  } catch (error) {
    console.error('--- FATAL ERROR DURING DATABASE MIGRATION ---')
    console.error(error)
    throw error
  } finally {
    // 15. Re-enable foreign key constraints
    console.log('Re-enabling foreign key constraints...')
    await db.execute('PRAGMA foreign_keys = ON')
  }
}

migrate().catch(console.error)
