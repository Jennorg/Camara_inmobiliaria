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
    items: [
      { label: 'Leyes y Decretos', path: '/marco-legal/leyes-y-decretos' },
      { label: 'Reglamentos y Estatutos', path: '/marco-legal/reglamentos-y-estatutos' },
      { label: 'Normas y Procedimientos', path: '/marco-legal/normas-y-procedimientos' },
      // { label: 'Actas de Asamblea', path: '/marco-legal/actas-de-asamblea' },
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