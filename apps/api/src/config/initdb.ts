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
import { env } from './env.js'
import bcrypt from 'bcryptjs'
import { toTitleCase } from '../lib/formatters.js'
import { asegurarEsquemaCohortes } from '../lib/cohortes.js'

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
  // EDICIONES CIBIR
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS ediciones_cibir (
    id_edicion      INTEGER     PRIMARY KEY,
    nombre          TEXT        NOT NULL,
    descripcion     TEXT,
    fecha_inicio    TEXT        NOT NULL,
    fecha_fin       TEXT,
    estado          TEXT        NOT NULL DEFAULT 'Planificada'
                                CHECK (estado IN ('Planificada','Abierta','Cerrada','Finalizada')),
    cupo_maximo     INTEGER,
    creado_por      INTEGER     REFERENCES users(id),
    creado_en       TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en  TEXT,
    eliminado_en    TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ediciones_cibir_estado ON ediciones_cibir(estado)`,

  `CREATE TABLE IF NOT EXISTS inscripciones_edicion_cibir (
    id                    INTEGER     PRIMARY KEY,
    id_edicion            INTEGER     NOT NULL REFERENCES ediciones_cibir(id_edicion) ON DELETE CASCADE,
    id_afiliado           INTEGER     NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    estatus               TEXT        NOT NULL DEFAULT 'Preinscrito'
                                      CHECK (estatus IN ('Preinscrito','Aprobado','Rechazado','Cancelado')),
    asignado_automatico   INTEGER     NOT NULL DEFAULT 1 CHECK (asignado_automatico IN (0,1)),
    aprobado_por          INTEGER     REFERENCES users(id),
    nota_admin            TEXT,
    fecha_asignacion      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    fecha_resolucion      TEXT,
    id_inscripcion_curso  INTEGER     REFERENCES inscripciones_cursos(id_inscripcion),
    actualizado_en        TEXT,
    UNIQUE(id_edicion, id_afiliado)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_insc_edicion_cibir_afiliado ON inscripciones_edicion_cibir(id_afiliado)`,
  `CREATE INDEX IF NOT EXISTS idx_insc_edicion_cibir_edicion  ON inscripciones_edicion_cibir(id_edicion)`,

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
    solo_afiliados    INTEGER     NOT NULL DEFAULT 0 CHECK (solo_afiliados IN (0,1)),
    requiere_aprobacion INTEGER   NOT NULL DEFAULT 0 CHECK (requiere_aprobacion IN (0,1)),
    orden             INTEGER     DEFAULT 0,
    imagen_url        TEXT,
    banner_url        TEXT,
    cupos_totales     INTEGER,
    precio_afiliado_usd REAL,
    precio_publico_usd  REAL,
    horas_reserva     INTEGER     NOT NULL DEFAULT 48,
    firmantes         TEXT,
    cursos_excluyentes TEXT       DEFAULT '[]',
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
    firmantes_snapshot  TEXT,
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
  // ===========================================================
  // CUENTAS BANCARIAS RECEPTORAS DE LA CÁMARA
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS cuentas_bancarias_camara (
    id_cuenta       INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo            TEXT NOT NULL CHECK (tipo IN ('pago_movil', 'transferencia', 'zelle', 'efectivo', 'otro')),
    banco           TEXT NOT NULL,
    beneficiario    TEXT NOT NULL,
    identificacion  TEXT NOT NULL,
    numero_cuenta   TEXT,
    telefono        TEXT,
    email           TEXT,
    instrucciones   TEXT,
    activo          INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    orden           INTEGER DEFAULT 0,
    creado_en       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en  TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cuentas_bancarias_activo ON cuentas_bancarias_camara(activo)`,

  // ===========================================================
  // ARANCELES Y TARIFAS GREMIALES/ACADÉMICAS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS aranceles_config (
    codigo          TEXT PRIMARY KEY,
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    monto_usd       REAL NOT NULL,
    categoria       TEXT NOT NULL CHECK (categoria IN ('afiliacion', 'mensualidad', 'formacion', 'servicio')),
    activo          INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    actualizado_en  TEXT
  )`,

  // ===========================================================
  // PAGOS Y RECIBOS
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS pagos (
    id_pago               INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_recibo         TEXT UNIQUE NOT NULL,
    -- Pagador: un afiliado o, en cursos cobrados en taquilla, un estudiante sin afiliación.
    -- RESTRICT: borrar un afiliado no debe borrar ventas del libro.
    id_afiliado           INTEGER REFERENCES afiliados(id_afiliado) ON DELETE RESTRICT,
    id_estudiante         INTEGER REFERENCES estudiantes(id_estudiante) ON DELETE RESTRICT,
    id_inscripcion_curso  INTEGER REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE SET NULL,
    id_edicion_cibir      INTEGER REFERENCES ediciones_cibir(id_edicion) ON DELETE SET NULL,
    tipo_concepto         TEXT NOT NULL CHECK (tipo_concepto IN ('formalizacion_afiliacion', 'curso_cibir', 'mensualidad', 'curso', 'programa', 'otro')),
    codigo_arancel        TEXT,
    descripcion_concepto  TEXT NOT NULL,
    metodo_pago           TEXT NOT NULL CHECK (metodo_pago IN (
                            'efectivo_usd', 'efectivo_bs', 'pago_movil',
                            'transferencia_bs', 'zelle', 'pos_debito', 'binance_usdt', 'otro'
                          )),
    moneda                TEXT NOT NULL CHECK (moneda IN ('USD', 'VES')),
    monto                 REAL NOT NULL,
    monto_usd_equivalente REAL NOT NULL,
    tasa_bcv              REAL,
    banco_origen          TEXT,
    banco_destino         TEXT,
    referencia            TEXT,
    titular_origen        TEXT,
    telefono_origen       TEXT,
    comprobante_url       TEXT,
    estatus               TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente', 'Verificado', 'Rechazado', 'Anulado')),
    origen_registro       TEXT NOT NULL DEFAULT 'admin' CHECK (origen_registro IN ('afiliado', 'admin')),
    registrado_por        INTEGER REFERENCES users(id),
    verificado_por        INTEGER REFERENCES users(id),
    fecha_pago            TEXT NOT NULL,
    fecha_verificacion    TEXT,
    motivo_rechazo        TEXT,
    notas                 TEXT,
    creado_en             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en        TEXT,
    eliminado_en          TEXT,
    CHECK (id_afiliado IS NOT NULL OR id_estudiante IS NOT NULL)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_afiliado ON pagos(id_afiliado)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_inscripcion ON pagos(id_inscripcion_curso)`,
  // Constancias de solvencia (una por afiliado y mes, verificables por código)
  `CREATE TABLE IF NOT EXISTS constancias_solvencia (
    id_constancia     INTEGER PRIMARY KEY,
    codigo_validacion TEXT    NOT NULL UNIQUE,
    id_afiliado       INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    periodo           TEXT    NOT NULL,
    emitida_en        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    valida_hasta      TEXT    NOT NULL,
    UNIQUE (id_afiliado, periodo)
  )`,
  // Avisos de cobranza enviados (el UNIQUE diario evita duplicados si el cron se reintenta)
  `CREATE TABLE IF NOT EXISTS avisos_cobranza (
    id_aviso     INTEGER PRIMARY KEY,
    id_afiliado  INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    tipo         TEXT    NOT NULL CHECK (tipo IN ('previo', 'vencimiento', 'mora', 'manual')),
    periodo      TEXT    NOT NULL,
    fecha_dia    TEXT    NOT NULL,
    enviado_en   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE (id_afiliado, tipo, fecha_dia)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_estatus ON pagos(estatus)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_recibo ON pagos(numero_recibo)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_edicion_cibir ON pagos(id_edicion_cibir)`,

  // ===========================================================
  // MOVIMIENTOS FINANCIEROS Y GASTOS (CONTABILIDAD / LIBRO DE COMPRAS Y VENTAS)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS movimientos_financieros (
    id_movimiento         INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo                  TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    categoria             TEXT NOT NULL CHECK (categoria IN (
                            'afiliacion', 'curso', 'convenio', 'servicio',
                            'alquiler', 'servicios_publicos', 'nomina', 'honorarios',
                            'papeleria', 'mantenimiento', 'impuestos', 'donacion',
                            'gasto_operativo', 'gasto_admin', 'otro'
                          )),
    fecha                 TEXT NOT NULL,
    concepto              TEXT NOT NULL,
    proveedor_cliente     TEXT NOT NULL,
    rif_cedula            TEXT,
    nro_factura_documento TEXT,
    nro_control_fiscal    TEXT,
    base_imponible        REAL NOT NULL DEFAULT 0,
    monto_exento          REAL NOT NULL DEFAULT 0,
    alicuota_iva          REAL NOT NULL DEFAULT 0,
    monto_iva             REAL NOT NULL DEFAULT 0,
    monto_total           REAL NOT NULL,
    monto_usd_equivalente REAL NOT NULL,
    moneda                TEXT NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'VES')),
    tasa_bcv              REAL,
    metodo_pago           TEXT NOT NULL DEFAULT 'transferencia',
    referencia_pago       TEXT,
    banco_origen          TEXT,
    comprobante_url       TEXT,
    estatus               TEXT NOT NULL DEFAULT 'completado' CHECK (estatus IN ('completado', 'pendiente', 'anulado')),
    id_pago               INTEGER REFERENCES pagos(id_pago) ON DELETE SET NULL,
    id_afiliado           INTEGER REFERENCES afiliados(id_afiliado) ON DELETE SET NULL,
    id_curso              INTEGER REFERENCES cursos(id_curso) ON DELETE SET NULL,
    motivo_anulacion      TEXT,
    notas                 TEXT,
    registrado_por        INTEGER REFERENCES users(id),
    creado_en             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en        TEXT,
    eliminado_en          TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mov_tipo ON movimientos_financieros(tipo)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_fecha ON movimientos_financieros(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_categoria ON movimientos_financieros(categoria)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_estatus ON movimientos_financieros(estatus)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_pago ON movimientos_financieros(id_pago)`,

  // ===========================================================
  // REFERENCIAS Y TASAS DE CAMBIO (USD BCV / BINANCE USDT)
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS tasas_cambio_referencia (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo              TEXT UNIQUE NOT NULL,
    nombre              TEXT NOT NULL,
    tasa                REAL NOT NULL,
    moneda_origen       TEXT NOT NULL DEFAULT 'USD',
    moneda_destino      TEXT NOT NULL DEFAULT 'VES',
    fuente              TEXT NOT NULL,
    fecha_actualizacion TEXT NOT NULL,
    es_manual           INTEGER NOT NULL DEFAULT 0 CHECK (es_manual IN (0, 1)),
    detalles_json       TEXT DEFAULT '{}',
    actualizado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS historial_tasas_cambio (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo              TEXT NOT NULL,
    tasa                REAL NOT NULL,
    fuente              TEXT NOT NULL,
    fecha               TEXT NOT NULL,
    creado_en           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_historial_tasas_cod ON historial_tasas_cambio(codigo, fecha)`,

  // ===========================================================
  // MÓDULO DE DENUNCIAS Y TRIBUNAL ÉTICO/DISCIPLINARIO
  // ===========================================================
  `CREATE TABLE IF NOT EXISTS denuncias (
    id_denuncia                 INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo                      TEXT UNIQUE NOT NULL,
    pin_seguimiento             TEXT NOT NULL,
    tipo_denunciante            TEXT NOT NULL DEFAULT 'no_afiliado' CHECK (tipo_denunciante IN ('afiliado', 'no_afiliado')),
    id_afiliado_denunciante     INTEGER REFERENCES afiliados(id_afiliado) ON DELETE SET NULL,
    id_user_denunciante         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    nombre_denunciante          TEXT NOT NULL,
    cedula_rif_denunciante      TEXT NOT NULL,
    email_denunciante           TEXT NOT NULL,
    telefono_denunciante        TEXT NOT NULL,
    direccion_denunciante       TEXT,
    id_afiliado_denunciado      INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE RESTRICT,
    nombre_denunciado_snapshot  TEXT NOT NULL,
    codigo_afiliado_denunciado  TEXT,
    tipo_falta                  TEXT NOT NULL CHECK (tipo_falta IN (
                                  'incumplimiento_contrato',
                                  'comisiones_indebidas',
                                  'publicidad_enganosa',
                                  'falta_etica',
                                  'retencion_documentos',
                                  'fraude_estafa',
                                  'otro'
                                )),
    titulo                      TEXT NOT NULL,
    descripcion_hechos          TEXT NOT NULL,
    inmueble_referencia         TEXT,
    monto_involucrado           REAL DEFAULT 0,
    moneda_monto                TEXT DEFAULT 'USD' CHECK (moneda_monto IN ('USD', 'VES')),
    prioridad                   TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    estatus                     TEXT NOT NULL DEFAULT 'recibida' CHECK (estatus IN (
                                  'recibida',
                                  'en_revision',
                                  'en_descargos',
                                  'en_mediacion',
                                  'resuelta',
                                  'desestimada',
                                  'archivada'
                                )),
    fecha_presentacion          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    fecha_admisibilidad         TEXT,
    fecha_audiencia_mediacion   TEXT,
    lugar_modalidad_audiencia   TEXT,
    descargo_afiliado           TEXT,
    fecha_descargo              TEXT,
    tipo_resolucion             TEXT CHECK (tipo_resolucion IS NULL OR tipo_resolucion IN (
                                  'conciliacion_acuerdo',
                                  'amonestacion_privada',
                                  'amonestacion_publica',
                                  'suspension_temporal',
                                  'expulsion_definitiva',
                                  'desestimacion_sin_lugar',
                                  'otro'
                                )),
    dictamen_resolucion         TEXT,
    acta_resolucion_url         TEXT,
    resuelto_por                INTEGER REFERENCES users(id),
    fecha_resolucion            TEXT,
    notas_internas              TEXT,
    creado_en                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    actualizado_en              TEXT,
    eliminado_en                TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_denuncias_codigo ON denuncias(codigo)`,
  `CREATE INDEX IF NOT EXISTS idx_denuncias_estatus ON denuncias(estatus)`,
  `CREATE INDEX IF NOT EXISTS idx_denuncias_denunciado ON denuncias(id_afiliado_denunciado)`,
  `CREATE INDEX IF NOT EXISTS idx_denuncias_denunciante ON denuncias(id_afiliado_denunciante)`,

  `CREATE TABLE IF NOT EXISTS documentos_denuncia (
    id_documento_denuncia       INTEGER PRIMARY KEY AUTOINCREMENT,
    id_denuncia                 INTEGER NOT NULL REFERENCES denuncias(id_denuncia) ON DELETE CASCADE,
    tipo_origen                 TEXT NOT NULL CHECK (tipo_origen IN ('denunciante', 'denunciado', 'camara_resolucion')),
    nombre_archivo              TEXT NOT NULL,
    url                         TEXT NOT NULL,
    creado_en                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_docs_denuncia ON documentos_denuncia(id_denuncia)`,

  `CREATE TABLE IF NOT EXISTS historial_denuncia (
    id_historial                INTEGER PRIMARY KEY AUTOINCREMENT,
    id_denuncia                 INTEGER NOT NULL REFERENCES denuncias(id_denuncia) ON DELETE CASCADE,
    estatus_anterior            TEXT,
    estatus_nuevo               TEXT NOT NULL,
    accion                      TEXT NOT NULL,
    comentario                  TEXT,
    es_visible_partes           INTEGER NOT NULL DEFAULT 1 CHECK (es_visible_partes IN (0, 1)),
    usuario_id                  INTEGER REFERENCES users(id),
    fecha                       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_historial_denuncia ON historial_denuncia(id_denuncia)`,

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
    firma_url       TEXT,
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

  console.log('  ⚠ Cohortes (tabla, columna y triggers de asignación)...')
  await asegurarEsquemaCohortes(db)

  console.log('  ⚠ Cleaning up cedula and rif_numero (removing prefixes and non-digits)...')
  try {
    // personas: quitar prefijos comunes V, E, P, guiones y puntos
    await db.execute(`UPDATE personas SET cedula = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cedula, 'V', ''), 'E', ''), 'P', ''), '-', ''), '.', '') WHERE cedula GLOB '*[^0-9]*'`)
    // empresas: quitar prefijos J, G, P, V, E, guiones y puntos
    await db.execute(`UPDATE empresas SET rif_numero = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(rif_numero, 'J', ''), 'G', ''), 'P', ''), 'V', ''), 'E', ''), '-', ''), '.', '') WHERE rif_numero GLOB '*[^0-9]*'`)
    // Migración: asegurar que exista foto_junta_url y firma_url en directiva_cargos
    try {
      await db.execute(`ALTER TABLE directiva_cargos ADD COLUMN foto_junta_url TEXT`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    try {
      await db.execute(`ALTER TABLE directiva_cargos ADD COLUMN firma_url TEXT`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: asegurar que exista firmantes en cursos
    try {
      await db.execute(`ALTER TABLE cursos ADD COLUMN firmantes TEXT`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: asegurar que exista cursos_excluyentes en cursos
    try {
      await db.execute(`ALTER TABLE cursos ADD COLUMN cursos_excluyentes TEXT DEFAULT '[]'`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: asegurar que exista solo_afiliados en cursos (curso privado)
    try {
      await db.execute(`ALTER TABLE cursos ADD COLUMN solo_afiliados INTEGER NOT NULL DEFAULT 0 CHECK (solo_afiliados IN (0,1))`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: curso con aprobación manual de inscritos (0 = inscripción directa)
    try {
      await db.execute(`ALTER TABLE cursos ADD COLUMN requiere_aprobacion INTEGER NOT NULL DEFAULT 0 CHECK (requiere_aprobacion IN (0,1))`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: asegurar que exista firmantes_snapshot en certificados
    try {
      await db.execute(`ALTER TABLE certificados ADD COLUMN firmantes_snapshot TEXT`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: asegurar que exista asignado_por en inscripciones_cursos
    try {
      await db.execute(`ALTER TABLE inscripciones_cursos ADD COLUMN asignado_por INTEGER`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: asegurar tablas de ediciones CIBIR
    try {
      await db.execute(`CREATE TABLE IF NOT EXISTS ediciones_cibir (
        id_edicion      INTEGER     PRIMARY KEY,
        nombre          TEXT        NOT NULL,
        descripcion     TEXT,
        fecha_inicio    TEXT        NOT NULL,
        fecha_fin       TEXT,
        estado          TEXT        NOT NULL DEFAULT 'Planificada'
                                    CHECK (estado IN ('Planificada','Abierta','Cerrada','Finalizada')),
        cupo_maximo     INTEGER,
        creado_por      INTEGER     REFERENCES users(id),
        creado_en       TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        actualizado_en  TEXT,
        eliminado_en    TEXT
      )`)
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_ediciones_cibir_estado ON ediciones_cibir(estado)`)
      await db.execute(`CREATE TABLE IF NOT EXISTS inscripciones_edicion_cibir (
        id                    INTEGER     PRIMARY KEY,
        id_edicion            INTEGER     NOT NULL REFERENCES ediciones_cibir(id_edicion) ON DELETE CASCADE,
        id_afiliado           INTEGER     NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
        estatus               TEXT        NOT NULL DEFAULT 'Preinscrito'
                                          CHECK (estatus IN ('Preinscrito','Aprobado','Rechazado','Cancelado')),
        asignado_automatico   INTEGER     NOT NULL DEFAULT 1 CHECK (asignado_automatico IN (0,1)),
        aprobado_por          INTEGER     REFERENCES users(id),
        nota_admin            TEXT,
        fecha_asignacion      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        fecha_resolucion      TEXT,
        id_inscripcion_curso  INTEGER     REFERENCES inscripciones_cursos(id_inscripcion),
        actualizado_en        TEXT,
        UNIQUE(id_edicion, id_afiliado)
      )`)
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_edicion_cibir_afiliado ON inscripciones_edicion_cibir(id_afiliado)`)
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_edicion_cibir_edicion  ON inscripciones_edicion_cibir(id_edicion)`)
    } catch (e) {
      console.warn('Error asegurando tablas ediciones_cibir:', e)
    }
    // Migración: registro del último correo de confirmación enviado al inscrito
    for (const col of ['correo_confirmacion_enviado_en TEXT', 'correo_confirmacion_id TEXT']) {
      try {
        await db.execute(`ALTER TABLE inscripciones_cursos ADD COLUMN ${col}`)
      } catch (e) {
        // Ignorar si la columna ya existe
      }
    }
    // Historial de solvencia importado de listados externos (sin recibos): un mes por afiliado
    await db.execute(`CREATE TABLE IF NOT EXISTS solvencia_historial (
      id_afiliado  INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
      periodo      TEXT    NOT NULL,
      estado       TEXT    NOT NULL CHECK (estado IN ('pagado', 'no_afiliado')),
      fuente       TEXT,
      importado_en TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      PRIMARY KEY (id_afiliado, periodo)
    )`)
    // Migración: mes que cubre cada pago de mensualidad (línea de tiempo de solvencia)
    for (const col of ['periodo TEXT', 'meses_cubiertos INTEGER NOT NULL DEFAULT 1']) {
      try {
        await db.execute(`ALTER TABLE pagos ADD COLUMN ${col}`)
      } catch (e) {
        // Ignorar si la columna ya existe
      }
    }
    // Migración: precios de cursos (afiliado / público, NULL o 0 = gratis) y horas de reserva de cupo
    for (const col of ['precio_afiliado_usd REAL', 'precio_publico_usd REAL', 'horas_reserva INTEGER NOT NULL DEFAULT 48']) {
      try {
        await db.execute(`ALTER TABLE cursos ADD COLUMN ${col}`)
      } catch (e) {
        // Ignorar si la columna ya existe
      }
    }
    // Migración: logo de marca del afiliado (lo leen las consultas de afiliados; faltaba en bases nuevas)
    try {
      await db.execute(`ALTER TABLE afiliados ADD COLUMN marca_logo_url TEXT`)
    } catch (e) {
      // Ignorar si la columna ya existe
    }
    // Migración: reserva de cupo en cursos de pago (vence y precio congelado al reservar)
    for (const col of ['reserva_vence_en TEXT', 'monto_usd REAL']) {
      try {
        await db.execute(`ALTER TABLE inscripciones_cursos ADD COLUMN ${col}`)
      } catch (e) {
        // Ignorar si la columna ya existe
      }
    }
    // personas: normalizar nombres y apellidos a Title Case
    const personasRows = await db.execute(`SELECT id, nombres, apellidos FROM personas`)
    for (const p of personasRows.rows) {
      const oldN = String(p.nombres || '')
      const oldA = String(p.apellidos || '')
      const newN = toTitleCase(oldN)
      const newA = toTitleCase(oldA)
      if (oldN !== newN || oldA !== newA) {
        await db.execute({
          sql: `UPDATE personas SET nombres = ?, apellidos = ? WHERE id = ?`,
          args: [newN, newA, p.id]
        })
      }
    }

    console.log('  · OK: Data cleaned and persona names formatted to Title Case.')
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

  const b2Base = (env.B2_PUBLIC_URL_BASE || 'https://f005.backblazeb2.com/file/files-supa/').replace(/\/$/, '')
  // Normativas de ejemplo
  const normativas = [
    { titulo: "ESTATUTOS CIV", categoria: "Reglamentos y Estatutos", url: `${b2Base}/public-docs/normativas/48add48d-420a-4ae5-ab70-5fc02369b56e-Estatutos-CIV.pdf` },
    { titulo: "CÓDIGO DE ÉTICA DEL PROFESIONAL INMOBILIARIO", categoria: "Reglamentos y Estatutos", url: `${b2Base}/public-docs/normativas/812fd943-a934-4ab9-a7e1-cf4d0831c10f-Codigo-etica-vigencia_-29-09-2.020-ONCDOFT.pdf` },
    { titulo: "REGLAMENTO CERTIFICACIÓN DEL PROFESIONAL INMOBILIARIO CIV", categoria: "Reglamentos y Estatutos", url: `${b2Base}/public-docs/normativas/6e9fd86a-a714-414e-b38d-ae999297e522-REGLAMENTO-DE-CERTIFICACION-CIV-APROBADO-JUNTA-DIRECTIVA-1-1.pdf` },
    { titulo: "LEY PARA LA REGULARIZACIÓN Y CONTROL DE LOS ARRENDAMIENTOS DE VIVIENDA", categoria: "Reglamentos y Estatutos", url: `${b2Base}/public-docs/normativas/15705918-16ba-42c6-9637-a2cb0eb53a2f-mietengesetz-venezuela-1.pdf` },
    { titulo: "ACTA DE ASAMBLEA ORDINARIA CIEB (SEPT 2012)", categoria: "Actas de Asamblea", url: `${b2Base}/public-docs/normativas/2723a35a-a51f-40d2-ad23-08aef4c57104-Acta_Asamblea_Ordinaria_de_la_Camara.pdf` },
    { titulo: "ACTA CONSTITUTIVA Y ESTATURIA DE LA CÁMARA", categoria: "Actas de Asamblea", url: `${b2Base}/public-docs/normativas/b2cf8ff2-5ef7-45c3-b113-ad2e97f44eab-Acta-1.pdf` },
    { titulo: "LEY DE FISCALIZACIÓN Y FINANCIAMIENTO DE LAS ONG", categoria: "Leyes y Decretos", url: `${b2Base}/public-docs/normativas/8262feae-4105-41e7-8cf4-1d6a7baa741a-GACETA-6855_(1).pdf` }
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

  // ── Aranceles iniciales ──
  const arancelesIniciales = [
    { codigo: 'inscripcion_natural', nombre: 'Inscripción Miembro Natural', descripcion: 'Cuota de formalización de membresía natural', monto_usd: 25.00, categoria: 'afiliacion' },
    { codigo: 'inscripcion_corporativo', nombre: 'Inscripción Miembro Corporativo', descripcion: 'Cuota de formalización de membresía corporativa', monto_usd: 25.00, categoria: 'afiliacion' },
    { codigo: 'inscripcion_agente', nombre: 'Inscripción Agente Corporativo', descripcion: 'Cuota de formalización de agente corporativo', monto_usd: 25.00, categoria: 'afiliacion' },
    { codigo: 'mensualidad_base', nombre: 'Cuota de Sostenimiento', descripcion: 'Cuota mensual de solvencia gremial', monto_usd: 5.00, categoria: 'mensualidad' },
    { codigo: 'curso_cibir', nombre: 'CIBIR', descripcion: 'Arancel de formación del Curso de Iniciación en Bienes Raíces (CIBIR)', monto_usd: 30.00, categoria: 'formacion' },
    // Monto 0 = "Consultar" hasta que el admin lo fije en Finanzas → Aranceles
    { codigo: 'programa_preani', nombre: 'Programa PREANI', descripcion: 'Arancel del programa PREANI', monto_usd: 0, categoria: 'formacion' },
    { codigo: 'programa_pegi', nombre: 'Programa PEGI', descripcion: 'Arancel del programa PEGI', monto_usd: 0, categoria: 'formacion' },
    { codigo: 'programa_padi', nombre: 'Programa PADI', descripcion: 'Arancel del programa PADI', monto_usd: 0, categoria: 'formacion' },
  ]

  for (const ar of arancelesIniciales) {
    try {
      await db.execute({
        sql: `INSERT INTO aranceles_config (codigo, nombre, descripcion, monto_usd, categoria, activo)
              VALUES (?, ?, ?, ?, ?, 1)
              ON CONFLICT(codigo) DO UPDATE SET
                nombre = excluded.nombre,
                descripcion = excluded.descripcion,
                categoria = excluded.categoria`,
        args: [ar.codigo, ar.nombre, ar.descripcion, ar.monto_usd, ar.categoria]
      })
      console.log(`  · Arancel ${ar.codigo} verificado ($${ar.monto_usd}).`)
    } catch (e: any) {
      console.log(`  · Arancel ${ar.codigo} (info: ${e.message})`)
    }
  }

  // ── Cuentas bancarias de ejemplo iniciales ──
  const cuentasIniciales = [
    {
      tipo: 'pago_movil',
      banco: 'Banesco (0134)',
      beneficiario: 'Cámara Inmobiliaria de Bolívar',
      identificacion: 'J-30456789-0',
      telefono: '0414-8889900',
      instrucciones: 'Enviar comprobante con número de referencia y fecha.',
      orden: 1
    },
    {
      tipo: 'transferencia',
      banco: 'Banesco Banco Universal',
      beneficiario: 'Cámara Inmobiliaria de Bolívar',
      identificacion: 'J-30456789-0',
      numero_cuenta: '0134-0000-00-0000000000',
      instrucciones: 'Cuenta Corriente. Notificar con número de referencia.',
      orden: 2
    },
    {
      tipo: 'zelle',
      banco: 'Zelle',
      beneficiario: 'Cámara Inmobiliaria de Bolívar Inc.',
      identificacion: 'Zelle',
      email: 'pagos@camarainmobiliaria.com',
      instrucciones: 'Indicar nombre del afiliado en el memo de la transferencia.',
      orden: 3
    }
  ]

  for (const c of cuentasIniciales) {
    try {
      await db.execute({
        sql: `INSERT INTO cuentas_bancarias_camara (tipo, banco, beneficiario, identificacion, numero_cuenta, telefono, email, instrucciones, activo, orden)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        args: [c.tipo, c.banco, c.beneficiario, c.identificacion, (c as any).numero_cuenta || null, (c as any).telefono || null, (c as any).email || null, c.instrucciones, c.orden]
      })
      console.log(`  · Cuenta bancaria ${c.banco} creada.`)
    } catch (e: any) {
      // ya existe
    }
  }

  // ── Gastos y Compras Operativas Iniciales (Libro de Compras) ──
  const gastosIniciales = [
    {
      tipo: 'egreso',
      categoria: 'alquiler',
      fecha: '2026-03-01',
      concepto: 'Alquiler sede gremial — Marzo 2026',
      proveedor_cliente: 'Inmobiliaria Centro C.A.',
      rif_cedula: 'J-12345678-9',
      nro_factura_documento: 'FAC-00892',
      monto_total: 139.20,
      monto_usd_equivalente: 139.20,
      moneda: 'USD',
      tasa_bcv: 55.0,
      metodo_pago: 'transferencia',
      referencia_pago: 'TRN-99120',
      estatus: 'completado'
    },
    {
      tipo: 'egreso',
      categoria: 'servicios_publicos',
      fecha: '2026-03-05',
      concepto: 'Servicio de energía eléctrica y telecomunicaciones sede',
      proveedor_cliente: 'CORPOELEC / Cantv',
      rif_cedula: 'G-20012345-0',
      nro_factura_documento: 'FAC-E-8823',
      monto_total: 52.20,
      monto_usd_equivalente: 52.20,
      moneda: 'USD',
      tasa_bcv: 55.0,
      metodo_pago: 'pago_movil',
      referencia_pago: 'PM-440192',
      estatus: 'completado'
    },
    {
      tipo: 'egreso',
      categoria: 'papeleria',
      fecha: '2026-03-12',
      concepto: 'Suministros de oficina, carpetas para expedientes y tóner',
      proveedor_cliente: 'Papelería El Gremial RIF J-40567890-1',
      rif_cedula: 'J-40567890-1',
      nro_factura_documento: 'FAC-00441',
      monto_total: 32.48,
      monto_usd_equivalente: 32.48,
      moneda: 'USD',
      tasa_bcv: 55.0,
      metodo_pago: 'efectivo_usd',
      referencia_pago: 'EF-CAJA-01',
      estatus: 'completado'
    }
  ]

  for (const g of gastosIniciales) {
    try {
      const existing = await db.execute({
        sql: `SELECT id_movimiento FROM movimientos_financieros WHERE nro_factura_documento = ?`,
        args: [g.nro_factura_documento]
      })
      if (!existing.rows.length) {
        await db.execute({
          sql: `INSERT INTO movimientos_financieros (
                  tipo, categoria, fecha, concepto, proveedor_cliente, rif_cedula,
                  nro_factura_documento, monto_total, monto_usd_equivalente, moneda, tasa_bcv,
                  metodo_pago, referencia_pago, estatus
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            g.tipo, g.categoria, g.fecha, g.concepto, g.proveedor_cliente, g.rif_cedula,
            g.nro_factura_documento, g.monto_total, g.monto_usd_equivalente, g.moneda, g.tasa_bcv,
            g.metodo_pago, g.referencia_pago, g.estatus
          ]
        })
        console.log(`  · Gasto ${g.nro_factura_documento} (${g.concepto}) insertado.`)
      }
    } catch (e: any) {
      // ignore
    }
  }

  // ── Denuncias Iniciales de Ejemplo (Tribunal de Ética) ──
  try {
    const primerAfiliado = await db.execute(`SELECT id_afiliado, codigo_afiliado FROM afiliados LIMIT 1`);
    if (primerAfiliado.rows.length > 0) {
      const idAfil = Number(primerAfiliado.rows[0].id_afiliado);
      const codAfil = String(primerAfiliado.rows[0].codigo_afiliado || 'CIEB-001');

      const denunciasDemo = [
        {
          codigo: 'DEN-2026-0001',
          pin_seguimiento: '749215',
          tipo_denunciante: 'no_afiliado',
          nombre_denunciante: 'Carlos Rodríguez Pérez',
          cedula_rif_denunciante: 'V-12345678',
          email_denunciante: 'carlos.rodriguez@email.com',
          telefono_denunciante: '0414-1234567',
          direccion_denunciante: 'Puerto Ordaz, Estado Bolívar',
          id_afiliado_denunciado: idAfil,
          nombre_denunciado_snapshot: 'Afiliado Gremial Registrado',
          codigo_afiliado_denunciado: codAfil,
          tipo_falta: 'incumplimiento_contrato',
          titulo: 'Incumplimiento en entrega de documentación de compraventa',
          descripcion_hechos: 'El agente inmobiliario no ha entregado la solvencia municipal ni los documentos de liberación de hipoteca acordados en la opción compraventa suscrita hace 60 días.',
          inmueble_referencia: 'Apartamento Res. Los Samanes, Alta Vista',
          monto_involucrado: 1500,
          prioridad: 'alta',
          estatus: 'en_mediacion',
          fecha_audiencia_mediacion: '2026-04-15T10:00:00Z',
          lugar_modalidad_audiencia: 'Sede Cámara Inmobiliaria de Bolívar (Sala de Juntas)',
          notas_internas: 'Se convocó a ambas partes a mediación presencial.'
        }
      ];

      for (const d of denunciasDemo) {
        const exist = await db.execute({
          sql: `SELECT id_denuncia FROM denuncias WHERE codigo = ?`,
          args: [d.codigo]
        });
        if (!exist.rows.length) {
          const res = await db.execute({
            sql: `INSERT INTO denuncias (
                    codigo, pin_seguimiento, tipo_denunciante, nombre_denunciante,
                    cedula_rif_denunciante, email_denunciante, telefono_denunciante,
                    direccion_denunciante, id_afiliado_denunciado, nombre_denunciado_snapshot,
                    codigo_afiliado_denunciado, tipo_falta, titulo, descripcion_hechos,
                    inmueble_referencia, monto_involucrado, prioridad, estatus,
                    fecha_audiencia_mediacion, lugar_modalidad_audiencia, notas_internas
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              d.codigo, d.pin_seguimiento, d.tipo_denunciante, d.nombre_denunciante,
              d.cedula_rif_denunciante, d.email_denunciante, d.telefono_denunciante,
              d.direccion_denunciante, d.id_afiliado_denunciado, d.nombre_denunciado_snapshot,
              d.codigo_afiliado_denunciado, d.tipo_falta, d.titulo, d.descripcion_hechos,
              d.inmueble_referencia, d.monto_involucrado, d.prioridad, d.estatus,
              d.fecha_audiencia_mediacion, d.lugar_modalidad_audiencia, d.notas_internas
            ]
          });
          const idDen = Number(res.lastInsertRowid);
          await db.execute({
            sql: `INSERT INTO historial_denuncia (id_denuncia, estatus_anterior, estatus_nuevo, accion, comentario)
                  VALUES (?, 'recibida', 'en_mediacion', 'Convocatoria a Mediación', 'Caso admitido y convocado a mediación presencial.')`,
            args: [idDen]
          });
          console.log(`  · Denuncia ${d.codigo} creada.`);
        }
      }
    }
  } catch (e: any) {
    // ignore
  }

  console.log('\n--- DB INIT COMPLETE ---')
  console.log('⚠ La directiva (directiva_cargos) debe poblarse manualmente con afiliados reales.')
}

run().catch(console.error)