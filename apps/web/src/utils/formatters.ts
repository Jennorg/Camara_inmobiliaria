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

