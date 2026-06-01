import { BookOpen, Award, FileCheck, Users, Handshake, Globe2, Briefcase, FileText, Camera, MessagesSquare, Lightbulb, MapPin, Building2, Gavel } from 'lucide-react';

export interface PageContentBlock {
  heading: string;
  body: string;
  list?: string[];
}

export interface ChamberPageData {
  title: string;
  subtitle: string;
  icon: any; // Lucide icon reference
  blocks: PageContentBlock[];
}

export const PREANI: ChamberPageData = {
  title: 'Programa de Estudios Avanzados en Negocios Inmobiliarios (PREANI)',
  subtitle: 'Avalado por la Universidad Católica Andrés Bello (UCAB)',
  icon: BookOpen,
  blocks: [
    {
      heading: 'Referente de Excelencia Profesional',
      body: 'PREANI es el programa de formación profesional estrella de la Cámara Inmobiliaria de Venezuela. Está diseñado para elevar la calidad, ética y conocimientos técnicos de los profesionales inmobiliarios a nivel nacional, garantizando que todo corredor certificado cumpla con los más altos estándares académicos y legales.'
    },
    {
      heading: 'Módulos de Estudio',
      body: 'El currículo se divide en áreas críticas para el ejercicio impecable de la profesión:',
      list: [
        'Marco Legal Inmobiliario y Contratos',
        'Avalúos y Tasaciones Básicas',
        'Marketing Inmobiliario y Negociación',
        'Ética Profesional y Responsabilidad Social',
        'Finanzas Inmobiliarias y Ley de Arrendamientos'
      ]
    }
  ]
};

export const PEGI: ChamberPageData = {
  title: 'Programa de Especialización en Gerencia Inmobiliaria (PEGI)',
  subtitle: 'Liderazgo y Administración Avanzada de Bienes Raíces',
  icon: Award,
  blocks: [
    {
      heading: 'Formando Líderes Inmobiliarios',
      body: 'El PEGI es un curso de extensión superior enfocado en corredores que desean dar el paso a la gerencia de oficinas inmobiliarias o la estructuración de desarrollos masivos, adaptándose a las realidades económicas contemporáneas de Venezuela.'
    },
    {
      heading: 'Competencias Desarrolladas',
      body: 'Al culminar este programa, el egresado podrá gestionar integralmente corporaciones inmobiliarias a través de herramientas como:',
      list: [
        'Gerencia Estratégica Inmobiliaria',
        'Factibilidad Económica de Proyectos',
        'Manejo de Franquicias y Redes de Corretaje',
        'Estructuras Legales Avanzadas'
      ]
    }
  ]
};

export const PADI: ChamberPageData = {
  title: 'Programa Avanzado en Desarrollo Inmobiliario (PADI)',
  subtitle: 'Del Proyecto a la Construcción y Venta',
  icon: Building2,
  blocks: [
    {
      heading: 'Enfoque en Desarrolladores',
      body: 'Dirigido a promotores, arquitectos, ingenieros y corredores interesados en la concepción y ejecución de proyectos habitacionales o comerciales. Evalúa riesgos, viabilidad legal en Venezuela e impactos urbanos.'
    }
  ]
};

export const BENEFICIOS: ChamberPageData = {
  title: 'Beneficios de Afiliación',
  subtitle: '¿Por qué pertenecer a la Cámara?',
  icon: Award,
  blocks: [
    {
      heading: 'Defensa y Respaldo Institucional',
      body: 'Como miembro de la institución, contarás con el apoyo jurídico, técnico y mediático de la Cámara en todo el territorio nacional, garantizando el respeto de la profesión ante terceros.'
    },
    {
      heading: 'Ventajas Directas',
      body: 'Estar afiliado te abre las puertas a múltiples oportunidades exclusivas del sector colegiado.',
      list: [
        'Uso del Sello de Profesional Inmobiliario Certificado CIBIR/CIV.',
        'Descuentos especiales en programas de formación (PREANI, PEGI, PADI).',
        'Acceso al MLS (Multiple Listing Service) y colaboración exclusiva entre colegiados.',
        'Participación preferencial en Congresos y eventos de networking del rubro.'
      ]
    }
  ]
};

export const REQUISITOS: ChamberPageData = {
  title: 'Requisitos de Afiliación',
  subtitle: 'Conviértase en un Profesional Certificado',
  icon: FileCheck,
  blocks: [
    {
      heading: 'Proceso de Admisión',
      body: 'Para ingresar a la Cámara, el postulante debe demostrar idoneidad profesional, moral y cumplir con los recaudos exigidos por nuestros estatutos:'
    },
    {
      heading: 'Recaudos Generales',
      body: 'Debes consignar los siguientes documentos digitalizados y en físico:',
      list: [
        'Copia de Cédula de Identidad y RIF (actualizado).',
        'Fondo Negro de Título de Nivel Profesional.',
        'Constancia de aprobación del curso CIBIR/PREANI.',
        'Dos (2) cartas de recomendación moral por afiliados activos.',
        'Pago de los aranceles correspondientes de la inscripción.'
      ]
    }
  ]
};

export const CONVENIOS_INSTITUCIONALES: ChamberPageData = {
  title: 'Convenios Institucionales',
  subtitle: 'Alianzas con Organismos y Entidades Públicas/Universidades',
  icon: Handshake,
  blocks: [
    {
      heading: 'Fortalecimiento Académico y Legal',
      body: 'La Cámara mantiene estrechos lazos con prestigiosas universidades e instituciones públicas para garantizar la actualización legislativa y educativa de sus afiliados. Contamos con colaboración activa de colegios de Abogados, Ingenieros y Contadores.'
    }
  ]
};

export const CONVENIOS_COMERCIALES: ChamberPageData = {
  title: 'Convenios Comerciales',
  subtitle: 'Ahorro y Beneficios Corporativos para Afiliados',
  icon: Briefcase,
  blocks: [
    {
      heading: 'Red de Alianzas',
      body: 'Mantenemos convenios de descuento y trato preferencial para nuestros afiliados solventes en distintos rubros comerciales.',
      list: [
        'Plataformas Fintech e Instituciones Bancarias.',
        'Agencias de Seguros de Salud y Patrimoniales.',
        'Proveedores de Tecnología y CRM Inmobiliario.',
        'Aerolíneas y Hoteles a nivel nacional.'
      ]
    }
  ]
};

export const CONVENIOS_INTERNACIONALES: ChamberPageData = {
  title: 'Convenios Internacionales',
  subtitle: 'Expansión Global del Corredor Inmobiliario Venezolano',
  icon: Globe2,
  blocks: [
    {
      heading: 'Certificación CIPS / FIABCI / NAR',
      body: 'A través de nuestros nexos con la National Association of Realtors (NAR) de EE.UU. y FIABCI, permitimos que nuestros corredores obtengan designaciones internacionales, facilitando la referenciación de clientes en el extranjero y la protección de negocios transfronterizos.'
    }
  ]
};

export const NORMATIVAS: ChamberPageData = {
  title: 'Normativas y Estatutos',
  subtitle: 'Marco Legal del Ejercicio Inmobiliario',
  icon: Gavel,
  blocks: [
    {
      heading: 'Estatutos Vigentes',
      body: 'Nuestra institución se rige bajo un estricto Código de Ética que regula la competencia leal, el cobro estandarizado de honorarios y la protección al consumidor final.'
    },
    {
      heading: 'Leyes Asociadas',
      body: 'Es de obligatorio conocimiento y cumplimiento para el afiliado:',
      list: [
        'Código de Ética de la Cámara Inmobiliaria de Venezuela.',
        'Ley de Arrendamientos Inmobiliarios.',
        'Ley Contra Estafas Inmobiliarias.',
        'Normativas contra Legitimación de Capitales en el sector Inmobiliario.'
      ]
    }
  ]
};

export const GALERIA: ChamberPageData = {
  title: 'Galería de Eventos',
  subtitle: 'Nuestros Encuentros, Congresos y Asambleas',
  icon: Camera,
  blocks: [
    {
      heading: 'Archivo Fotográfico',
      body: 'Visita nuestras redes sociales para acceder al repositorio visual oficial de las últimas asambleas ordinarias, juramentaciones CIBIR y exposiciones inmobiliarias de la región.'
    }
  ]
};

export const COMUNICADOS: ChamberPageData = {
  title: 'Comunicados Oficiales',
  subtitle: 'Boletines de la Junta Directiva y Asesoría Legal',
  icon: FileText,
  blocks: [
    {
      heading: 'Pronunciamientos',
      body: 'En esta sección, la Junta Directiva emitirá los comunicados formales respecto a regulaciones gubernamentales, tasas de mercado, actualizaciones arancelarias y postura gremial ante situaciones económicas coyunturales.'
    }
  ]
};

export const EVENTOS: ChamberPageData = {
  title: 'Calendario de Eventos',
  subtitle: 'Congresos, Expo-Inmobiliarias y Talleres',
  icon: Users,
  blocks: [
    {
      heading: 'Próximos Encuentros',
      body: 'Manténgase al día con la agenda institucional. Anualmente llevamos a cabo la Cumbre Inmobiliaria, foros sobre economía venezolana y desayunos de networking entre gerentes de corretaje para maximizar alianzas en exclusividad.'
    }
  ]
};

export const CONTACTO: ChamberPageData = {
  title: 'Atención al Público',
  subtitle: 'Central Administrativa y Soporte Gremial',
  icon: MessagesSquare,
  blocks: [
    {
      heading: 'Estamos para Servirle',
      body: 'Tanto si desea denunciar una irregularidad inmobiliaria, como si busca integrarse a nuestras filas profesionales.'
    },
    {
      heading: 'Vías de Contacto',
      body: 'Horario de atención: Lunes a Viernes (8:00 AM - 4:00 PM).',
      list: [
        'Teléfono Administrativo: +58 286-000000',
        'Correo Institucional: info@camarainmobiliaria.org',
        'Dirección: Sede Central de la Cámara, Estado Bolívar, Venezuela.'
      ]
    }
  ]
};

export const contentMap: Record<string, ChamberPageData> = {
  'pegi': PEGI,
  'padi': PADI,
  'preani': PREANI,
  'beneficios': BENEFICIOS,
  'requisitos': REQUISITOS,
  'convenios-institucionales': CONVENIOS_INSTITUCIONALES,
  'convenios-comerciales': CONVENIOS_COMERCIALES,
  'convenios-internacionales': CONVENIOS_INTERNACIONALES,
  'normativas': NORMATIVAS,
  'galeria': GALERIA,
  'comunicados': COMUNICADOS,
  'eventos': EVENTOS,
  'contacto': CONTACTO
};
