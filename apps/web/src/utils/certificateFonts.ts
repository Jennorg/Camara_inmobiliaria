import greatVibesWoff2 from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url';
import alexBrushWoff2 from '@fontsource/alex-brush/files/alex-brush-latin-400-normal.woff2?url';
import playfairWoff2 from '@fontsource/playfair-display/files/playfair-display-latin-600-italic.woff2?url';
import montserratWoff2 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';

let cachedFontEmbedCSS = '';

async function urlToBase64DataUrl(url: string, mimeType: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/**
 * Returns a standalone @font-face CSS block with embedded base64 fonts
 * for Great Vibes, Alex Brush, Playfair Display, and Montserrat.
 */
export async function getCertificateFontEmbedCSS(): Promise<string> {
  if (cachedFontEmbedCSS) {
    return cachedFontEmbedCSS;
  }

  try {
    const [greatVibesB64, alexBrushB64, playfairB64, montserratB64] = await Promise.all([
      urlToBase64DataUrl(greatVibesWoff2, 'font/woff2'),
      urlToBase64DataUrl(alexBrushWoff2, 'font/woff2'),
      urlToBase64DataUrl(playfairWoff2, 'font/woff2'),
      urlToBase64DataUrl(montserratWoff2, 'font/woff2'),
    ]);

    let css = '';
    if (greatVibesB64) {
      css += `@font-face {
  font-family: 'Great Vibes';
  font-style: normal;
  font-weight: 400;
  src: url('${greatVibesB64}') format('woff2');
}\n`;
    }
    if (alexBrushB64) {
      css += `@font-face {
  font-family: 'Alex Brush';
  font-style: normal;
  font-weight: 400;
  src: url('${alexBrushB64}') format('woff2');
}\n`;
    }
    if (playfairB64) {
      css += `@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 600;
  src: url('${playfairB64}') format('woff2');
}\n`;
    }
    if (montserratB64) {
      css += `@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 700;
  src: url('${montserratB64}') format('woff2');
}\n`;
    }

    cachedFontEmbedCSS = css;
    return css;
  } catch (err) {
    console.error('Error loading certificate font embed CSS:', err);
    return '';
  }
}
