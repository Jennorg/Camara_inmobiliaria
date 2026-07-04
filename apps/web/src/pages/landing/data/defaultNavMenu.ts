/** Estructura por defecto del menú (debe coincidir con el seed de `nav_menu`). */
export const DEFAULT_NAV_MENU = [
  {
    title: 'Nosotros',
    items: [
      { label: 'Misión y Visión', path: '/mision-vision' },
      { label: 'Junta Directiva', path: '/junta-directiva' },
      { label: 'Historia', path: '/historia' },
      { label: 'Dirección', path: '/direccion' },
    ],
    Tpath: '',
  },
  { title: 'CIV', items: null, Tpath: '/codigo-etica' },
  { title: 'Eventos', items: null, Tpath: '/eventos' },
  {
    title: 'Afiliados',
    items: [
      { label: 'Miembros', path: '/miembros' },
      { label: 'Beneficios', path: '/beneficios' },
      { label: 'Afíliate', path: '/afiliate' },
    ],
    Tpath: '',
  },
  {
    title: 'Formación',
    items: [
      { label: 'PREANI', path: '/preani' },
      { label: 'CIBIR', path: '/cibir' },
      { label: 'PEGI', path: '/pegi' },
      { label: 'PADI', path: '/padi' },
    ],
    Tpath: '',
  },
  {
    title: 'Convenios',
    items: [
      { label: 'Institucionales', path: '/convenios' },
      { label: 'Comerciales', path: '/convenios-comerciales' },
      { label: 'Internacionales', path: '/convenios-internacionales' },
    ],
    Tpath: '',
  },
  { title: 'Normativas', items: null, Tpath: '/normativas' },
  {
    title: 'Prensa',
    items: [
      { label: 'Noticias', path: '#noticias' },
      { label: 'Galería', path: '/galeria' },
      { label: 'Comunicados', path: '/comunicados' },
    ],
    Tpath: '',
  },
  { title: 'Contacto', items: null, Tpath: '/contacto' },
] as const

export function parseNavMenuJson(raw: string | undefined): typeof DEFAULT_NAV_MENU | null {
  if (!raw?.trim()) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v) || v.length === 0) return null
    return v as unknown as typeof DEFAULT_NAV_MENU
  } catch {
    return null
  }
}
