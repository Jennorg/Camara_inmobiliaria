import { jsPDF } from 'jspdf';
import logoImg from '@/assets/Logo2.webp';
import firmaFranciscoImg from '@/assets/firma-francisco.webp';
import firmaGracielaImg from '@/assets/firma-graciela-ledezma.webp';

export function loadImageDataUrl(src: string): Promise<string> {
  return new Promise((resolve) => {
    if (!src) return resolve('');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 300;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

export interface CertificadoAfiliacionData {
  nombre_completo: string;
  tipo_afiliado?: string;
  nombres?: string;
  apellidos?: string;
  empresa_razon_social?: string;
  cedula?: string;
  codigo?: string | number;
  qrUrl?: string;
}

export async function downloadCertificadoAfiliacionPdf(data: CertificadoAfiliacionData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = 297;
  const height = 210;

  // Background rect & borders
  doc.setDrawColor(2, 44, 34); // #022c22
  doc.setLineWidth(1);
  doc.rect(8, 8, width - 16, height - 16);

  doc.setDrawColor(234, 179, 8); // gold #eab308
  doc.setLineWidth(0.5);
  doc.rect(9.5, 9.5, width - 19, height - 19);

  // Top right gold triangle
  doc.setFillColor(234, 179, 8);
  doc.triangle(width - 35, 9.5, width - 9.5, 9.5, width - 9.5, 35, 'F');

  // Bottom left green accent
  doc.setFillColor(2, 44, 34);
  doc.rect(9.5, height - 35, 45, 25.5, 'F');

  // Bottom right green accents
  doc.setFillColor(4, 120, 87);
  doc.triangle(width - 60, height - 9.5, width - 9.5, height - 30, width - 9.5, height - 9.5, 'F');

  // Load images
  const [logoData, firmaData, qrData] = await Promise.all([
    loadImageDataUrl(logoImg),
    loadImageDataUrl(firmaFranciscoImg),
    loadImageDataUrl(data.qrUrl || ''),
  ]);

  // Header Logo
  if (logoData) {
    doc.addImage(logoData, 'PNG', (width - 45) / 2, 14, 45, 25);
  }

  // Header Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 44, 34);
  doc.text('CÁMARA INMOBILIARIA', width / 2, 43, { align: 'center' });
  doc.setTextColor(4, 120, 87);
  doc.text('DE BOLÍVAR', width / 2, 48, { align: 'center' });

  // Body text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(4, 120, 87);
  doc.text('La Cámara Inmobiliaria de Bolívar (CIEBO)', width / 2, 59, { align: 'center' });
  doc.text('le otorga el presente certificado a', width / 2, 64, { align: 'center' });

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(2, 44, 34);
  doc.text((data.nombre_completo || '').toUpperCase(), width / 2, 78, { align: 'center' });

  // Corporate subtitles
  let nextY = 88;
  if (data.tipo_afiliado === 'Corporativo' && (data.nombres || data.apellidos)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(4, 120, 87);
    doc.text(`REPRESENTANTE LEGAL: ${(data.nombres || '')} ${(data.apellidos || '')}`.toUpperCase(), width / 2, nextY, { align: 'center' });
    nextY += 7;
  } else if (data.tipo_afiliado === 'Agente Corporativo' && data.empresa_razon_social) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(4, 120, 87);
    doc.text(`AGENTE CORPORATIVO DE: ${data.empresa_razon_social}`.toUpperCase(), width / 2, nextY, { align: 'center' });
    nextY += 7;
  }

  // Document ID (Cédula / RIF)
  if (data.cedula) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(2, 44, 34);
    doc.text(data.cedula, width / 2, nextY, { align: 'center' });
    nextY += 8;
  }

  // Gold / Emerald Bar
  doc.setFillColor(4, 120, 87);
  doc.rect((width - 90) / 2, nextY, 90, 3, 'F');
  nextY += 12;

  // Constancia text
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(2, 44, 34);
  doc.text('Como constancia de Afiliación a este Gremio', width / 2, nextY, { align: 'center' });

  // Footer: QR Code (Left)
  if (qrData) {
    doc.addImage(qrData, 'PNG', 22, 145, 26, 26);
  }
  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Código de afiliación', 35, 175, { align: 'center' });

  // Footer: Signature (Center)
  if (firmaData) {
    doc.addImage(firmaData, 'PNG', (width - 50) / 2, 138, 50, 22);
  }
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line((width - 60) / 2, 163, (width + 60) / 2, 163);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(2, 44, 34);
  doc.text('FRANCISCO PIÑANGO', width / 2, 168, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Presidente de la Junta Directiva', width / 2, 172, { align: 'center' });

  // Footer: Code Box (Right)
  const codeStr = String(data.codigo || 'CIEBO');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(2, 44, 34);
  doc.text('CÓDIGO DE AFILIADO', width - 40, 152, { align: 'center' });

  // Code box: y=154, h=14 → center at y=161
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(width - 58, 154, 36, 14, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(2, 44, 34);
  // jsPDF default baseline = alphabetic. fontSize 12pt ≈ 4.2mm; center = 154+7=161; text Y = 161 + 1.5 = 162.5
  doc.text(codeStr, width - 40, 162.5, { align: 'center' });

  const safeFilename = (data.nombre_completo || 'Afiliado').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Certificado_Afiliacion_${safeFilename}.pdf`);
}

export interface CertificadoProgramaData {
  titularNombre: string;
  programaOCurso: string;
  programaCodigo?: string;
  cedula?: string;
  fechaEmisionIso?: string;
  qrUrl?: string;
}

export async function downloadCertificadoProgramaPdf(data: CertificadoProgramaData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = 297;
  const height = 210;

  // Background rect & borders
  doc.setDrawColor(15, 84, 49); // #0f5431
  doc.setLineWidth(1);
  doc.rect(8, 8, width - 16, height - 16);

  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.5);
  doc.rect(9.5, 9.5, width - 19, height - 19);

  // Load images
  const [logoData, firmaFranciscoData, firmaGracielaData, qrData] = await Promise.all([
    loadImageDataUrl(logoImg),
    loadImageDataUrl(firmaFranciscoImg),
    loadImageDataUrl(firmaGracielaImg),
    loadImageDataUrl(data.qrUrl || ''),
  ]);

  // Header Logo (Center)
  if (logoData) {
    doc.addImage(logoData, 'PNG', (width - 45) / 2, 12, 45, 25);
  }

  const codeAbbr = (data.programaCodigo || 'CIBIR').toUpperCase();

  // Camera Title (Below Logo)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 84, 49);
  doc.text('CÁMARA INMOBILIARIA', width / 2, 44, { align: 'center' });
  doc.text('DE BOLÍVAR', width / 2, 51, { align: 'center' });

  // Otorgamiento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 46, 89); // #0f2e59
  doc.text('OTORGA EL PRESENTE CERTIFICADO A:', width / 2, 70, { align: 'center' });

  // Name
  doc.setFont('times', 'italic');
  doc.setFontSize(32);
  doc.setTextColor(15, 23, 42);
  doc.text(data.titularNombre || '', width / 2, 85, { align: 'center' });

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line((width - 160) / 2, 89, (width + 160) / 2, 89);

  let nextY = 96;

  // Cédula
  if (data.cedula) {
    const rawCedula = data.cedula.replace(/\D/g, '');
    const formattedCedula = rawCedula.length >= 5 ? Number(rawCedula).toLocaleString('es-VE') : data.cedula;
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 46, 89);
    doc.text(`C.I.: ${formattedCedula}`, width / 2, nextY, { align: 'center' });
    nextY += 10;
  }

  // Course Description
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 46, 89);
  const courseText = codeAbbr === 'CIBIR'
    ? 'POR HABER PARTICIPADO EN EL CURSO INTRODUCTORIO A LOS BIENES RAÍCES'
    : `POR HABER PARTICIPADO EN EL ${(data.programaOCurso || '').toUpperCase()}`;
  
  doc.text(courseText, width / 2, nextY, { align: 'center', maxWidth: 200 });

  // Signatures & Footer
  const footerY = 142;

  // Firma Izquierda: Francisco Piñango
  if (firmaFranciscoData) {
    doc.addImage(firmaFranciscoData, 'PNG', 35, footerY, 45, 20);
  }
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(30, footerY + 20, 85, footerY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('FRANCISCO PIÑANGO', 57.5, footerY + 24, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('PRESIDENTE DE LA CÁMARA INMOBILIARIA DE BOLÍVAR', 57.5, footerY + 27.5, { align: 'center' });

  // Center: QR Code
  if (qrData) {
    doc.addImage(qrData, 'PNG', (width - 24) / 2, footerY + 2, 24, 24);
  }

  // Firma Derecha: Graciela Ledezma
  if (firmaGracielaData) {
    doc.addImage(firmaGracielaData, 'PNG', width - 80, footerY + 2, 45, 18);
  }
  doc.line(width - 85, footerY + 20, width - 30, footerY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('GRACIELA LEDEZMA', width - 57.5, footerY + 24, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('DIRECTORA DE FORMACIÓN', width - 57.5, footerY + 27.5, { align: 'center' });

  const safeFilename = (data.titularNombre || 'Certificado').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Certificado_${safeFilename}.pdf`);
}
