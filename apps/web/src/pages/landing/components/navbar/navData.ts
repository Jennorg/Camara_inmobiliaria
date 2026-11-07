/* ─────────────────────────────────────────────────────────────────────────────
   DATOS DEL MENÚ INTEGRADOS (Autocontenidos)
   ───────────────────────────────────────────────────────────────────────────── */
export const NAV_ITEMS = [
  {
    title: 'Nosotros',
    items: [
      { label: 'Misión y Visión', path: '/mision-vision' },
      // { label: 'Propósito', path: '/proposito' },
      { label: 'Junta Directiva', path: '/junta-directiva' },
      { label: 'Historia', path: '/historia' }
    ],
    Tpath: '',
  },
  // { title: 'Eventos', items: null, Tpath: '/eventos' },
  {
    title: 'Afiliados',
    items: [
      { label: 'Afíliate', path: '/afiliate' },
      { label: 'Miembros', path: '/miembros' },
      { label: 'Beneficios', path: '/beneficios' },
    ],
    Tpath: '',
  },
  {
    title: 'Formación',
    items: [
      { label: 'CIBIR', path: '/cibir' },
      { label: 'PREANI', path: '/preani' },
      { label: 'PEGI', path: '/pegi' },
      { label: 'PADI', path: '/padi' },
    ],
    Tpath: '',
  },
  {
    title: 'Marco Legal',
    // Las secciones públicas se agregan antes en Navbar (useSeccionesMarcoLegal); el Tribunal siempre va al final.
    items: [
      { label: 'Tribunal de Ética y Denuncias', path: '/denuncias' },
    ],
    Tpath: '',
  }
  // {
  //   title: 'Prensa',
  //   items: [
  //     { label: 'Noticias', path: '#noticias' },
  //     { label: 'Galería', path: '/galeria' },
  //     { label: 'Comunicados', path: '/comunicados' },
  //   ],
  //   Tpath: '',
  // },
] as const;

/* ─────────────────────────────────────────────────────────────────────────────
   DEFINICIÓN DE TIPOS
   ───────────────────────────────────────────────────────────────────────────── */
export type NavMenuItem = typeof NAV_ITEMS[number];