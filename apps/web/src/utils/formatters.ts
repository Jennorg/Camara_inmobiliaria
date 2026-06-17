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

  // CASO A: Se pasan nombres y apellidos por separado (Recomendado)
  if (arg2 !== undefined) {
    const primerNombre = (arg1 || '').trim().split(/\s+/)[0];
    const primerApellido = (arg2 || '').trim().split(/\s+/)[0];
    
    if (!primerNombre && !primerApellido) return '';
    return `${capitalize(primerNombre)} ${capitalize(primerApellido)}`.trim();
  }

  // CASO B: Se pasa un solo string con el nombre completo
  if (!arg1) return '';
  const parts = arg1.trim().split(/\s+/);
  
  if (parts.length === 0) return '';
  if (parts.length === 1) return capitalize(parts[0]);

  const firstName = capitalize(parts[0]);

  /**
   * Heurística para el primer apellido en un string completo:
   * - 2 partes: [Nombre] [Apellido1] -> parts[1]
   * - 3 partes: [Nombre] [Apellido1] [Apellido2] O [Nombre1] [Nombre2] [Apellido1]
   *   Asumimos [Nombre] [Apellido1] [Apellido2] como lo más común para 3 partes. -> parts[1]
   * - 4 partes: [Nombre1] [Nombre2] [Apellido1] [Apellido2] -> parts[2]
   */
  let firstSurname = '';
  if (parts.length >= 4) {
    firstSurname = capitalize(parts[2]);
  } else {
    firstSurname = capitalize(parts[1]);
  }

  return `${firstName} ${firstSurname}`;
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

