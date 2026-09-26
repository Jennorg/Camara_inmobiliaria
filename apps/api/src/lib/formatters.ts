/**
 * Convierte un texto a Title Case (Primera letra de cada palabra en mayúscula, el resto en minúscula).
 * Ej: "JUAN CARLOS" -> "Juan Carlos", "MARÍA DE LOS ANGELES" -> "María De Los Angeles"
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
const COMPOUND_PREFIXES_2 = new Set(['de la', 'de los', 'de las']);
const COMPOUND_PREFIXES_1 = new Set(['de', 'del', 'da', 'das', 'do', 'dos', 'san', 'santa', 'van', 'von', 'di', 'la', 'le']);

export const capitalizeWord = (str: string): string => {
  if (!str) return '';
  const s = str.trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const extractPrimerApellido = (apellidosStr: string): string => {
  const clean = (apellidosStr || '').trim();
  if (!clean) return '';
  const words = clean.split(/\s+/);
  if (words.length <= 1) return capitalizeWord(words[0]);

  const lower0 = words[0].toLowerCase();
  const lower1 = words[1]?.toLowerCase();

  if (words.length >= 3 && COMPOUND_PREFIXES_2.has(`${lower0} ${lower1}`)) {
    return `${capitalizeWord(words[0])} ${capitalizeWord(words[1])} ${capitalizeWord(words[2])}`;
  }

  if (words.length >= 2 && COMPOUND_PREFIXES_1.has(lower0)) {
    return `${capitalizeWord(words[0])} ${capitalizeWord(words[1])}`;
  }

  return capitalizeWord(words[0]);
};

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

  if (clean1 && clean2) {
    const primerNombre = extractPrimerNombre(clean1);
    const primerApellido = extractPrimerApellido(clean2);
    return `${primerNombre} ${primerApellido}`.trim();
  }

  const text = clean1 || clean2;
  if (!text) return '';

  const words = text.split(/\s+/);
  if (words.length === 1) return capitalizeWord(words[0]);
  if (words.length === 2) return `${capitalizeWord(words[0])} ${capitalizeWord(words[1])}`;

  const firstName = extractPrimerNombre(words[0]);
  const lower1 = words[1]?.toLowerCase();
  const lower2 = words[2]?.toLowerCase();
  const lower3 = words[3]?.toLowerCase();

  if (lower1 === 'de' && lower2 === 'los' && lower3 === 'angeles' && words.length >= 5) {
    return `${firstName} ${extractPrimerApellido(words.slice(4).join(' '))}`.trim();
  }
  if (lower1 === 'del' && (lower2 === 'mar' || lower2 === 'carmen' || lower2 === 'valle' || lower2 === 'rosario') && words.length >= 4) {
    return `${firstName} ${extractPrimerApellido(words.slice(3).join(' '))}`.trim();
  }
  if (lower1 === 'de' && (lower2 === 'jesus' || lower2 === 'dios') && words.length >= 4) {
    return `${firstName} ${extractPrimerApellido(words.slice(3).join(' '))}`.trim();
  }

  if (COMPOUND_PREFIXES_2.has(`${lower1} ${lower2}`) && words.length >= 4) {
    return `${firstName} ${capitalizeWord(words[1])} ${capitalizeWord(words[2])} ${capitalizeWord(words[3])}`.trim();
  }

  if (COMPOUND_PREFIXES_1.has(lower1) && words.length >= 3) {
    return `${firstName} ${capitalizeWord(words[1])} ${capitalizeWord(words[2])}`.trim();
  }

  if (words.length >= 4) {
    return `${firstName} ${extractPrimerApellido(words.slice(2).join(' '))}`.trim();
  }

  return `${firstName} ${extractPrimerApellido(words[words.length - 1])}`.trim();
};
