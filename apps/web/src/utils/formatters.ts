/**
 * Formatea un nombre para mostrarlo en tarjetas o dashboards.
 * Reglas:
 * 1. Primera letra en mayúscula, el resto en minúscula (Title Case).
 * 2. Muestra solo el PRIMER NOMBRE y el PRIMER APELLIDO.
 * 
 * Puede recibir el nombre completo como un solo string o 
 * los nombres y apellidos por separado para mayor precisión.
 */
const COMPOUND_PREFIXES_2 = new Set(['de la', 'de los', 'de las']);
const COMPOUND_PREFIXES_1 = new Set(['de', 'del', 'da', 'das', 'do', 'dos', 'san', 'santa', 'van', 'von', 'di', 'la', 'le']);

/**
 * Capitaliza una palabra (primera letra en mayúscula, resto en minúscula).
 */
export const capitalizeWord = (str: string): string => {
  if (!str) return '';
  const s = str.trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

/**
 * Extrae el primer apellido de una cadena de apellidos, respetando partículas compuestas
 * como "De La Rosa", "De Luttinger", "Del Moral", "San Martín", etc.
 */
export const extractPrimerApellido = (apellidosStr: string): string => {
  const clean = (apellidosStr || '').trim();
  if (!clean) return '';
  const words = clean.split(/\s+/);
  if (words.length <= 1) return capitalizeWord(words[0]);

  const lower0 = words[0].toLowerCase();
  const lower1 = words[1]?.toLowerCase();

  // Partículas de 2 palabras: "de la", "de los", "de las"
  if (words.length >= 3 && COMPOUND_PREFIXES_2.has(`${lower0} ${lower1}`)) {
    return `${capitalizeWord(words[0])} ${capitalizeWord(words[1])} ${capitalizeWord(words[2])}`;
  }

  // Partículas de 1 palabra: "de", "del", "san", etc.
  if (words.length >= 2 && COMPOUND_PREFIXES_1.has(lower0)) {
    return `${capitalizeWord(words[0])} ${capitalizeWord(words[1])}`;
  }

  return capitalizeWord(words[0]);
};

/**
 * Extrae el primer nombre de una cadena de nombres.
 */
export const extractPrimerNombre = (nombresStr: string): string => {
  const clean = (nombresStr || '').trim();
  if (!clean) return '';
  const words = clean.split(/\s+/);
  return capitalizeWord(words[0]);
};

export const formatNombreCard = (
  arg1: string | null | undefined, 
  arg2?: string | null | undefined
): string => {
  const clean1 = (arg1 || '').trim();
  const clean2 = (arg2 || '').trim();

  // CASO A: Se pasan columna nombres y columna apellidos por separado
  // Toma el primer nombre de la columna nombres y el primer apellido de la columna apellidos
  if (clean1 && clean2) {
    const primerNombre = extractPrimerNombre(clean1);
    const primerApellido = extractPrimerApellido(clean2);
    return `${primerNombre} ${primerApellido}`.trim();
  }

  // CASO B: Solo se dispone de un único string (ej. nombre_completo)
  const text = clean1 || clean2;
  if (!text) return '';

  const words = text.split(/\s+/);
  if (words.length === 1) return capitalizeWord(words[0]);
  if (words.length === 2) return `${capitalizeWord(words[0])} ${capitalizeWord(words[1])}`;

  const firstName = extractPrimerNombre(words[0]);
  const lower1 = words[1]?.toLowerCase();
  const lower2 = words[2]?.toLowerCase();
  const lower3 = words[3]?.toLowerCase();

  // 1. Partículas compuestas en Nombres de pila ("del mar", "de los angeles", "del carmen", "de jesus")
  if (lower1 === 'de' && lower2 === 'los' && lower3 === 'angeles' && words.length >= 5) {
    return `${firstName} ${extractPrimerApellido(words.slice(4).join(' '))}`.trim();
  }
  if (lower1 === 'del' && (lower2 === 'mar' || lower2 === 'carmen' || lower2 === 'valle' || lower2 === 'rosario') && words.length >= 4) {
    return `${firstName} ${extractPrimerApellido(words.slice(3).join(' '))}`.trim();
  }
  if (lower1 === 'de' && (lower2 === 'jesus' || lower2 === 'dios') && words.length >= 4) {
    return `${firstName} ${extractPrimerApellido(words.slice(3).join(' '))}`.trim();
  }

  // 2. Partículas compuestas de 2 palabras en Apellidos ("de la rosa", "de los santos")
  if (COMPOUND_PREFIXES_2.has(`${lower1} ${lower2}`) && words.length >= 4) {
    return `${firstName} ${capitalizeWord(words[1])} ${capitalizeWord(words[2])} ${capitalizeWord(words[3])}`.trim();
  }

  // 3. Partículas compuestas de 1 palabra en Apellidos ("de luttinger", "del moral", "san martin")
  if (COMPOUND_PREFIXES_1.has(lower1) && words.length >= 3) {
    return `${firstName} ${capitalizeWord(words[1])} ${capitalizeWord(words[2])}`.trim();
  }

  // 4. Nombre estándar de 4 o más palabras (ej: Juan Carlos Pérez Gómez -> Juan Pérez)
  if (words.length >= 4) {
    return `${firstName} ${extractPrimerApellido(words.slice(2).join(' '))}`.trim();
  }

  // 5. Nombre de 3 palabras (ej: José Carlos Piñango -> José Piñango)
  return `${firstName} ${extractPrimerApellido(words[words.length - 1])}`.trim();
};

/**
 * Nombre que lleva el certificado de afiliación.
 * - Corporativo: el titular es la empresa, se conserva la razón social completa.
 * - Resto: solo primer nombre y primer apellido (se usan las columnas separadas,
 *   porque con un único string no se puede distinguir "dos nombres + un apellido"
 *   de "un nombre + dos apellidos").
 */
export const nombreCertificadoAfiliacion = (d: {
  tipo_afiliado?: string | null;
  nombre_completo?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
}): string => {
  if (d.tipo_afiliado === 'Corporativo') return (d.nombre_completo || '').trim();
  return formatNombreCard(d.nombres, d.apellidos) || formatNombreCard(d.nombre_completo) || '';
};

/**
 * Obtiene las iniciales del primer nombre y primer apellido.
 */
export const getInitials = (
  arg1: string | null | undefined,
  arg2?: string | null | undefined
): string => {
  const formatted = formatNombreCard(arg1, arg2);
  if (!formatted) return 'CI';
  
  const parts = formatted.split(/\s+/);
  const first = parts[0]?.charAt(0).toUpperCase() || '';
  const last = parts[1]?.charAt(0).toUpperCase() || '';
  
  return (first + last) || 'CI';
};

/**
 * Formatea el RIF evitando la duplicación del prefijo (ej: "J-J-12345678-9")
 */
export const formatRif = (tipo?: string | null, numero?: string | null): string => {
  if (!numero) return '';
  if (!tipo) return numero;

  const numUpper = numero.toUpperCase();
  const tipoUpper = tipo.toUpperCase();

  if (numUpper.startsWith(`${tipoUpper}-`)) {
    return numero;
  }
  
  if (numUpper.startsWith(tipoUpper)) {
    return `${tipoUpper}-${numero.slice(tipo.length)}`;
  }

  return `${tipoUpper}-${numero}`;
};

/**
 * Formatea un número de teléfono para redireccionar a WhatsApp (wa.me)
 * Asegura que tenga el código de país (58 para Venezuela por defecto)
 * y elimina caracteres no numéricos y el cero inicial.
 */
export const formatWhatsAppUrl = (phone: string | null | undefined, text?: string): string => {
  if (!phone) return '#';
  
  // Limpiar caracteres no numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) return '#';
  
  // Si empieza con 0, ej: 04141234567 -> quitar el 0 y poner 58
  if (cleaned.startsWith('0')) {
    cleaned = '58' + cleaned.slice(1);
  } else if (!cleaned.startsWith('58')) {
    // Si no empieza con 58, y tiene 10 dígitos (ej: 4141234567), anteponer 58
    if (cleaned.length === 10) {
      cleaned = '58' + cleaned;
    }
  }
  
  const baseUrl = `https://wa.me/${cleaned}`;
  if (text) {
    return `${baseUrl}?text=${encodeURIComponent(text)}`;
  }
  return baseUrl;
};

/**
 * Formatea una cédula de identidad con prefijo y puntos de miles.
 * Ej: "12345678" -> "V-12.345.678", "V12345678" -> "V-12.345.678"
 */
export const formatCedula = (cedula?: string | null): string => {
  if (!cedula) return '—'
  const trimmed = String(cedula).trim()
  if (!trimmed || trimmed === '—' || trimmed === 'null' || trimmed === 'undefined') return '—'

  const clean = trimmed.replace(/[\s.-]/g, '')
  if (!clean) return '—'

  const hasPrefix = /^[a-zA-Z]/.test(clean)
  const prefix = hasPrefix ? clean[0].toUpperCase() : 'V'
  const numbers = hasPrefix ? clean.substring(1) : clean
  if (!numbers) return '—'

  const formattedNumbers = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${prefix}-${formattedNumbers}`
};

/**
 * Normaliza y formatea enlaces a redes sociales y sitios web.
 * Si no inicia como link (http://, https://, www.), se interpreta como usuario.
 * Si el usuario inicia con '@', se retira para insertarlo en la URL correspondiente.
 */
export const formatSocialUrl = (
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'website',
  value?: string | null
): string => {
  if (!value) return '';
  let trimmed = String(value).trim();
  if (!trimmed) return '';

  // Si ya es un enlace completo con protocolo
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Si inicia con www.
  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Si contiene el dominio de la plataforma pero sin http/https
  if (/^(instagram\.com|facebook\.com|fb\.com|linkedin\.com|twitter\.com|x\.com|tiktok\.com)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Si es para website y parece un dominio (o cualquier texto de website)
  if (platform === 'website') {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }

  // Si no inicia como link, se interpreta como usuario
  // En caso de que dicho user inicie con @, se quita para insertarlo en la URL que se forma
  const cleanUsername = trimmed.replace(/^@+/, '').trim();
  if (!cleanUsername) return '';

  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${cleanUsername}`;
    case 'facebook':
      return `https://www.facebook.com/${cleanUsername}`;
    case 'linkedin':
      if (cleanUsername.startsWith('in/') || cleanUsername.startsWith('company/')) {
        return `https://www.linkedin.com/${cleanUsername}`;
      }
      return `https://www.linkedin.com/in/${cleanUsername}`;
    case 'twitter':
      return `https://x.com/${cleanUsername}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${cleanUsername}`;
    default:
      return `https://${cleanUsername}`;
  }
};

/**
 * Sanitiza una fecha recibida del backend o estado para asegurar formato YYYY-MM-DD
 * compatible con inputs de tipo date de HTML5 (evita que se rompan con timestamps ISO con hora).
 */
export const sanitizeDateForInput = (dateInput?: string | Date | null): string => {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (!str || str === 'null' || str === 'undefined') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
};

/**
 * Formatea una fecha al estándar latino DD/MM/AAAA (ej. 27/03/1971 o 01/10/2026).
 * Si shortYear es true, formatea en DD/MM/AA (ej. 27/03/71 o 01/10/26).
 * Previene desfases de zona horaria al parsear fechas 'YYYY-MM-DD'.
 */
export const formatDateLatina = (
  dateInput?: string | Date | number | null,
  options?: { shortYear?: boolean; fallback?: string }
): string => {
  const fallback = options?.fallback ?? '—';
  if (!dateInput) return fallback;
  const str = String(dateInput).trim();
  if (!str || str === 'null' || str === 'undefined' || str === '—') return fallback;

  // Caso YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const yearStr = options?.shortYear ? y.slice(-2) : y;
    return `${d}/${m}/${yearStr}`;
  }

  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) return fallback;

  const d = String(parsed.getDate()).padStart(2, '0');
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const y = String(parsed.getFullYear());
  const yearStr = options?.shortYear ? y.slice(-2) : y;
  return `${d}/${m}/${yearStr}`;
};

/**
 * Formatea fecha en formato corto latino DD/MM/AA (ej. 15/09/26)
 */
export const formatDateShortLatina = (dateInput?: string | Date | number | null): string => {
  return formatDateLatina(dateInput, { shortYear: true });
};

/**
 * Convierte un número correlativo autonumérico a texto ordinal en femenino
 * (ej. 1 -> "Primera Edición", 2 -> "Segunda Edición", 3 -> "Tercera Edición").
 */
export const numeroAOrdinalEdicion = (n: number): string => {
  const unidades = [
    '', 'Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta',
    'Sexta', 'Séptima', 'Octava', 'Novena'
  ];
  const decenas = [
    '', 'Décima', 'Vigésima', 'Trigésima', 'Cuadragésima',
    'Quincuagésima', 'Sexagésima', 'Septuagésima', 'Octogésima', 'Nonagésima'
  ];
  const centenas = [
    '', 'Centésima', 'Ducentésima', 'Trecentésima', 'Cuadringentésima',
    'Quingentésima', 'Sexcentésima', 'Septingentésima', 'Octingentésima', 'Noningentésima'
  ];

  if (!n || n <= 0) return 'Primera Edición';
  if (n < 10) return `${unidades[n]} Edición`;
  if (n === 10) return 'Décima Edición';
  if (n < 20) return `Décima ${unidades[n % 10]} Edición`;
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return `${u === 0 ? decenas[d] : `${decenas[d]} ${unidades[u]}`} Edición`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    if (resto === 0) return `${centenas[c]} Edición`;
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    const parts = [centenas[c]];
    if (d > 0) parts.push(d === 1 && u > 0 ? 'Décima' : decenas[d]);
    if (u > 0) parts.push(unidades[u]);
    return `${parts.join(' ')} Edición`;
  }
  return `${n}ª Edición`;
};


/** Texto del precio de un curso: "Gratis", "$40" o "Afiliados $30 · Público $50" (NULL o 0 = gratis). */
export const formatPrecioCurso = (c: { precio_afiliado_usd?: number | null; precio_publico_usd?: number | null }): string => {
  const usd = (n: number) => (n > 0 ? `$${n.toFixed(n % 1 ? 2 : 0)}` : 'Gratis');
  const afiliado = Number(c.precio_afiliado_usd) || 0;
  const publico = Number(c.precio_publico_usd) || 0;
  if (afiliado === publico) return usd(publico);
  return `Afiliados ${usd(afiliado)} · Público ${usd(publico)}`;
};
