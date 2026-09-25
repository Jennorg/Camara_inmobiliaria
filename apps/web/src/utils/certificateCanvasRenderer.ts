import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { formatNombreCard } from '@/utils/formatters';

import logoCieboGreen from '@/assets/logo_ciebo_green.svg';
import logoAffiliationImg from '@/assets/Logo4.webp';
import firmaFranciscoImg from '@/assets/firma-francisco.webp';
import firmaGracielaImg from '@/assets/firma-graciela-ledezma.webp';
import cibirBadgeImg from '@/assets/Cibir.webp';
import pegiBadgeImg from '@/assets/Pegi.webp';
import preaniBadgeImg from '@/assets/Preani.webp';
import padiBadgeImg from '@/assets/Padi.webp';

// Cache de imágenes en memoria para dibujo instantáneo
const imgCache = new Map<string, HTMLImageElement>();

export async function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  if (!src || typeof src !== 'string') return null;
  if (imgCache.has(src)) return imgCache.get(src)!;

  // Si ya es un data URL
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        imgCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Carga remota o asset local con fetch para garantizar CORS limpio
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          imgCache.set(src, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });
    }
  } catch {
    // Si fetch falla, fallback con crossOrigin
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ensureFontsReady() {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.allSettled([
        document.fonts.load('italic 700 24px "Playfair Display"'),
        document.fonts.load('italic 600 24px "Playfair Display"'),
        document.fonts.load('900 24px Montserrat'),
        document.fonts.load('800 24px Montserrat'),
        document.fonts.load('700 24px Montserrat'),
        document.fonts.load('600 24px Montserrat'),
        document.fonts.load('500 24px Montserrat'),
        document.fonts.load('400 24px Montserrat'),
        document.fonts.load('400 24px "Alex Brush"'),
        document.fonts.load('400 24px "Great Vibes"'),
      ]);
      await document.fonts.ready;
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RENDERIZADOR: CERTIFICADO DE AFILIACIÓN GREMIAL
// ─────────────────────────────────────────────────────────────────────────────

export interface CertificadoAfiliacionRenderData {
  nombre_completo: string;
  nombres?: string | null;
  apellidos?: string | null;
  cedula?: string | null;
  codigo?: string | null;
  tipo_afiliado: string;
  empresa_rif_tipo?: string | null;
  empresa_rif_numero?: string | null;
  empresa_razon_social?: string | null;
  verificationUrl: string;
}

export async function renderCertificadoAfiliacionCanvas(
  data: CertificadoAfiliacionRenderData,
  scale: number = 3.0
): Promise<HTMLCanvasElement> {
  await ensureFontsReady();

  const WIDTH = 1000;
  const HEIGHT = 707;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  // 1. Fondo Blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Marco perimetral fino
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(25, 25, 950, 657);

  // 3. Decoraciones geométricas vectoriales (SVG fidelity)
  // Esquina superior derecha: Polígono amarillo
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(880, 25);
  ctx.lineTo(975, 25);
  ctx.lineTo(975, 120);
  ctx.closePath();
  ctx.fill();

  // Lado izquierdo: Chevron dorado
  ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
  ctx.beginPath();
  ctx.moveTo(25, 150);
  ctx.lineTo(65, 240);
  ctx.lineTo(25, 330);
  ctx.closePath();
  ctx.fill();

  // Esquina inferior izquierda: Arcos y Sector verde oscuro
  ctx.save();
  ctx.strokeStyle = 'rgba(167, 243, 208, 0.6)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(25, 240);
  ctx.quadraticCurveTo(250, 240, 330, 682);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(25, 200);
  ctx.quadraticCurveTo(290, 200, 375, 682);
  ctx.stroke();

  ctx.fillStyle = '#022c22';
  ctx.beginPath();
  ctx.moveTo(25, 300);
  ctx.bezierCurveTo(130, 300, 290, 420, 290, 682);
  ctx.lineTo(25, 682);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Esquina inferior derecha: Ondas continuas
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.beginPath();
  ctx.moveTo(520, 682);
  ctx.quadraticCurveTo(720, 575, 975, 605);
  ctx.lineTo(975, 682);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(4, 120, 87, 0.75)';
  ctx.beginPath();
  ctx.moveTo(610, 682);
  ctx.quadraticCurveTo(800, 595, 975, 625);
  ctx.lineTo(975, 682);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#022c22';
  ctx.beginPath();
  ctx.moveTo(700, 682);
  ctx.quadraticCurveTo(850, 615, 975, 650);
  ctx.lineTo(975, 682);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 4. Logo Superior CIEBO
  const logoImg = await loadCanvasImage(logoAffiliationImg);
  if (logoImg) {
    const lWidth = 140;
    const lHeight = (logoImg.height / logoImg.width) * lWidth;
    ctx.drawImage(logoImg, 500 - lWidth / 2, 40, lWidth, lHeight);
  }

  // Textos del Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#022c22';
  ctx.font = 'bold 11px Montserrat, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('CÁMARA INMOBILIARIA', 500, 150);

  ctx.fillStyle = '#064e3b';
  ctx.fillText('DE BOLÍVAR', 500, 166);
  ctx.letterSpacing = '0px';

  // 5. Cuerpo Principal (Centrado Vertical Dinámico)
  const hasRole = Boolean(
    (data.tipo_afiliado === 'Corporativo' && (data.nombres || data.apellidos)) ||
    (data.tipo_afiliado === 'Agente Corporativo' && data.empresa_razon_social)
  );

  // Espacio vertical disponible entre el header (y ≈ 175) y el footer (y ≈ 515): 340px
  const blockHeight = hasRole ? 215 : 195;
  const startY = Math.round(175 + (340 - blockHeight) / 2);

  ctx.fillStyle = '#064e3b';
  ctx.font = '500 13px Montserrat, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('LA CÁMARA INMOBILIARIA DE BOLÍVAR (CIEBO)', 500, startY);
  ctx.fillText('LE OTORGA EL PRESENTE CERTIFICADO A', 500, startY + 18);
  ctx.letterSpacing = '0px';

  // Nombre del Afiliado
  const nombre = (data.nombre_completo || 'AFILIADO').toUpperCase();
  ctx.fillStyle = '#022c22';
  const nameLen = nombre.length;
  const nameFontSize = nameLen > 36 ? 24 : nameLen > 28 ? 27 : 31;
  ctx.font = `800 ${nameFontSize}px Montserrat, sans-serif`;
  ctx.fillText(nombre, 500, startY + 64);

  // Subtítulo de representación si aplica
  let currentY = startY + 84;
  if (data.tipo_afiliado === 'Corporativo' && (data.nombres || data.apellidos)) {
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.fillText(`REPRESENTANTE LEGAL: ${(data.nombres || '')} ${(data.apellidos || '')}`.toUpperCase(), 500, currentY);
    currentY += 20;
  } else if (data.tipo_afiliado === 'Agente Corporativo' && data.empresa_razon_social) {
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.fillText(`AGENTE CORPORATIVO DE: ${data.empresa_razon_social}`.toUpperCase(), 500, currentY);
    currentY += 20;
  }

  // Cédula / RIF
  let docId = data.cedula || data.empresa_rif_numero || '';
  if (docId) {
    if (!docId.includes('-')) {
      const pref = data.tipo_afiliado === 'Corporativo' ? (data.empresa_rif_tipo || 'J') : 'V';
      const cleanNum = docId.replace(/\D/g, '');
      docId = cleanNum ? `${pref}-${Number(cleanNum).toLocaleString('es-VE')}` : `${pref}-${docId}`;
    }
  } else {
    docId = '—';
  }

  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(docId, 500, currentY + 12);

  // Línea sutil bajo la cédula
  ctx.strokeStyle = 'rgba(6, 78, 59, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(380, currentY + 20);
  ctx.lineTo(620, currentY + 20);
  ctx.stroke();

  // Cinta Decorativa (Ribbon)
  const ribbonY = currentY + 34;
  ctx.save();
  const grad = ctx.createLinearGradient(410, 0, 620, 0);
  grad.addColorStop(0, '#047857');
  grad.addColorStop(1, '#eab308');

  // Zigzag segments
  const rx = 380;
  const ry = ribbonY;
  // Segment 1
  ctx.fillStyle = '#022c22';
  ctx.beginPath();
  ctx.moveTo(rx + 12, ry + 14);
  ctx.lineTo(rx + 2, ry + 6);
  ctx.lineTo(rx + 12, ry - 2);
  ctx.lineTo(rx + 18, ry + 6);
  ctx.closePath();
  ctx.fill();

  // Segment 2
  ctx.fillStyle = '#047857';
  ctx.beginPath();
  ctx.moveTo(rx + 18, ry + 6);
  ctx.lineTo(rx + 26, ry - 2);
  ctx.lineTo(rx + 34, ry + 6);
  ctx.lineTo(rx + 26, ry + 14);
  ctx.closePath();
  ctx.fill();

  // Segment 3
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.moveTo(rx + 34, ry + 6);
  ctx.lineTo(rx + 42, ry - 2);
  ctx.lineTo(rx + 50, ry + 6);
  ctx.lineTo(rx + 42, ry + 14);
  ctx.closePath();
  ctx.fill();

  // Segment 4
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(rx + 50, ry + 6);
  ctx.lineTo(rx + 58, ry - 2);
  ctx.lineTo(rx + 66, ry + 6);
  ctx.lineTo(rx + 58, ry + 14);
  ctx.closePath();
  ctx.fill();

  // Segment 5
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.moveTo(rx + 66, ry + 6);
  ctx.lineTo(rx + 72, ry);
  ctx.lineTo(rx + 72, ry + 12);
  ctx.closePath();
  ctx.fill();

  // Barra degradada principal
  ctx.fillStyle = grad;
  ctx.fillRect(rx + 72, ry, 170, 12);
  ctx.restore();

  // Texto de constancia en Playfair Display cursiva
  ctx.fillStyle = '#022c22';
  ctx.font = 'italic 600 16px "Playfair Display", Georgia, serif';
  ctx.fillText('Como constancia de Afiliación a este Gremio', 500, ribbonY + 45);

  // 6. Pie de Página: QR a la Izquierda, Firma al Centro, Código a la Derecha
  // A. QR Code a la izquierda
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, { margin: 1, width: 200 });
  const qrImg = await loadCanvasImage(qrDataUrl);
  if (qrImg) {
    // Tarjeta blanca para el QR
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(110, 520, 100, 100, 12);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(qrImg, 118, 528, 84, 84);
    ctx.restore();

    ctx.fillStyle = '#d1fae5';
    ctx.font = 'italic 10px "Playfair Display", serif';
    ctx.fillText('Código de afiliación', 160, 642);
  }

  // B. Firma al centro (Francisco Piñango)
  const firmaImg = await loadCanvasImage(firmaFranciscoImg);
  if (firmaImg) {
    const fW = 160;
    const fH = (firmaImg.height / firmaImg.width) * fW;
    ctx.drawImage(firmaImg, 500 - fW / 2, 515, fW, fH);
  }
  // Línea divisoria firma
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(400, 584);
  ctx.lineTo(600, 584);
  ctx.stroke();

  ctx.fillStyle = '#022c22';
  ctx.font = '900 11px Montserrat, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('FRANCISCO PIÑANGO', 500, 600);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 9.5px Montserrat, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('PRESIDENTE DE LA JUNTA DIRECTIVA', 500, 614);
  ctx.letterSpacing = '0px';

  // C. Código de afiliado a la derecha
  ctx.fillStyle = '#064e3b';
  ctx.font = '900 11px Montserrat, sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('CÓDIGO DE AFILIADO', 835, 550);
  ctx.letterSpacing = '0px';

  // Caja del código
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(755, 565, 160, 46, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#022c22';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(data.codigo || '—', 835, 595);
  ctx.restore();

  return canvas;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RENDERIZADOR: CERTIFICADOS DE PROGRAMAS (CIBIR, PEGI, PREANI, PADI)
// ─────────────────────────────────────────────────────────────────────────────

export interface CertificadoProgramaRenderData {
  codigo: string;
  fechaEmisionIso: string;
  titularNombre: string;
  programaOCurso: string;
  programaCodigo: string;
  urlVerificacion: string;
  cedula?: string | null;
  firmantes?: Array<{
    nombre: string;
    cargo: string;
    firma_url?: string | null;
    mostrar_firma?: boolean;
  }>;
}

const PROGRAM_TITLES: Record<string, { abbr: string; title: string[] }> = {
  CIBIR: { abbr: 'CIBIR', title: ['CURSO INTRODUCTORIO', 'A LOS BIENES RAÍCES'] },
  PEGI: { abbr: 'PEGI', title: ['PROGRAMA DE ESPECIALIZACIÓN', 'EN GERENCIA INMOBILIARIA'] },
  PREANI: { abbr: 'PREANI', title: ['PROGRAMA DE ESTUDIOS AVANZADOS', 'EN NEGOCIOS INMOBILIARIOS'] },
  PADI: { abbr: 'PADI', title: ['PROGRAMA AVANZADO', 'EN DESARROLLO INMOBILIARIO'] },
};

export async function renderCertificadoProgramaCanvas(
  data: CertificadoProgramaRenderData,
  scale: number = 3.0
): Promise<HTMLCanvasElement> {
  await ensureFontsReady();

  const WIDTH = 1000;
  const HEIGHT = 707;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  // 1. Fondo Blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Marco perimetral fino
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, 952, 659);

  // 3. Polígonos de las esquinas en SVG Vectorial Nativo
  // Esquina superior derecha
  ctx.fillStyle = '#2F5496';
  ctx.beginPath();
  ctx.moveTo(1000, 0);
  ctx.lineTo(760, 0);
  ctx.lineTo(1000, 212);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2E6F44';
  ctx.beginPath();
  ctx.moveTo(1000, 0);
  ctx.lineTo(825, 0);
  ctx.lineTo(1000, 173);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F6A644';
  ctx.beginPath();
  ctx.moveTo(1000, 0);
  ctx.lineTo(928, 0);
  ctx.lineTo(1000, 106);
  ctx.closePath();
  ctx.fill();

  // Esquina inferior derecha
  ctx.fillStyle = '#F6A644';
  ctx.beginPath();
  ctx.moveTo(1000, 707);
  ctx.lineTo(1000, 558);
  ctx.lineTo(790, 707);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2F5496';
  ctx.beginPath();
  ctx.moveTo(1000, 707);
  ctx.lineTo(1000, 601);
  ctx.lineTo(920, 707);
  ctx.closePath();
  ctx.fill();

  // Esquina inferior izquierda
  ctx.fillStyle = '#2E6F44';
  ctx.beginPath();
  ctx.moveTo(0, 707);
  ctx.lineTo(202, 707);
  ctx.lineTo(0, 564);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2F5496';
  ctx.beginPath();
  ctx.moveTo(0, 707);
  ctx.lineTo(227, 707);
  ctx.lineTo(88, 645);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F6A644';
  ctx.beginPath();
  ctx.moveTo(0, 707);
  ctx.lineTo(200, 707);
  ctx.lineTo(0, 672);
  ctx.closePath();
  ctx.fill();

  // 4. Marca de agua central tenue
  const logoGreen = await loadCanvasImage(logoCieboGreen);
  if (logoGreen) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.drawImage(logoGreen, 500 - 300, 353 - 140, 600, 280);
    ctx.restore();
  }

  // 5. Badge circular en esquina superior izquierda
  let progBadgeSrc = cibirBadgeImg;
  const pCodeCheck = (data.programaCodigo || 'CIBIR').toUpperCase();
  if (pCodeCheck === 'PEGI') progBadgeSrc = pegiBadgeImg;
  else if (pCodeCheck === 'PREANI') progBadgeSrc = preaniBadgeImg;
  else if (pCodeCheck === 'PADI') progBadgeSrc = padiBadgeImg;

  const progBadge = await loadCanvasImage(progBadgeSrc);
  if (progBadge) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(73, 73, 88, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(progBadge, -15, -15, 176, 176);
    ctx.restore();

    // Borde dorado
    ctx.save();
    ctx.strokeStyle = '#cf9f2d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(73, 73, 85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Línea divisoria del header
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(161, 155);
  ctx.lineTo(976, 155);
  ctx.stroke();

  // 7. Logo Header izquierdo (centrado verticalmente entre la línea superior y=24 y la divisoria y=155)
  if (logoGreen) {
    const maxW = 260;
    const maxH = 105;
    const aspect = logoGreen.width / logoGreen.height;
    let drawW = maxW;
    let drawH = drawW / aspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }
    const drawX = 180 + (280 - drawW) / 2;
    const drawY = 24 + (131 - drawH) / 2;
    ctx.drawImage(logoGreen, drawX, drawY, drawW, drawH);
  }

  // 8. Header Derecho: Siglas y Título del Programa
  const pCode = (data.programaCodigo || 'CIBIR').toUpperCase();
  const progInfo = PROGRAM_TITLES[pCode] || { abbr: pCode, title: [data.programaOCurso.toUpperCase()] };

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f5431';
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText(progInfo.abbr, 740, 72);

  // Caja con bordes superior e inferior
  ctx.strokeStyle = 'rgba(15, 84, 49, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(610, 88);
  ctx.lineTo(870, 88);
  ctx.moveTo(610, 134);
  ctx.lineTo(870, 134);
  ctx.stroke();

  ctx.fillStyle = '#0f5431';
  ctx.font = '800 9px Montserrat, sans-serif';
  ctx.letterSpacing = '1px';
  if (progInfo.title.length === 1) {
    ctx.fillText(progInfo.title[0], 740, 114);
  } else {
    ctx.fillText(progInfo.title[0], 740, 105);
    ctx.fillText(progInfo.title[1], 740, 122);
  }
  ctx.letterSpacing = '0px';

  // 9. Cuerpo Central
  ctx.fillStyle = '#0f5431';
  ctx.font = '900 25px Montserrat, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('CÁMARA INMOBILIARIA', 500, 204);
  ctx.fillText('DE BOLÍVAR', 500, 232);

  ctx.fillStyle = '#0f2e59';
  ctx.font = '900 12px Montserrat, sans-serif';
  ctx.letterSpacing = '2.5px';
  ctx.fillText('OTORGA EL PRESENTE CERTIFICADO A:', 500, 276);
  ctx.letterSpacing = '0px';

  // Nombre del Estudiante
  const stName = formatNombreCard(data.titularNombre) || data.titularNombre;
  ctx.fillStyle = '#0f172a';
  const stLen = stName.length;
  const stFontSize = stLen > 34 ? 26 : stLen > 26 ? 30 : 36;
  ctx.font = `italic 700 ${stFontSize}px "Playfair Display", Georgia, serif`;
  ctx.fillText(stName, 500, 335);

  // Línea bajo el nombre
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(180, 348);
  ctx.lineTo(820, 348);
  ctx.stroke();

  // Cédula
  if (data.cedula) {
    const rawCi = data.cedula.replace(/\D/g, '');
    const cleanCi = rawCi.length >= 5 ? Number(rawCi).toLocaleString('es-VE') : data.cedula;
    ctx.fillStyle = '#0f2e59';
    ctx.font = '900 14px monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText(`C.I.: ${cleanCi}`, 500, 378);
    ctx.letterSpacing = '0px';
  }

  // Texto de Aprobación
  ctx.fillStyle = '#0f2e59';
  ctx.font = '900 12.5px Montserrat, sans-serif';
  ctx.letterSpacing = '1px';
  if (pCode === 'CIBIR') {
    ctx.fillText('POR HABER PARTICIPADO EN EL CURSO INTRODUCTORIO A LOS', 500, 414);
    ctx.fillText('BIENES RAÍCES', 500, 432);
  } else {
    ctx.fillText(`POR HABER PARTICIPADO EN EL ${data.programaOCurso.toUpperCase()}`, 500, 420);
  }
  ctx.letterSpacing = '0px';

  // 10. Pie de Página: Firmas y QR Central
  const firmantesList = (data.firmantes && data.firmantes.length > 0)
    ? [...data.firmantes]
    : [];

  const f1 = firmantesList[0] || {
    nombre: 'FRANCISCO PIÑANGO',
    cargo: 'PRESIDENTE DE LA CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR',
    firma_url: null,
    mostrar_firma: true,
  };

  const f2 = (firmantesList.length > 1 ? firmantesList[1] : null) || {
    nombre: 'GRACIELA LEDEZMA',
    cargo: 'DIRECTORA DE FORMACIÓN',
    firma_url: null,
    mostrar_firma: true,
  };

  // Firma 1 (Izquierda - Francisco Piñango)
  if (f1) {
    const f1ImgSrc = f1.firma_url;
    if (f1ImgSrc && f1.mostrar_firma !== false) {
      const f1Img = await loadCanvasImage(f1ImgSrc);
      if (f1Img) {
        const maxW = 150;
        const maxH = 75;
        const aspect = f1Img.width / f1Img.height;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        ctx.drawImage(f1Img, 240 - w / 2, 570 - h, w, h);
      }
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(150, 574);
    ctx.lineTo(330, 574);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.fillText(f1.nombre.toUpperCase(), 240, 592);

    ctx.fillStyle = '#475569';
    ctx.font = '700 7.5px Montserrat, sans-serif';
    ctx.fillText(f1.cargo.toUpperCase(), 240, 606);
  }

  // QR Central con Fecha y Código
  const pQrUrl = await QRCode.toDataURL(data.urlVerificacion, { margin: 1, width: 200 });
  const pQrImg = await loadCanvasImage(pQrUrl);
  if (pQrImg) {
    ctx.drawImage(pQrImg, 500 - 42, 500, 84, 84);
  }

  // Fecha format
  let fechaStr = data.fechaEmisionIso;
  try {
    const d = new Date(data.fechaEmisionIso);
    if (!Number.isNaN(d.getTime())) {
      fechaStr = `${d.toLocaleDateString('es-VE', { month: 'long' })}, ${d.getFullYear()}`;
    }
  } catch {}

  ctx.fillStyle = '#0f2e59';
  ctx.font = '800 11px Montserrat, sans-serif';
  ctx.fillText(fechaStr.toUpperCase(), 500, 604);

  // Firma 2 (Derecha - Graciela Ledezma)
  if (f2) {
    const f2ImgSrc = f2.firma_url;
    if (f2ImgSrc && f2.mostrar_firma !== false) {
      const f2Img = await loadCanvasImage(f2ImgSrc);
      if (f2Img) {
        const maxW = 140;
        const maxH = 75;
        const aspect = f2Img.width / f2Img.height;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        ctx.drawImage(f2Img, 760 - w / 2, 570 - h, w, h);
      }
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(670, 574);
    ctx.lineTo(850, 574);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.fillText(f2.nombre.toUpperCase(), 760, 592);

    ctx.fillStyle = '#475569';
    ctx.font = '700 7.5px Montserrat, sans-serif';
    ctx.fillText(f2.cargo.toUpperCase(), 760, 606);
  }

  return canvas;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RENDERIZADOR: CERTIFICADOS DE CURSOS / TALLERES / CONFERENCIAS
// ─────────────────────────────────────────────────────────────────────────────

export interface CertificadoCursoRenderData {
  codigo: string;
  fechaEmisionIso: string;
  titularNombre: string;
  programaOCurso: string;
  modalidad?: string | null;
  categoria?: string | null;
  descripcion?: string | null;
  instructorNombre?: string | null;
  instructorCargo?: string | null;
  urlVerificacion: string;
  cedula?: string | null;
  modulosLista?: string | string[] | null;
  firmantes?: Array<{
    nombre: string;
    cargo: string;
    firma_url?: string | null;
    mostrar_firma?: boolean;
  }>;
}

function getCursoPrefijoParticipacion(
  modalidad?: string | null,
  categoria?: string | null,
  titulo?: string,
  descripcion?: string | null,
  modulosLista?: string | string[] | null
): { prefix: string; cleanTitle: string; itemsList: string[] } {
  const modLower = (modalidad || '').toLowerCase();
  const catLower = (categoria || '').toLowerCase();
  const titLower = (titulo || '').toLowerCase();
  const descLower = (descripcion || '').toLowerCase();

  let itemsList: string[] = [];
  if (Array.isArray(modulosLista)) {
    itemsList = modulosLista.map((s) => String(s || '').trim()).filter(Boolean);
  } else if (typeof modulosLista === 'string' && modulosLista.trim()) {
    itemsList = modulosLista.split('|||').map((s) => s.trim()).filter(Boolean);
  }

  if (itemsList.length === 1 && /^mó?dulo general$/i.test(itemsList[0])) {
    itemsList = [];
  } else {
    itemsList = itemsList.filter((s) => !/^mó?dulo general$/i.test(s));
  }

  if (itemsList.length === 0 && descripcion) {
    const rawText = descripcion;
    const lines = rawText
      .split(/\r?\n|;|\u2022|\u25cf/)
      .map((s) => s.trim().replace(/^[-*•\d+.]\s*/, ''))
      .filter((s) => s.length > 0 && !/^conferencias?\s*:?$/i.test(s) && !/^modulos?\s*:?$/i.test(s) && !/^curso test$/i.test(s) && !/^test$/i.test(s) && !/^mó?dulo general$/i.test(s));
    if (lines.length >= 1) {
      itemsList = lines;
    }
  }

  const allText = `${modLower} ${catLower} ${titLower} ${descLower}`;
  const isConferencia = allText.includes('conferencia') || allText.includes('magia y realidad');
  const isTaller = allText.includes('taller');
  const isSeminario = allText.includes('seminario');
  const isMasterclass = allText.includes('masterclass');
  const isDiplomado = allText.includes('diplomado');
  const isCharla = allText.includes('charla');
  const isConversatorio = allText.includes('conversatorio');

  const isPlural = itemsList.length > 1;

  let prefix = '';
  if (isConferencia && (allText.includes('modulo') || allText.includes('módulo'))) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS CONFERENCIAS Y MÓDULOS:' : 'POR SU PARTICIPACIÓN EN LA CONFERENCIA Y MÓDULOS:';
  } else if (isConferencia) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS CONFERENCIAS:' : 'POR SU PARTICIPACIÓN EN LA CONFERENCIA:';
  } else if (isTaller) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS TALLERES:' : 'POR SU PARTICIPACIÓN EN EL TALLER:';
  } else if (isSeminario) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS SEMINARIOS:' : 'POR SU PARTICIPACIÓN EN EL SEMINARIO:';
  } else if (isMasterclass) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS MASTERCLASSES:' : 'POR SU PARTICIPACIÓN EN LA MASTERCLASS:';
  } else if (isDiplomado) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS DIPLOMADOS:' : 'POR SU PARTICIPACIÓN EN EL DIPLOMADO:';
  } else if (isCharla) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS CHARLAS:' : 'POR SU PARTICIPACIÓN EN LA CHARLA:';
  } else if (isConversatorio) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS CONVERSATORIOS:' : 'POR SU PARTICIPACIÓN EN EL CONVERSATORIO:';
  } else if (isPlural) {
    prefix = 'POR SU PARTICIPACIÓN EN LOS MÓDULOS:';
  } else {
    prefix = 'POR SU PARTICIPACIÓN EN EL CURSO:';
  }

  let cleanTitle = (titulo || 'FORMACIÓN PROFESIONAL').trim();
  cleanTitle = cleanTitle
    .replace(/^taller\s*:?\s*/i, '')
    .replace(/^conferencias?\s*:?\s*/i, '')
    .replace(/^seminario\s*:?\s*/i, '')
    .replace(/^masterclass\s*:?\s*/i, '')
    .replace(/^diplomado\s*:?\s*/i, '')
    .replace(/^charla\s*:?\s*/i, '')
    .replace(/^conversatorio\s*:?\s*/i, '')
    .replace(/^curso\s*:?\s*/i, '')
    .trim();

  return { prefix, cleanTitle, itemsList };
}

export async function renderCertificadoCursoCanvas(
  data: CertificadoCursoRenderData,
  scale: number = 3.0
): Promise<HTMLCanvasElement> {
  await ensureFontsReady();

  const WIDTH = 1000;
  const HEIGHT = 707;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  // 1. Fondo Blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Marco perimetral fino
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, 952, 659);

  // 3. Polígonos de las esquinas en SVG Vectorial Nativo
  // Esquina superior izquierda
  ctx.fillStyle = '#F6A644';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(210, 0);
  ctx.lineTo(0, 127);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2E6F44';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(161, 0);
  ctx.lineTo(0, 68);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2F5496';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(78, 0);
  ctx.lineTo(0, 57);
  ctx.closePath();
  ctx.fill();

  // Esquina superior derecha
  ctx.fillStyle = '#2F5496';
  ctx.beginPath();
  ctx.moveTo(1000, 0);
  ctx.lineTo(760, 0);
  ctx.lineTo(1000, 212);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2E6F44';
  ctx.beginPath();
  ctx.moveTo(1000, 0);
  ctx.lineTo(825, 0);
  ctx.lineTo(1000, 173);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F6A644';
  ctx.beginPath();
  ctx.moveTo(1000, 0);
  ctx.lineTo(928, 0);
  ctx.lineTo(1000, 106);
  ctx.closePath();
  ctx.fill();

  // Esquina inferior derecha
  ctx.fillStyle = '#F6A644';
  ctx.beginPath();
  ctx.moveTo(1000, 707);
  ctx.lineTo(1000, 558);
  ctx.lineTo(790, 707);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2F5496';
  ctx.beginPath();
  ctx.moveTo(1000, 707);
  ctx.lineTo(1000, 601);
  ctx.lineTo(920, 707);
  ctx.closePath();
  ctx.fill();

  // Esquina inferior izquierda
  ctx.fillStyle = '#2E6F44';
  ctx.beginPath();
  ctx.moveTo(0, 707);
  ctx.lineTo(202, 707);
  ctx.lineTo(0, 564);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2F5496';
  ctx.beginPath();
  ctx.moveTo(0, 707);
  ctx.lineTo(227, 707);
  ctx.lineTo(88, 645);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F6A644';
  ctx.beginPath();
  ctx.moveTo(0, 707);
  ctx.lineTo(200, 707);
  ctx.lineTo(0, 672);
  ctx.closePath();
  ctx.fill();

  // 4. Marca de agua central tenue
  const logoGreen = await loadCanvasImage(logoCieboGreen);
  if (logoGreen) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.drawImage(logoGreen, 500 - 320, 353 - 140 + 24, 640, 280);
    ctx.restore();
  }

  // 5. Logo Superior CIEBO (centrado, h-28 = 112px)
  if (logoGreen) {
    const lH = 112;
    const lW = (logoGreen.width / logoGreen.height) * lH;
    ctx.drawImage(logoGreen, 500 - lW / 2, 38, lW, lH);
  }

  // 6. Encabezado institucional
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f5431';
  ctx.font = '900 18px Montserrat, sans-serif';
  ctx.letterSpacing = '1.8px';
  ctx.fillText('CÁMARA INMOBILIARIA', 500, 166);
  ctx.fillText('DE BOLÍVAR', 500, 186);

  // Otorgamiento
  ctx.fillStyle = '#1e293b';
  ctx.font = '800 12.5px Montserrat, sans-serif';
  ctx.letterSpacing = '2.75px';
  ctx.fillText('LA CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR', 500, 218);
  ctx.fillText('OTORGA EL SIGUIENTE RECONOCIMIENTO A:', 500, 235);
  ctx.letterSpacing = '0px';

  // 7 & 8. Sección Central: Nombre, Cédula y Participación (Centrado Vertical Dinámico)
  const nombreMostrado = formatNombreCard(data.titularNombre) || data.titularNombre;
  const nameLen = (nombreMostrado || '').length;
  const nameFontSize = nameLen > 35 ? 42 : nameLen > 28 ? 50 : nameLen > 20 ? 60 : 70;

  const { prefix, cleanTitle, itemsList } = getCursoPrefijoParticipacion(
    data.modalidad,
    data.categoria,
    data.programaOCurso,
    data.descripcion,
    data.modulosLista
  );

  const hasCedula = Boolean(data.cedula);
  const itemsCount = itemsList.length > 1 ? Math.min(itemsList.length, 3) : 1;
  const middleContentHeight = 60 + (hasCedula ? 26 : 0) + 26 + (itemsList.length > 1 ? itemsCount * 18 : 24);

  // Espacio vertical disponible entre el header (y ≈ 240) y las firmas (y ≈ 510): 270px
  const centerStartY = Math.round(240 + (270 - middleContentHeight) / 2);

  ctx.fillStyle = '#0f172a';
  ctx.font = `400 ${nameFontSize}px "Great Vibes", "Alex Brush", cursive`;
  ctx.fillText(nombreMostrado, 500, centerStartY + 48);

  // Línea sutil bajo el nombre (degradada)
  const lineGrad = ctx.createLinearGradient(140, 0, 860, 0);
  lineGrad.addColorStop(0, 'rgba(148, 163, 184, 0)');
  lineGrad.addColorStop(0.5, 'rgba(148, 163, 184, 0.9)');
  lineGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(140, centerStartY + 58);
  ctx.lineTo(860, centerStartY + 58);
  ctx.stroke();

  let curY = centerStartY + 58;

  // Cédula
  if (data.cedula) {
    curY += 24;
    const rawCi = data.cedula.replace(/\D/g, '');
    const cleanCi = rawCi.length >= 5 ? Number(rawCi).toLocaleString('es-VE') : data.cedula;
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 14px monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText(`C.I.: ${cleanCi}`, 500, curY);
    ctx.letterSpacing = '0px';
  }

  // Texto de Participación
  curY += 26;
  ctx.fillStyle = '#020617';
  ctx.font = '900 13.5px Montserrat, sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(prefix, 500, curY);

  if (itemsList.length > 1) {
    curY += 20;
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.letterSpacing = '0.5px';
    for (const item of itemsList.slice(0, 3)) {
      ctx.fillText(`• ${item}`, 500, curY);
      curY += 18;
    }
  } else {
    curY += 22;
    const singleTitle = itemsList.length === 1 ? itemsList[0] : cleanTitle;
    ctx.fillStyle = '#020617';
    ctx.font = '900 15px Montserrat, sans-serif';
    ctx.letterSpacing = '0.5px';
    ctx.fillText(singleTitle, 500, curY);
  }

  // 9. Sección Inferior: Firmas Horizontales (sin QR, exactamente como el preview)
  let activeFirmantes = (data.firmantes && data.firmantes.length > 0)
    ? [...data.firmantes]
    : [{
        nombre: 'FRANCISCO PIÑANGO',
        cargo: 'PRESIDENTE DE LA CAMARA INMOBILIARIA DE BOLIVAR',
        firma_url: null,
        mostrar_firma: true
      }];

  if (
    activeFirmantes.length === 1 &&
    data.instructorNombre &&
    !activeFirmantes.some((f) => f.nombre.trim().toLowerCase() === data.instructorNombre!.trim().toLowerCase())
  ) {
    activeFirmantes.push({
      nombre: data.instructorNombre,
      cargo: data.instructorCargo || 'FACILITADOR / CONFERENCISTA',
      firma_url: null,
      mostrar_firma: true
    });
  }

  const fCount = activeFirmantes.length;
  let xPositions: number[] = [];
  if (fCount === 1) xPositions = [500];
  else if (fCount === 2) xPositions = [320, 680];
  else if (fCount === 3) xPositions = [250, 500, 750];
  else if (fCount === 4) xPositions = [190, 395, 605, 810];
  else xPositions = activeFirmantes.map((_, i) => 150 + i * (700 / (fCount - 1)));

  for (let i = 0; i < fCount; i++) {
    const f = activeFirmantes[i];
    const fx = xPositions[i];
    const nombreStr = (f.nombre || '').toUpperCase();
    let cargoStr = (f.cargo || '').toUpperCase();
    if (
      (cargoStr.includes('PRESIDENTE') || cargoStr.includes('VICEPRESIDENTE')) &&
      !cargoStr.includes('CAMARA INMOBILIARIA') &&
      !cargoStr.includes('DEL ESTADO BOLIVAR') &&
      !cargoStr.includes('DE BOLIVAR')
    ) {
      cargoStr = `${cargoStr} DE LA CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR`;
    }

    const fImgSrc = f.firma_url || (nombreStr.includes('FRANCISCO') ? firmaFranciscoImg : null);
    if (fImgSrc && f.mostrar_firma !== false) {
      const img = await loadCanvasImage(fImgSrc);
      if (img) {
        const w = 140;
        const h = (img.height / img.width) * w;
        ctx.drawImage(img, fx - w / 2, 545 - h, w, h);
      }
    }

    // Línea de firma
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx - 88, 555);
    ctx.lineTo(fx + 88, 555);
    ctx.stroke();

    // Nombre del firmante
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 10px Montserrat, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(nombreStr, fx, 570);

    // Cargo
    ctx.fillStyle = '#475569';
    ctx.font = '700 7.5px Montserrat, sans-serif';
    ctx.letterSpacing = '0.5px';
    ctx.fillText(cargoStr, fx, 584);
  }

  // 10. Fecha de emisión abajo
  let fechaStr = data.fechaEmisionIso;
  try {
    const d = new Date(data.fechaEmisionIso);
    if (!Number.isNaN(d.getTime())) {
      const m = d.toLocaleDateString('es-VE', { month: 'long' });
      const y = d.getFullYear();
      fechaStr = `${m}, ${y}`;
    }
  } catch {}

  ctx.fillStyle = '#0f2e59';
  ctx.font = '900 11px Montserrat, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText(fechaStr.toUpperCase(), 500, 624);
  ctx.letterSpacing = '0px';

  return canvas;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTADORES A PNG Y PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  const downloadName = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar el archivo PNG del certificado');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCanvasAsPdf(canvas: HTMLCanvasElement, filename: string) {
  const downloadName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.98);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'SLOW');
  pdf.save(downloadName);
}
