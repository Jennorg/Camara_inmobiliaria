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
