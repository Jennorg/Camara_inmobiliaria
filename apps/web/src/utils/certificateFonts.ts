import greatVibesWoff2 from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url';
import alexBrushWoff2 from '@fontsource/alex-brush/files/alex-brush-latin-400-normal.woff2?url';

import playfair400Italic from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';
import playfair600Italic from '@fontsource/playfair-display/files/playfair-display-latin-600-italic.woff2?url';
import playfair700Normal from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import playfair700Italic from '@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2?url';
import playfair800Italic from '@fontsource/playfair-display/files/playfair-display-latin-800-italic.woff2?url';
import playfair900Italic from '@fontsource/playfair-display/files/playfair-display-latin-900-italic.woff2?url';

import montserrat400Normal from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url';
import montserrat500Normal from '@fontsource/montserrat/files/montserrat-latin-500-normal.woff2?url';
import montserrat600Normal from '@fontsource/montserrat/files/montserrat-latin-600-normal.woff2?url';
import montserrat700Normal from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import montserrat800Normal from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2?url';
import montserrat900Normal from '@fontsource/montserrat/files/montserrat-latin-900-normal.woff2?url';

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
 * for Great Vibes, Alex Brush, Playfair Display (all styles/weights), and Montserrat (all weights).
 */
export async function getCertificateFontEmbedCSS(): Promise<string> {
  if (cachedFontEmbedCSS) {
    return cachedFontEmbedCSS;
  }

  try {
    const [
      greatVibesB64,
      alexBrushB64,
      playfair400ItB64,
      playfair600ItB64,
      playfair700NormB64,
      playfair700ItB64,
      playfair800ItB64,
      playfair900ItB64,
      montserrat400B64,
      montserrat500B64,
      montserrat600B64,
      montserrat700B64,
      montserrat800B64,
      montserrat900B64,
    ] = await Promise.all([
      urlToBase64DataUrl(greatVibesWoff2, 'font/woff2'),
      urlToBase64DataUrl(alexBrushWoff2, 'font/woff2'),
      urlToBase64DataUrl(playfair400Italic, 'font/woff2'),
      urlToBase64DataUrl(playfair600Italic, 'font/woff2'),
      urlToBase64DataUrl(playfair700Normal, 'font/woff2'),
      urlToBase64DataUrl(playfair700Italic, 'font/woff2'),
      urlToBase64DataUrl(playfair800Italic, 'font/woff2'),
      urlToBase64DataUrl(playfair900Italic, 'font/woff2'),
      urlToBase64DataUrl(montserrat400Normal, 'font/woff2'),
      urlToBase64DataUrl(montserrat500Normal, 'font/woff2'),
      urlToBase64DataUrl(montserrat600Normal, 'font/woff2'),
      urlToBase64DataUrl(montserrat700Normal, 'font/woff2'),
      urlToBase64DataUrl(montserrat800Normal, 'font/woff2'),
      urlToBase64DataUrl(montserrat900Normal, 'font/woff2'),
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

    // Playfair Display definitions
    if (playfair400ItB64) {
      css += `@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 400;
  src: url('${playfair400ItB64}') format('woff2');
}\n`;
    }
    if (playfair600ItB64) {
      css += `@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 600;
  src: url('${playfair600ItB64}') format('woff2');
}\n`;
    }
    if (playfair700NormB64) {
      css += `@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  src: url('${playfair700NormB64}') format('woff2');
}\n`;
    }
    if (playfair700ItB64) {
      css += `@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 700;
  src: url('${playfair700ItB64}') format('woff2');
}\n`;
    }
    if (playfair800ItB64) {
      css += `@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 800;
  src: url('${playfair800ItB64}') format('woff2');
}\n`;
    }
    if (playfair900ItB64) {
      css += `@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 900;
  src: url('${playfair900ItB64}') format('woff2');
}\n`;
    }

    // Montserrat definitions
    const montserratWeights = [
      { w: 400, b64: montserrat400B64 },
      { w: 500, b64: montserrat500B64 },
      { w: 600, b64: montserrat600B64 },
      { w: 700, b64: montserrat700B64 },
      { w: 800, b64: montserrat800B64 },
      { w: 900, b64: montserrat900B64 },
    ];

    for (const { w, b64 } of montserratWeights) {
      if (b64) {
        css += `@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: ${w};
  src: url('${b64}') format('woff2');
}\n`;
      }
    }

    cachedFontEmbedCSS = css;
    return css;
  } catch (err) {
    console.error('Error loading certificate font embed CSS:', err);
    return '';
  }
}
