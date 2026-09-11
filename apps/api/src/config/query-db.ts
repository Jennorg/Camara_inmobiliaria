import { db } from '../lib/db.js';

async function main() {
  console.log('Inserting 10 more optantes a acreditacion...');
  const now = new Date().toISOString();

  // Helper to ensure companies exist
  async function getOrCreateEmpresa(razon_social: string, rif_numero: string, email: string, telefono: string, direccion: string) {
    let emp = await db.execute({
      sql: `SELECT id_empresa FROM empresas WHERE rif_numero = ?`,
      args: [rif_numero]
    });
    if (emp.rows.length === 0) {
      const resEmp = await db.execute({
        sql: `INSERT INTO empresas (razon_social, rif_tipo, rif_numero, email, telefono, direccion, fecha_registro, actualizado_en)
              VALUES (?, 'J', ?, ?, ?, ?, ?, ?)
              RETURNING id_empresa`,
        args: [razon_social, rif_numero, email, telefono, direccion, now, now]
      });
      return Number(resEmp.rows[0].id_empresa);
    }
    return Number(emp.rows[0].id_empresa);
  }

  const idEmpresaGuayana = await getOrCreateEmpresa(
    'Grupo Inmobiliario & Consultores Guayana C.A.',
    '512039481',
    'contacto@inmobiliariaguayana.com',
    '0286-9234455',
    'Av. Paseo Caroní, C.C. Naraya, Piso 2, Ofic. 12, Puerto Ordaz'
  );

  const idEmpresaCanaima = await getOrCreateEmpresa(
    'Inversiones e Inmuebles Canaima C.A.',
    '523940182',
    'contacto@inmueblescanaima.com',
    '0286-9512233',
    'Calle Cuchivero, Edif. Alta Vista Suites, Mezzanina, Puerto Ordaz'
  );

  // List of 10 candidates
  const candidates = [
    {
      tipo_afiliado: 'Natural',
      nombres: 'Valentina Isabel',
      apellidos: 'Ramos Morales',
      cedula_tipo: 'V',
      cedula: '19823412',
      email: 'valentina.ramos.inmuebles@gmail.com',
      telefono: '0412-3344551',
      nivel_academico: 'Nivel Profesional',
      profesion: 'Licenciada en Administración / Corredora',
      fecha_nacimiento: '1990-04-12',
      ano_inicio_servicio: 2016,
      afiliado_estatus: '2_EXPEDIENTE',
      inscripcion_estatus: 'Preinscrito',
      id_empresa: null as number | null,
      docs: [
        { nombre: 'Cedula_Identidad_V19823412.pdf', url: 'https://placehold.co/doc_v1.pdf', tipo: 'application/pdf' },
        { nombre: 'Titulo_Lic_Administracion.pdf', url: 'https://placehold.co/doc_v2.pdf', tipo: 'application/pdf' },
        { nombre: 'Curriculum_Valentina_Ramos.pdf', url: 'https://placehold.co/doc_v3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Natural',
      nombres: 'Héctor José',
      apellidos: 'Villarroel Fuentes',
      cedula_tipo: 'V',
      cedula: '16298401',
      email: 'hector.villarroel.bienesraices@gmail.com',
      telefono: '0414-7788992',
      nivel_academico: 'Nivel Profesional',
      profesion: 'Arquitecto / Valuador Inmobiliario',
      fecha_nacimiento: '1983-11-05',
      ano_inicio_servicio: 2014,
      afiliado_estatus: '3_ENTREVISTA',
      inscripcion_estatus: 'Entrevista',
      id_empresa: null as number | null,
      docs: [
        { nombre: 'Cedula_Identidad_V16298401.pdf', url: 'https://placehold.co/doc_h1.pdf', tipo: 'application/pdf' },
        { nombre: 'Titulo_Arquitecto_CIV.pdf', url: 'https://placehold.co/doc_h2.pdf', tipo: 'application/pdf' },
        { nombre: 'Certificado_Avaluador.pdf', url: 'https://placehold.co/doc_h3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Natural',
      nombres: 'Gabriela Lucía',
      apellidos: 'Sánchez Padrón',
      cedula_tipo: 'V',
      cedula: '22456789',
      email: 'gabriela.sanchez.inmo@gmail.com',
      telefono: '0424-8899003',
      nivel_academico: 'TSU',
      profesion: 'TSU en Publicidad y Mercadeo Inmobiliario',
      fecha_nacimiento: '1995-02-17',
      ano_inicio_servicio: 2020,
      afiliado_estatus: '2_EXPEDIENTE',
      inscripcion_estatus: 'Preinscrito',
      id_empresa: null as number | null,
      docs: [
        { nombre: 'Cedula_Identidad_V22456789.pdf', url: 'https://placehold.co/doc_g1.pdf', tipo: 'application/pdf' },
        { nombre: 'Titulo_TSU_Mercadeo.pdf', url: 'https://placehold.co/doc_g2.pdf', tipo: 'application/pdf' },
        { nombre: 'Constancia_Experiencia_Inmobiliaria.pdf', url: 'https://placehold.co/doc_g3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Agente Corporativo',
      nombres: 'Alejandro David',
      apellidos: 'Lugo Briceño',
      cedula_tipo: 'V',
      cedula: '17890123',
      email: 'alejandro.lugo.asesor@gmail.com',
      telefono: '0414-9988774',
      nivel_academico: 'Nivel Profesional',
      profesion: 'Economista / Asesor Financiero e Inmobiliario',
      fecha_nacimiento: '1986-07-28',
      ano_inicio_servicio: 2018,
      afiliado_estatus: '2_EXPEDIENTE',
      inscripcion_estatus: 'Preinscrito',
      id_empresa: idEmpresaGuayana,
      docs: [
        { nombre: 'Cedula_Identidad_V17890123.pdf', url: 'https://placehold.co/doc_al1.pdf', tipo: 'application/pdf' },
        { nombre: 'Carta_Postulacion_Guayana.pdf', url: 'https://placehold.co/doc_al2.pdf', tipo: 'application/pdf' },
        { nombre: 'Titulo_Economista_UCAB.pdf', url: 'https://placehold.co/doc_al3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Agente Corporativo',
      nombres: 'Patricia Elena',
      apellidos: 'Márquez Valera',
      cedula_tipo: 'V',
      cedula: '20456123',
      email: 'patricia.marquez.asesora@gmail.com',
      telefono: '0416-5544335',
      nivel_academico: 'TSU',
      profesion: 'TSU en Administración Comercial',
      fecha_nacimiento: '1992-10-14',
      ano_inicio_servicio: 2019,
      afiliado_estatus: '3_ENTREVISTA',
      inscripcion_estatus: 'Entrevista',
      id_empresa: idEmpresaCanaima,
      docs: [
        { nombre: 'Cedula_Identidad_V20456123.pdf', url: 'https://placehold.co/doc_pm1.pdf', tipo: 'application/pdf' },
        { nombre: 'Carta_Adscripcion_Canaima.pdf', url: 'https://placehold.co/doc_pm2.pdf', tipo: 'application/pdf' },
        { nombre: 'Historial_Operaciones_Inmobiliarias.pdf', url: 'https://placehold.co/doc_pm3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Agente Corporativo',
      nombres: 'Fernando Andrés',
      apellidos: 'Cedeño Rondón',
      cedula_tipo: 'V',
      cedula: '15678904',
      email: 'fernando.cedeno.pzo@gmail.com',
      telefono: '0412-1122336',
      nivel_academico: 'Nivel Profesional',
      profesion: 'Contador Público / Auditor Inmobiliario',
      fecha_nacimiento: '1982-08-30',
      ano_inicio_servicio: 2015,
      afiliado_estatus: '2_EXPEDIENTE',
      inscripcion_estatus: 'Preinscrito',
      id_empresa: idEmpresaGuayana,
      docs: [
        { nombre: 'Cedula_Identidad_V15678904.pdf', url: 'https://placehold.co/doc_fc1.pdf', tipo: 'application/pdf' },
        { nombre: 'Titulo_Contador_Publico.pdf', url: 'https://placehold.co/doc_fc2.pdf', tipo: 'application/pdf' },
        { nombre: 'Certificacion_Tributaria_Inmobiliaria.pdf', url: 'https://placehold.co/doc_fc3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Natural',
      nombres: 'Claudia Victoria',
      apellidos: 'Bermúdez Ortiz',
      cedula_tipo: 'V',
      cedula: '23890145',
      email: 'claudia.bermudez.inmo@gmail.com',
      telefono: '0424-3322117',
      nivel_academico: 'Nivel Profesional',
      profesion: 'Abogada Especialista en Derecho Registral e Inmobiliario',
      fecha_nacimiento: '1996-01-25',
      ano_inicio_servicio: 2019,
      afiliado_estatus: '2_EXPEDIENTE',
      inscripcion_estatus: 'Preinscrito',
      id_empresa: null as number | null,
      docs: [
        { nombre: 'Cedula_Identidad_V23890145.pdf', url: 'https://placehold.co/doc_cb1.pdf', tipo: 'application/pdf' },
        { nombre: 'Titulo_Abogado_UCAB.pdf', url: 'https://placehold.co/doc_cb2.pdf', tipo: 'application/pdf' },
        { nombre: 'Diplomado_Derecho_Inmobiliario.pdf', url: 'https://placehold.co/doc_cb3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Corporativo',
      nombres: 'Manuel Antonio',
      apellidos: 'Navarro Guerra',
      cedula_tipo: 'V',
      cedula: '13456789',
      email: 'manuel.navarro@inmobiliariaguayana.com',
      telefono: '0414-8877668',
      nivel_academico: 'Postgrado',
      profesion: 'Ingeniero Industrial / Tasador Certificado',
      fecha_nacimiento: '1978-05-19',
      ano_inicio_servicio: 2013,
      afiliado_estatus: '2_EXPEDIENTE',
      inscripcion_estatus: 'Preinscrito',
      id_empresa: idEmpresaGuayana,
      docs: [
        { nombre: 'Registro_Mercantil_Guayana.pdf', url: 'https://placehold.co/doc_mn1.pdf', tipo: 'application/pdf' },
        { nombre: 'RIF_Juridico_J512039481.pdf', url: 'https://placehold.co/doc_mn2.pdf', tipo: 'application/pdf' },
        { nombre: 'Cedula_Representante_Navarro.pdf', url: 'https://placehold.co/doc_mn3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Corporativo',
      nombres: 'Adriana Carolina',
      apellidos: 'Díaz Salazar',
      cedula_tipo: 'V',
      cedula: '16789012',
      email: 'adriana.diaz@inmueblescanaima.com',
      telefono: '0424-9988119',
      nivel_academico: 'Postgrado',
      profesion: 'Licenciada en Gerencia / Magíster en Finanzas',
      fecha_nacimiento: '1984-12-03',
      ano_inicio_servicio: 2014,
      afiliado_estatus: '3_ENTREVISTA',
      inscripcion_estatus: 'Entrevista',
      id_empresa: idEmpresaCanaima,
      docs: [
        { nombre: 'Registro_Mercantil_Canaima.pdf', url: 'https://placehold.co/doc_ad1.pdf', tipo: 'application/pdf' },
        { nombre: 'RIF_Juridico_J523940182.pdf', url: 'https://placehold.co/doc_ad2.pdf', tipo: 'application/pdf' },
        { nombre: 'Cedula_Representante_Diaz.pdf', url: 'https://placehold.co/doc_ad3.pdf', tipo: 'application/pdf' }
      ]
    },
    {
      tipo_afiliado: 'Natural',
      nombres: 'Gustavo Enrique',
      apellidos: 'Palma Rivas',
      cedula_tipo: 'V',
      cedula: '18901234',
      email: 'gustavo.palma.inmuebles@gmail.com',
      telefono: '0414-7766550',
      nivel_academico: 'Nivel Profesional',
      profesion: 'Ingeniero de Sistemas / Consultor PropTech',
      fecha_nacimiento: '1989-09-08',
      ano_inicio_servicio: 2018,
      afiliado_estatus: '2_EXPEDIENTE',
      inscripcion_estatus: 'Preinscrito',
      id_empresa: null as number | null,
      docs: [
        { nombre: 'Cedula_Identidad_V18901234.pdf', url: 'https://placehold.co/doc_gp1.pdf', tipo: 'application/pdf' },
        { nombre: 'Titulo_Ing_Sistemas.pdf', url: 'https://placehold.co/doc_gp2.pdf', tipo: 'application/pdf' }
      ]
    }
  ];

  for (const cand of candidates) {
    console.log(`Processing ${cand.nombres} ${cand.apellidos} (${cand.tipo_afiliado})...`);

    // 1. Upsert Persona
    const resP = await db.execute({
      sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, profesion, fecha_nacimiento, creado_en, actualizado_en)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              nombres = excluded.nombres,
              apellidos = excluded.apellidos,
              cedula_tipo = excluded.cedula_tipo,
              cedula = excluded.cedula,
              telefono = excluded.telefono,
              nivel_academico = excluded.nivel_academico,
              profesion = excluded.profesion,
              fecha_nacimiento = excluded.fecha_nacimiento,
              actualizado_en = excluded.actualizado_en
            RETURNING id`,
      args: [
        cand.nombres,
        cand.apellidos,
        cand.cedula_tipo,
        cand.cedula,
        cand.email,
        cand.telefono,
        cand.nivel_academico,
        cand.profesion,
        cand.fecha_nacimiento,
        now,
        now
      ]
    });
    const idPersona = Number(resP.rows[0].id);

    // 2. Upsert Afiliado (optar_acreditacion = 1, sin codigo porque está en proceso)
    const resA = await db.execute({
      sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, ano_inicio_servicio, optar_acreditacion, cibir_acreditado, fecha_registro, actualizado_en)
            VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
            ON CONFLICT(id_persona) DO UPDATE SET
              id_empresa = excluded.id_empresa,
              tipo_afiliado = excluded.tipo_afiliado,
              estatus = excluded.estatus,
              ano_inicio_servicio = excluded.ano_inicio_servicio,
              optar_acreditacion = 1,
              actualizado_en = excluded.actualizado_en
            RETURNING id_afiliado`,
      args: [
        idPersona,
        cand.id_empresa,
        cand.tipo_afiliado,
        cand.afiliado_estatus,
        cand.ano_inicio_servicio,
        now,
        now
      ]
    });
    const idAfiliado = Number(resA.rows[0].id_afiliado);

    if (cand.tipo_afiliado === 'Corporativo' && cand.id_empresa) {
      await db.execute({
        sql: `UPDATE empresas SET id_representante_legal = ? WHERE id_empresa = ?`,
        args: [idAfiliado, cand.id_empresa]
      });
    }

    // 3. Upsert Estudiante
    const resE = await db.execute({
      sql: `INSERT INTO estudiantes (id_persona, tipo, es_corredor_inmobiliario, programa_interes, creado_en, actualizado_en)
            VALUES (?, ?, 1, 'AFILIACION', ?, ?)
            ON CONFLICT(id_persona) DO UPDATE SET
              tipo = excluded.tipo,
              programa_interes = excluded.programa_interes,
              actualizado_en = excluded.actualizado_en
            RETURNING id_estudiante`,
      args: [
        idPersona,
        cand.tipo_afiliado === 'Corporativo' ? 'Corporativo' : 'Regular',
        now,
        now
      ]
    });
    const idEstudiante = Number(resE.rows[0].id_estudiante);

    // 4. Upsert Inscripcion Curso (Programa AFILIACION)
    const resIncExist = await db.execute({
      sql: `SELECT id_inscripcion FROM inscripciones_cursos WHERE id_estudiante = ? AND programa_codigo = 'AFILIACION'`,
      args: [idEstudiante]
    });

    let idInscripcion: number;
    if (resIncExist.rows.length === 0) {
      const resInc = await db.execute({
        sql: `INSERT INTO inscripciones_cursos (id_estudiante, programa_codigo, tipo_inscripcion, estatus, estatus_academico, id_empresa, fecha_inscripcion, creado_en, actualizado_en)
              VALUES (?, 'AFILIACION', 'programa', ?, 'Inscrito', ?, ?, ?, ?)
              RETURNING id_inscripcion`,
        args: [
          idEstudiante,
          cand.inscripcion_estatus,
          cand.id_empresa,
          now,
          now,
          now
        ]
      });
      idInscripcion = Number(resInc.rows[0].id_inscripcion);
    } else {
      idInscripcion = Number(resIncExist.rows[0].id_inscripcion);
      await db.execute({
        sql: `UPDATE inscripciones_cursos SET estatus = ?, id_empresa = ?, actualizado_en = ? WHERE id_inscripcion = ?`,
        args: [cand.inscripcion_estatus, cand.id_empresa, now, idInscripcion]
      });
    }

    // 5. Insert Documentos
    for (const doc of cand.docs) {
      const existDoc = await db.execute({
        sql: `SELECT id_documento FROM documentos WHERE entidad_tipo = 'estudiante' AND entidad_id = ? AND nombre_archivo = ?`,
        args: [idEstudiante, doc.nombre]
      });
      if (existDoc.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO documentos (entidad_tipo, entidad_id, nombre_archivo, url, tipo_archivo, fecha_subida)
                VALUES ('estudiante', ?, ?, ?, ?, ?)`,
          args: [idEstudiante, doc.nombre, doc.url, doc.tipo, now]
        });
      }
    }

    console.log(` -> Done: ${cand.nombres} ${cand.apellidos} (Persona: ${idPersona}, Afiliado: ${idAfiliado})`);
  }

  console.log('All 10 optantes a acreditacion inserted successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

