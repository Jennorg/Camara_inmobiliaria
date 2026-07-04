/**
 * staticContent.ts
 *
 * Tier 1: Core Static Content.
 *
 * All text/labels that define the brand's voice and rarely (if ever) change.
 * These are hardcoded here instead of being fetched from the CMS to eliminate
 * unnecessary API calls on every page load.
 *
 * If a value ever does need to change, it should be edited here directly.
 */

export const STATIC = {
  // ── Sección: Nosotros ─────────────────────────────────────────────────────
  nosotros: {
    titulo: "Sobre la Cámara",
    descripcion:
      "La Cámara Inmobiliaria del Estado Bolívar (CIEBO) es una Asociación Civil sin fines de lucro, agrupa a instituciones, a personas jurídicas y naturales y que como actores del sector inmobiliario contribuyen con su acción e inversión al desarrollo del sector inmobiliario regional y nacional.",
    boton: "Contáctanos",
    cards: [
      {
        title: "Misión y Visión",
        path: "/mision-vision",
        img: "https://escalas.org/wp-content/uploads/2019/10/4-1.jpg",
      },
      {
        title: "Historia",
        path: "/historia",
        img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=75&w=500",
      },
      {
        title: "Junta Directiva",
        path: "/junta-directiva",
        img: "https://gentecompetente.com/wp-content/uploads/2023/10/las-empresas-que-se-hacen-querer.jpg",
      },
    ],
  },

  // ── Sección: Afiliados ────────────────────────────────────────────────────
  afiliados: {
    titulo: "¿Por qué afiliarse?",
    descripcion:
      "Al formar parte de la Cámara, accedes a una red nacional de contactos, asesoría legal de primera y programas de formación exclusivos.",
    contador: 220,
    labelAfiliados: "Afiliados",
    labelAños: "Años de Historia",
    respaldo: "Respaldo Gremial de Alto Nivel",
    beneficios: [
      "Certificación Profesional",
      "Respaldo Gremial Nacional",
      "Asesoría Legal Especializada",
      "Networking Estratégico",
    ],
  },

  // ── Sección: Formación ────────────────────────────────────────────────────
  formacion: {
    subtitulo: "Potencia tu carrera",
    titulo: "Formación",
    boton: "Ver detalles",
  },

  // ── Sección: Directiva ────────────────────────────────────────────────────
  directiva: {
    subtitulo: "Nuestro Equipo",
    titulo: "Junta Directiva",
    cta: "Conozca a la Junta Directiva",
    verTodos: "Ver todos los miembros",
  },

  // ── Sección: Noticias ─────────────────────────────────────────────────────
  noticias: {
    titulo: "Actualidad y Noticias",
    subtitulo: "Mantente informado sobre el mercado inmobiliario.",
    boton: "Ver todas",
    cardMeta: "Bolívar • Actualidad",
    leerMas: "Leer más...",
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    descripcion: "Cámara Inmobiliaria del Estado Bolívar. Afiliada a la CIV.",
    direccion:
      "Carrera Guri, Edif. Cámara de la Construcción, Alta Vista, Puerto Ordaz, Estado Bolívar.",
    copyright:
      "© 2026 Cámara Inmobiliaria del Estado Bolívar. Todos los derechos reservados.",
  },

  // ── Hero (Header) ─────────────────────────────────────────────────────────
  hero: {
    titulo:
      'Unidos por el <span class="text-emerald-500 italic">Progreso</span> Inmobiliario de Bolívar',
    subtitulo:
      "Representamos y fortalecemos a los profesionales del sector en el estado, impulsando la ética y el desarrollo sostenible.",
    btnPrimario: "Únete Ahora",
    btnSecundario: "Saber más",
  },
} as const;
