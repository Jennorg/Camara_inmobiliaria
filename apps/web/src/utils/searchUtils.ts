/**
 * Utilidades de búsqueda flexible, normalización y coincidencia difusa (fuzzy search)
 * para el panel administrativo y gestión de formación.
 */

/**
 * Normaliza un texto eliminando acentos, diacríticos y homogeneizando caracteres en español.
 * Ej: "José Pérez Piñango" -> "jose perez pinango"
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina tildes/acentos
    .replace(/ñ/g, 'n') // Normaliza eñes para búsqueda permisiva
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ') // Reemplaza caracteres no alfanuméricos por espacios
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae únicamente los dígitos de una cadena (ideal para comparar cédulas y teléfonos).
 * Ej: "V-12.345.678" -> "12345678"
 */
export function cleanSearchDigits(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/\D/g, '');
}

/**
 * Calcula la distancia de Levenshtein (número mínimo de ediciones de 1 carácter)
 * entre dos cadenas.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1,     // inserción
          matrix[i - 1][j] + 1      // eliminación
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Comprueba si un token de búsqueda coincide de forma exacta, por prefijo/subcadena
 * o de forma difusa (fuzzy con distancia <= 1) con alguna de las palabras del texto.
 */
export function fuzzyMatchToken(token: string, targetWords: string[]): boolean {
  if (!token) return true;
  if (targetWords.length === 0) return false;

  for (const word of targetWords) {
    // 1. Coincidencia exacta o por subcadena
    if (word.includes(token) || token.includes(word)) {
      return true;
    }

    // 2. Coincidencia difusa (solo para tokens de 4 o más caracteres para evitar falsos positivos)
    if (token.length >= 4 && word.length >= 3) {
      const maxDistance = token.length >= 5 ? 2 : 1;
      if (Math.abs(token.length - word.length) <= maxDistance) {
        const dist = levenshteinDistance(token, word);
        if (dist <= maxDistance) {
          return true;
        }
      }
    }
  }

  return false;
}

export interface MatchesSearchOptions {
  isCedula?: boolean;
  isPhone?: boolean;
  fuzzy?: boolean;
}

/**
 * Función principal de búsqueda flexible:
 * - Soporta candidato único (string) o array de campos (ej. [nombre, apellidos, email, cedula]).
 * - Insensible a mayúsculas, minúsculas, tildes y diacríticos (ñ, ü).
 * - Búsqueda multitérrmino: cada palabra ingresada debe coincidir (en cualquier orden).
 * - Búsqueda de cédulas flexible (ignora puntos, guiones y prefijos V/E/J).
 * - Coincidencias leves (tolerancia a pequeñas erratas tipográficas).
 */
export function matchesSearch(
  candidate: string | null | undefined | (string | null | undefined)[],
  query: string | null | undefined,
  options: MatchesSearchOptions = {}
): boolean {
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim();
  const { isCedula, isPhone, fuzzy = true } = options;

  // 1. Manejo específico para búsqueda de cédula o teléfono numérico
  if (isCedula || isPhone) {
    const qDigits = cleanSearchDigits(rawQuery);
    if (qDigits.length > 0) {
      const candidates = Array.isArray(candidate) ? candidate : [candidate];
      const anyDigitMatch = candidates.some(c => {
        const cDigits = cleanSearchDigits(c);
        return cDigits.includes(qDigits);
      });
      if (anyDigitMatch) return true;
    }
  }

  // 2. Normalización de campos candidatos
  const candidatesArray = Array.isArray(candidate) ? candidate : [candidate];
  const combinedText = candidatesArray
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .join(' ');

  if (!combinedText) return false;

  const normalizedTarget = normalizeSearchText(combinedText);
  const targetWords = normalizedTarget.split(/\s+/).filter(Boolean);

  const normalizedQuery = normalizeSearchText(rawQuery);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) {
    // Si la query solo tenía caracteres especiales, intentar búsqueda por dígitos
    const qDigits = cleanSearchDigits(rawQuery);
    if (qDigits) {
      return cleanSearchDigits(combinedText).includes(qDigits);
    }
    return true;
  }

  // 3. Comprobar que CADA token de la búsqueda coincida
  for (const token of queryTokens) {
    // Si el token es puramente numérico (ej. búsqueda de cédula dentro de texto general)
    if (/^\d+$/.test(token)) {
      const targetDigits = cleanSearchDigits(combinedText);
      if (targetDigits.includes(token)) {
        continue;
      }
    }

    // Comprobar coincidencia directa de subcadena en todo el texto normalizado
    if (normalizedTarget.includes(token)) {
      continue;
    }

    // Si fuzzy está habilitado, verificar si coincide levemente con alguna palabra
    if (fuzzy && fuzzyMatchToken(token, targetWords)) {
      continue;
    }

    return false;
  }

  return true;
}
