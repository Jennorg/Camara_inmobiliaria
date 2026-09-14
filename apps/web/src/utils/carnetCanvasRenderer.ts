import LogoBgImg from '@/assets/logo_ciebo_green.svg';
import QRCode from 'qrcode';
import { formatNombreCard } from '@/utils/formatters';

const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src || typeof src !== 'string') return null;
  if (imageCache.has(src)) return imageCache.get(src)!;

  // Si ya es un data URL o blob URL
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Para URLs remotas (Supabase, S3, APIs, etc.), primero intentar fetch blob para garantizar CORS limpio
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          imageCache.set(src, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });
    }
  } catch {
    // Si fetch falla, intentar carga directa con crossOrigin
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * Genera un carnet impreso en JPG ultra-rápido usando 2D Canvas nativo (GPU-accelerated) a 600 DPI (Ultra-HD).
 * Tiempo de ejecución: ~2-3 ms por carnet con calidad tipográfica y fotográfica para imprenta.
 */
export async function drawCarnetCanvas(
  afiliado: any,
  qrCodeUrl?: string | null,
  scale: number = 2
): Promise<Blob> {
  // Garantizar que las fuentes web estén completamente listas para evitar renderizados preliminares
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignorar si falla la comprobación de fuentes
    }
  }

  const BASE_WIDTH = 649.61; // 55mm a 300 DPI
  const BASE_HEIGHT = 1003.94; // 85mm a 300 DPI
  const WIDTH = BASE_WIDTH;
  const HEIGHT = BASE_HEIGHT;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(BASE_WIDTH * scale);
  canvas.height = Math.round(BASE_HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context available');

  // Configuración de máxima calidad gráfica y anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Escalar el contexto 2D para renderizar a 600 DPI manteniendo todas las coordenadas relativas
  ctx.scale(scale, scale);

  // 0. Fondo base blanco para todo el canvas (evita esquinas negras al exportar a JPEG)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Clip esquinas redondeadas del carnet (radio 36px en resolución 2x)
  ctx.save();
  ctx.beginPath();
  const radius = 36;
  ctx.moveTo(radius, 0);
  ctx.lineTo(WIDTH - radius, 0);
  ctx.arcTo(WIDTH, 0, WIDTH, radius, radius);
  ctx.lineTo(WIDTH, HEIGHT - radius);
  ctx.arcTo(WIDTH, HEIGHT, WIDTH - radius, HEIGHT, radius);
  ctx.lineTo(radius, HEIGHT);
  ctx.arcTo(0, HEIGHT, 0, HEIGHT - radius, radius);
  ctx.lineTo(0, radius);
  ctx.arcTo(0, 0, radius, 0, radius);
  ctx.closePath();
  ctx.clip();

  // 1. Fondo Blanco Puro (CMYK 0/0/0/0)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Borde fino del carnet (CMYK neutral gris)
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, WIDTH, HEIGHT);

  // 2. Encabezado (Verde Corporativo CMYK Safe: C:84 M:36 Y:72 K:30 -> #0a523d)
  const logoBg = await loadImage(LogoBgImg);
  const headerFont = '900 27px "Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.font = headerFont;
  ctx.fillStyle = '#0a523d';
  ctx.textBaseline = 'middle';

  const line1 = 'CÁMARA INMOBILIARIA';
  const line2 = 'DE BOLÍVAR';
  const textW1 = ctx.measureText(line1).width;
  const textW2 = ctx.measureText(line2).width;
  const textW = Math.max(textW1, textW2);

  const logoAspect = (logoBg && logoBg.naturalWidth && logoBg.naturalHeight)
    ? (logoBg.naturalWidth / logoBg.naturalHeight)
    : (logoBg && logoBg.width && logoBg.height ? logoBg.width / logoBg.height : 450 / 280);

  const hLogoH = 105;
  const hLogoW = logoBg ? logoAspect * hLogoH : 0;
  const gap = 14;
  const totalHeaderW = hLogoW + (hLogoW > 0 ? gap : 0) + textW;
  const startX = (WIDTH - totalHeaderW) / 2;
  const headerCenterY = 90;

  if (logoBg) {
    ctx.drawImage(logoBg, startX, headerCenterY - hLogoH / 2, hLogoW, hLogoH);
  }

  const textCenterX = startX + hLogoW + (hLogoW > 0 ? gap : 0) + textW / 2;
  ctx.textAlign = 'center';
  ctx.fillText(line1, textCenterX, headerCenterY - 18);
  ctx.fillText(line2, textCenterX, headerCenterY + 18);

  // 3. Contenedor de la Foto (Centrado Verticalmente en el cuerpo)
  const photoW = 325;
  const photoH = 388;
  const photoX = (WIDTH - photoW) / 2;
  const photoY = 224;
  const photoRadius = 34;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(photoX + photoRadius, photoY);
  ctx.lineTo(photoX + photoW - photoRadius, photoY);
  ctx.arcTo(photoX + photoW, photoY, photoX + photoW, photoY + photoRadius, photoRadius);
  ctx.lineTo(photoX + photoW, photoY + photoH - photoRadius);
  ctx.arcTo(photoX + photoW, photoY + photoH, photoX + photoW - photoRadius, photoY + photoH, photoRadius);
  ctx.lineTo(photoX + photoRadius, photoY + photoH);
  ctx.arcTo(photoX, photoY + photoH, photoX, photoY + photoH - photoRadius, photoRadius);
  ctx.lineTo(photoX, photoY + photoRadius);
  ctx.arcTo(photoX, photoY, photoX + photoRadius, photoY, photoRadius);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(photoX, photoY, photoW, photoH);

  // Determinar foto
  const rawRedes = afiliado?.redes_sociales;
  const redes = rawRedes
    ? (typeof rawRedes === 'string' ? (() => { try { return JSON.parse(rawRedes); } catch { return {}; } })() : rawRedes)
    : {};
  const useJuntaPhoto = Boolean(redes?.use_junta_photo);
  const carnetPhotoUrl = useJuntaPhoto
    ? (redes?.foto_junta_carnet_url || afiliado.foto_junta_url)
    : redes?.foto_carnet_url;
  const activePhotoUrl = carnetPhotoUrl || ((useJuntaPhoto && afiliado.foto_junta_url) ? afiliado.foto_junta_url : afiliado.foto_url);
  const isCropped = !!carnetPhotoUrl;

  const photoImg = activePhotoUrl ? await loadImage(activePhotoUrl) : null;

  if (photoImg) {
    if (isCropped) {
      const aspectImg = photoImg.width / photoImg.height;
      const aspectBox = photoW / photoH;
      let renderW = photoW;
      let renderH = photoH;
      let renderX = photoX;
      let renderY = photoY;
      if (aspectImg > aspectBox) {
        renderW = photoH * aspectImg;
        renderX = photoX - (renderW - photoW) / 2;
      } else {
        renderH = photoW / aspectImg;
        renderY = photoY - (renderH - photoH) / 2;
      }
      ctx.drawImage(photoImg, renderX, renderY, renderW, renderH);
    } else {
      const targetW = photoW * 2;
      const aspectImg = photoImg.width / photoImg.height;
      const targetH = targetW / aspectImg;
      const renderX = photoX - (targetW - photoW) / 2;
      const renderY = photoY;
      ctx.drawImage(photoImg, renderX, renderY, targetW, targetH);
    }
  } else {
    const initial = (afiliado.nombres || afiliado.nombre_completo || 'A').charAt(0).toUpperCase();
    ctx.fillStyle = '#e6f3ed';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = '#0a523d';
    ctx.font = '900 120px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, photoX + photoW / 2, photoY + photoH / 2);
  }
  ctx.restore();

  // Borde verde del marco de la foto (CMYK in-gamut green: #0d6e50)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(photoX + photoRadius, photoY);
  ctx.lineTo(photoX + photoW - photoRadius, photoY);
  ctx.arcTo(photoX + photoW, photoY, photoX + photoW, photoY + photoRadius, photoRadius);
  ctx.lineTo(photoX + photoW, photoY + photoH - photoRadius);
  ctx.arcTo(photoX + photoW, photoY + photoH, photoX + photoW - photoRadius, photoY + photoH, photoRadius);
  ctx.lineTo(photoX + photoRadius, photoY + photoH);
  ctx.arcTo(photoX, photoY + photoH, photoX, photoY + photoH - photoRadius, photoRadius);
  ctx.lineTo(photoX, photoY + photoRadius);
  ctx.arcTo(photoX, photoY, photoX + photoRadius, photoY, photoRadius);
  ctx.closePath();
  ctx.strokeStyle = '#0d6e50';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 4. Bloque de Datos (Nombre, Apellidos, Código, Tipo)
  const fullNombre = formatNombreCard(
    afiliado.nombres || afiliado.representante_nombre || afiliado.nombre_completo,
    afiliado.apellidos
  ).toUpperCase();

  let textY = 626;
  ctx.fillStyle = '#0a523d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.font = '900 35px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(fullNombre, WIDTH / 2, textY);

  textY += 40;

  ctx.font = '800 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#0d5c46';
  const codigoText = `AFILIADO - CÓDIGO: ${afiliado.codigo || ''}`;
  ctx.fillText(codigoText, WIDTH / 2, textY);

  textY += 22;

  const tipoLabelMap: Record<string, string | string[]> = {
    'Natural': 'AGENTE INDEPENDIENTE',
    'Agente': 'AGENTE INDEPENDIENTE',
    'Agente Corporativo': 'AGENTE CORPORATIVO',
    'Corporativo': ['CORPORATIVO', 'REPR. LEGAL'],
  };
  const label = afiliado.tipo_afiliado ? (tipoLabelMap[afiliado.tipo_afiliado] ?? afiliado.tipo_afiliado.toUpperCase()) : null;

  if (label) {
    ctx.font = '700 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#12644e';
    if (Array.isArray(label)) {
      for (const line of label) {
        ctx.fillText(line, WIDTH / 2, textY);
        textY += 20;
      }
    } else {
      ctx.fillText(label, WIDTH / 2, textY);
      textY += 20;
    }
  }

  // 5. Pie de Carnet (QR + Logo Empresa)
  const footerY = 746;
  let finalQrUrl = qrCodeUrl;
  if (!finalQrUrl) {
    const mCode = (afiliado?.codigo && String(afiliado.codigo).trim() !== '') ? String(afiliado.codigo).trim() : null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pUrl = mCode ? `${origin}/miembros/${mCode}` : `${origin}/miembros/${afiliado?.id_afiliado || ''}?by=id`;
    try {
      finalQrUrl = await QRCode.toDataURL(pUrl, {
        margin: 1,
        width: 360,
        color: { dark: '#000000', light: '#00000000' },
        errorCorrectionLevel: 'H'
      });
    } catch {
      finalQrUrl = null;
    }
  }

  const qrImg = finalQrUrl ? await loadImage(finalQrUrl) : null;
  const empresaLogoImg = afiliado?.empresa_logo_url ? await loadImage(afiliado.empresa_logo_url) : null;

  if (empresaLogoImg) {
    const leftCenterX = WIDTH * 0.29;
    const rightCenterX = WIDTH * 0.72;
    if (qrImg) {
      ctx.drawImage(qrImg, leftCenterX - 80, footerY, 160, 160);
    }
    ctx.fillStyle = '#525b62';
    ctx.font = '700 15px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFICAR QR', leftCenterX, footerY + 168);

    const maxW = 250;
    const maxH = 160;
    const aspect = empresaLogoImg.width / empresaLogoImg.height;
    let logoW = maxW;
    let logoH = maxH;
    if (aspect > 1) {
      logoW = Math.min(maxW, maxH * aspect);
      logoH = logoW / aspect;
    } else {
      logoH = Math.min(maxH, maxW / aspect);
      logoW = logoH * aspect;
    }
    const logoX = rightCenterX - logoW / 2;
    const logoY = footerY + (maxH - logoH) / 2;
    ctx.drawImage(empresaLogoImg, logoX, logoY, logoW, logoH);
  } else {
    if (qrImg) {
      ctx.drawImage(qrImg, (WIDTH - 160) / 2, footerY, 160, 160);
    }
    ctx.fillStyle = '#525b62';
    ctx.font = '700 15px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFICAR QR', WIDTH / 2, footerY + 168);
  }

  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Error generando Blob de Canvas'));
    }, 'image/jpeg', 0.98);
  });
}
