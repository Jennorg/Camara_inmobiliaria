/**
 * Formatea un nombre para mostrarlo en tarjetas o dashboards.
 * Reglas:
 * 1. Primera letra en mayúscula, el resto en minúscula (Title Case).
 * 2. Muestra solo el PRIMER NOMBRE y el PRIMER APELLIDO.
 * 
 * Puede recibir el nombre completo como un solo string o 
 * los nombres y apellidos por separado para mayor precisión.
 */
export const formatNombreCard = (
  arg1: string | null | undefined, 
  arg2?: string | null | undefined
): string => {
  const capitalize = (str: string) => {
    if (!str) return '';
    const s = str.trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const clean1 = (arg1 || '').trim();
  const clean2 = (arg2 || '').trim();

  // CASO A: Se pasan columna nombres y columna apellidos por separado
  // Toma la primera palabra de la columna nombres y la primera palabra de la columna apellidos
  if (clean1 && clean2) {
    const primerNombre = clean1.split(/\s+/)[0];
    const primerApellido = clean2.split(/\s+/)[0];
    return `${capitalize(primerNombre)} ${capitalize(primerApellido)}`.trim();
  }

  // CASO B: Solo se dispone de un único string (ej. nombre_completo)
  const text = clean1 || clean2;
  if (!text) return '';

  const parts = text.split(/\s+/);
  if (parts.length === 1) return capitalize(parts[0]);
  if (parts.length === 2) return `${capitalize(parts[0])} ${capitalize(parts[1])}`;

  const firstName = capitalize(parts[0]);
  const firstSurname = parts.length >= 4 ? capitalize(parts[2]) : capitalize(parts[parts.length - 1]);
  return `${firstName} ${firstSurname}`.trim();
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

