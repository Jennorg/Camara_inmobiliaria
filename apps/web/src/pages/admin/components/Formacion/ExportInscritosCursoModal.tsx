import React, { useState, useMemo } from 'react';
import {
  X,
  FileDown,
  Filter,
  Columns,
  RotateCcw,
  Search,
  Calendar,
  Loader2,
  Check,
  FileText,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@/assets/Logo2.webp';
import { CursoDB } from './CursosAdminPanel';

export type ExportColumnId =
  | 'num'
  | 'nombre'
  | 'cedula'
  | 'email'
  | 'telefono'
  | 'fecha'
  | 'estatus'
  | 'observaciones';

export interface InscritosExportColumn {
  id: ExportColumnId;
  label: string;
  description: string;
  defaultSelected: boolean;
}

export const INSCRITOS_EXPORT_COLUMNS: InscritosExportColumn[] = [
  { id: 'num', label: 'Número (#)', description: 'Índice o posición correlativa en el reporte', defaultSelected: true },
  { id: 'nombre', label: 'Nombre del Participante', description: 'Nombre completo del estudiante o afiliado', defaultSelected: true },
  { id: 'cedula', label: 'Cédula', description: 'Documento de identidad registrado', defaultSelected: true },
  { id: 'email', label: 'Correo Electrónico', description: 'Email de contacto del participante', defaultSelected: true },
  { id: 'telefono', label: 'Teléfono', description: 'Número telefónico de contacto', defaultSelected: true },
  { id: 'fecha', label: 'Fecha de Registro', description: 'Fecha en que se inscribió o preinscribió', defaultSelected: true },
  { id: 'estatus', label: 'Estatus del Alumno', description: 'Preinscrito, Admitido, Graduado o Revocado', defaultSelected: true },
  { id: 'observaciones', label: 'Asistencia / Observaciones', description: 'Casilla o anotación para control de asistencia presencial', defaultSelected: false },
];

export const DEFAULT_INSCRITOS_COLUMNS: ExportColumnId[] = INSCRITOS_EXPORT_COLUMNS
  .filter(c => c.defaultSelected)
  .map(c => c.id);

export const ASISTENCIA_INSCRITOS_COLUMNS: ExportColumnId[] = ['num', 'nombre', 'cedula', 'telefono', 'observaciones'];

function loadLogoDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2d no disponible'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${src.slice(0, 60)}`));
    img.src = src;
  });
}

export interface ExportInscritosCursoModalProps {
  open: boolean;
  onClose: () => void;
  curso: CursoDB;
  rows: any[];
}

export default function ExportInscritosCursoModal({
  open,
  onClose,
  curso,
  rows,
}: ExportInscritosCursoModalProps) {
  const [activeTab, setActiveTab] = useState<'filtros' | 'columnas'>('filtros');
  const [exportMode, setExportMode] = useState<'general' | 'asistencia'>('general');
  const [cantFirmas, setCantFirmas] = useState<number>(1);

  // Filtros State
  const [estatusFilter, setEstatusFilter] = useState<'Todos' | 'Preinscrito' | 'Inscrito' | 'Completado' | 'Rechazado'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'nombre' | 'cedula' | 'email' | 'telefono'>('nombre');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [orientation, setOrientation] = useState<'auto' | 'landscape' | 'portrait'>('auto');

  // Columnas State
  const [selectedColumns, setSelectedColumns] = useState<ExportColumnId[]>(DEFAULT_INSCRITOS_COLUMNS);
  const [exporting, setExporting] = useState(false);

  // Cambiar de Modo (General vs Lista de Asistencia)
  const handleModeChange = (mode: 'general' | 'asistencia') => {
    setExportMode(mode);
    if (mode === 'asistencia') {
      setCantFirmas(1);
      setSelectedColumns(ASISTENCIA_INSCRITOS_COLUMNS);
      setOrientation('landscape');
    } else {
      setSelectedColumns(DEFAULT_INSCRITOS_COLUMNS);
      setOrientation('auto');
    }
  };

  // Filtrado de rows en tiempo real
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      // 1. Filtro por Estatus
      if (estatusFilter !== 'Todos') {
        if (estatusFilter === 'Completado') {
          if (r.completado !== 1) return false;
        } else if (estatusFilter === 'Preinscrito') {
          if (r.estatus !== 'Preinscrito' || r.completado === 1) return false;
        } else if (estatusFilter === 'Inscrito') {
          if (r.estatus !== 'Inscrito' || r.completado === 1) return false;
        } else if (estatusFilter === 'Rechazado') {
          if (r.estatus !== 'Rechazado' && r.estatus !== 'Revocado') return false;
        }
      }

      // 2. Búsqueda por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nombre = (r.estudiante_nombre || '').toLowerCase();
        const cedula = (r.estudiante_cedula || '').toLowerCase();
        const email = (r.estudiante_email || '').toLowerCase();
        const telefono = (r.estudiante_telefono || '').toLowerCase();

        if (searchField === 'nombre' && !nombre.includes(q)) return false;
        if (searchField === 'cedula' && !cedula.includes(q)) return false;
        if (searchField === 'email' && !email.includes(q)) return false;
        if (searchField === 'telefono' && !telefono.includes(q)) return false;
      }

      // 3. Rango de Fechas
      if (fechaDesde && r.creado_en) {
        const itemDate = new Date(r.creado_en).toISOString().slice(0, 10);
        if (itemDate < fechaDesde) return false;
      }
      if (fechaHasta && r.creado_en) {
        const itemDate = new Date(r.creado_en).toISOString().slice(0, 10);
        if (itemDate > fechaHasta) return false;
      }

      return true;
    }).sort((a, b) => {
      const nameA = (a.estudiante_nombre || '').toLowerCase();
      const nameB = (b.estudiante_nombre || '').toLowerCase();
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }, [rows, estatusFilter, searchQuery, searchField, fechaDesde, fechaHasta]);

  const visibleSelectedCount = useMemo(() => {
    return selectedColumns.filter(c => INSCRITOS_EXPORT_COLUMNS.some(col => col.id === c)).length;
  }, [selectedColumns]);

  const toggleColumn = (id: ExportColumnId) => {
    setSelectedColumns(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Mantener al menos 1
        return prev.filter(c => c !== id);
      }
      return [...prev, id];
    });
  };

  const toggleSelectAllColumns = () => {
    if (visibleSelectedCount === INSCRITOS_EXPORT_COLUMNS.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(INSCRITOS_EXPORT_COLUMNS.map(c => c.id));
    }
  };

  const resetFilters = () => {
    setExportMode('general');
    setCantFirmas(1);
    setEstatusFilter('Todos');
    setSearchQuery('');
    setSearchField('nombre');
    setFechaDesde('');
    setFechaHasta('');
    setOrientation('auto');
    setSelectedColumns(DEFAULT_INSCRITOS_COLUMNS);
  };

  const handleExport = async () => {
    if (filteredRows.length === 0) {
      toast.error('No hay participantes que coincidan con los filtros aplicados.');
      return;
    }
    if (selectedColumns.length === 0) {
      toast.error('Selecciona al menos una columna para incluir en el PDF.');
      return;
    }

    setExporting(true);
    try {
      let logoBase64: string | null = null;
      try {
        logoBase64 = await loadLogoDataUrl(String(logoUrl));
      } catch {
        logoBase64 = null;
      }

      const nombreCurso = curso.titulo || curso.nombre || 'Programa de Formación';
      
      // Limpiar cualquier columna de firma previa y construir exactamente las columnas solicitadas
      const baseColumns = selectedColumns.filter(c => !c.startsWith('firma'));
      let finalColumns: string[] = [...baseColumns];
      
      if (exportMode === 'asistencia' && cantFirmas > 0) {
        const firmaIds: string[] = [];
        for (let i = 1; i <= cantFirmas; i++) {
          firmaIds.push(cantFirmas === 1 ? 'firma' : `firma_${i}`);
        }
        const obsIdx = finalColumns.indexOf('observaciones');
        if (obsIdx !== -1) {
          finalColumns = [
            ...finalColumns.slice(0, obsIdx),
            ...firmaIds,
            ...finalColumns.slice(obsIdx)
          ];
        } else {
          finalColumns = [...finalColumns, ...firmaIds];
        }
      }

      const isLandscape = orientation === 'auto' ? finalColumns.length > 5 || exportMode === 'asistencia' : orientation === 'landscape';
      const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;

      const docTitle = exportMode === 'asistencia'
        ? `Lista de Asistencia Presencial: ${nombreCurso}`
        : `Reporte de Inscritos: ${nombreCurso}`;

      const dateStr = new Date().toLocaleString('es-VE', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, y, 26, 26);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(docTitle, margin + 32, y + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Cámara Inmobiliaria del Estado Bolívar · Control Formativo', margin + 32, y + 14);

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generado: ${dateStr} · Registros: ${filteredRows.length} de ${rows.length}`, margin + 32, y + 20);
        y += 30;
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(docTitle, margin, y + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Cámara Inmobiliaria del Estado Bolívar · Generado: ${dateStr} · Registros: ${filteredRows.length} de ${rows.length}`, margin, y + 12);
        y += 18;
      }

      // Configuración de Cabeceras
      const getColLabel = (cId: string): string => {
        if (cId === 'num') return '#';
        if (cId === 'nombre') return 'Participante';
        if (cId === 'cedula') return 'Cédula';
        if (cId === 'email') return 'Correo Electrónico';
        if (cId === 'telefono') return 'Teléfono';
        if (cId === 'fecha') return 'Fecha Registro';
        if (cId === 'estatus') return 'Estatus';
        if (cId === 'observaciones') return 'Asistencia / Observaciones';
        if (cId === 'firma') return 'Firma';
        if (cId.startsWith('firma_')) {
          const num = cId.split('_')[1];
          return `Firma ${num}`;
        }
        return cId;
      };

      const head = [finalColumns.map(cId => getColLabel(cId))];

      const body = filteredRows.map((r, idx) => {
        const rowData: string[] = [];
        finalColumns.forEach(cId => {
          if (cId === 'num') rowData.push(String(idx + 1));
          else if (cId === 'nombre') rowData.push(r.estudiante_nombre || 'S/N');
          else if (cId === 'cedula') rowData.push(r.estudiante_cedula || 'S/N');
          else if (cId === 'email') rowData.push(r.estudiante_email || 'Sin correo');
          else if (cId === 'telefono') rowData.push(r.estudiante_telefono || 'Sin teléfono');
          else if (cId === 'fecha') rowData.push(r.creado_en ? new Date(r.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'S/F');
          else if (cId === 'estatus') {
            const st = r.completado === 1 ? 'Graduado' : r.estatus === 'Preinscrito' ? 'Pendiente' : r.estatus === 'Inscrito' ? 'Admitido' : (r.estatus || 'Registrado');
            rowData.push(st);
          } else if (cId.startsWith('firma')) {
            rowData.push('');
          } else if (cId === 'observaciones') {
            rowData.push('');
          }
        });
        return rowData;
      });

      const HEADER_COLOR: [number, number, number] = [0, 184, 112];
      const ALT_ROW: [number, number, number] = [248, 250, 252];

      autoTable(doc, {
        startY: y,
        head,
        body,
        margin: { left: margin, right: margin },
        styles: {
          font: 'helvetica',
          fontSize: exportMode === 'asistencia' ? (finalColumns.length > 7 ? 7.5 : 8.5) : (finalColumns.length > 5 ? 7.5 : 8.5),
          cellPadding: exportMode === 'asistencia' ? 4 : 2.5,
          minCellHeight: exportMode === 'asistencia' ? 11 : 0,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: HEADER_COLOR,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
        },
        alternateRowStyles: {
          fillColor: ALT_ROW,
        },
      });

      // Firmas de verificación al final de la lista de asistencia
      const finalY = (doc as any).lastAutoTable?.finalY || y;
      const pageHeight = doc.internal.pageSize.getHeight();

      if (exportMode === 'asistencia') {
        let sigY = finalY + 20;
        if (sigY + 25 > pageHeight - margin) {
          doc.addPage();
          sigY = 35;
        }
        const col1X = margin + 25;
        const col2X = pageWidth - margin - 75;

        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.4);
        doc.line(col1X, sigY, col1X + 55, sigY);
        doc.line(col2X, sigY, col2X + 55, sigY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text('Firma del Instructor / Facilitador', col1X + 27.5, sigY + 5, { align: 'center' });
        doc.text('Control Cámara Inmobiliaria', col2X + 27.5, sigY + 5, { align: 'center' });
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${i} de ${totalPages} · Total: ${filteredRows.length} participantes`,
          pageWidth / 2,
          pageH - 8,
          { align: 'center' }
        );
      }

      const prefix = exportMode === 'asistencia' ? 'lista-asistencia' : 'reporte-inscritos';
      const filename = `${prefix}-${nombreCurso.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      toast.success(exportMode === 'asistencia' ? 'Lista de asistencias PDF exportada' : 'Reporte PDF exportado exitosamente');
      onClose();
    } catch (err: any) {
      console.error('Error generando PDF:', err);
      toast.error(err.message || 'No se pudo generar el archivo PDF.');
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="transition-opacity fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 fade-in duration-200">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl flex flex-col bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh]">
        {/* Header Modal */}
        <div className="bg-white px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E9FAF4] text-[#00B870] flex items-center justify-center border border-[#00D084]/20 shrink-0">
                <FileDown size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight leading-none mb-1">
                  Exportar Reporte PDF
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  {curso.titulo || curso.nombre}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-gray-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Selector de Modo Presets */}
          <div className="flex items-center gap-2 mt-4 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleModeChange('general')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                exportMode === 'general'
                  ? 'bg-white text-slate-800 shadow-sm border border-gray-200/60 font-black'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText size={15} className={exportMode === 'general' ? 'text-[#00B870]' : ''} />
              <span>Reporte General</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('asistencia')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                exportMode === 'asistencia'
                  ? 'bg-[#E9FAF4] text-[#00B870] shadow-sm border border-[#00D084]/30 font-black'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserCheck size={15} className={exportMode === 'asistencia' ? 'text-[#00B870]' : ''} />
              <span>Modo Lista de Asistencias</span>
            </button>
          </div>

          {/* Navegación Tabs */}
          <div className="flex items-center gap-2 mt-3 p-1 bg-slate-100/60 rounded-2xl border border-gray-200/50">
            <button
              type="button"
              onClick={() => setActiveTab('filtros')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'filtros'
                  ? 'bg-white text-[#00B870] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Filter size={14} />
              <span>Filtros y Criterios</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('columnas')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'columnas'
                  ? 'bg-white text-[#00B870] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Columns size={14} />
              <span>Columnas ({visibleSelectedCount}/{INSCRITOS_EXPORT_COLUMNS.length})</span>
            </button>
          </div>
        </div>

        {/* Cuerpo Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'filtros' ? (
            <div className="space-y-5">
              {/* Input Numérico: Cantidad de Columnas de Firmas (Solo en Modo Asistencia) */}
              {exportMode === 'asistencia' && (
                <div className="bg-[#E9FAF4]/60 border border-[#00D084]/30 rounded-2xl p-4 space-y-2">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest">
                    Número de Columnas para Firmas
                  </label>
                  <div className="relative flex items-center max-w-xs">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={cantFirmas}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setCantFirmas(Math.max(1, Math.min(10, val)));
                        } else {
                          setCantFirmas(1);
                        }
                      }}
                      className="w-full pl-4 pr-24 py-2.5 bg-white text-xs font-bold text-slate-800 border border-gray-200 rounded-xl focus:outline-none focus:border-[#00D084] focus:ring-2 focus:ring-[#00D084]/20 transition-all shadow-xs"
                    />
                    <span className="absolute right-3.5 text-xs font-bold text-[#00B870] pointer-events-none">
                      {cantFirmas === 1 ? 'columna' : 'columnas'}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-500 leading-normal">
                    Indica cuántas columnas vacías para firma física deseas incluir en la lista (se agregan de forma automática).
                  </p>
                </div>
              )}

              {/* Filtro por Estatus */}
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Estatus de Inscripción
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['Todos', 'Preinscrito', 'Inscrito', 'Completado', 'Rechazado'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEstatusFilter(st)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        estatusFilter === st
                          ? 'bg-[#E9FAF4] text-[#00B870] border-[#00D084]/40 shadow-xs'
                          : 'bg-white text-slate-600 border-gray-200 hover:bg-slate-50'
                      }`}
                    >
                      {st === 'Todos' ? 'Todos' :
                       st === 'Preinscrito' ? 'Pendientes' :
                       st === 'Inscrito' ? 'Admitidos' :
                       st === 'Completado' ? 'Graduados' : 'Revocados'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Búsqueda por Texto con Selector */}
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Búsqueda Específica
                </label>
                <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden focus-within:ring-2 focus-within:ring-[#00D084]/20 focus-within:border-[#00D084] transition-all">
                  <select
                    value={searchField}
                    onChange={e => setSearchField(e.target.value as any)}
                    className="bg-slate-50 text-xs font-bold text-slate-700 px-3 py-2.5 border-r border-gray-200 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <option value="nombre">Nombre</option>
                    <option value="cedula">Cédula</option>
                    <option value="email">Correo</option>
                    <option value="telefono">Teléfono</option>
                  </select>
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={`Buscar por ${searchField}...`}
                      className="w-full pl-9 pr-8 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Rango de Fechas */}
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Rango de Fecha de Registro
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Desde</span>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={e => setFechaDesde(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white text-xs font-semibold text-slate-700 border border-gray-200 rounded-xl focus:outline-none focus:border-[#00D084]"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Hasta</span>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={e => setFechaHasta(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white text-xs font-semibold text-slate-700 border border-gray-200 rounded-xl focus:outline-none focus:border-[#00D084]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Orientación de Página */}
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Orientación del Documento PDF
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'auto', label: 'Automática' },
                    { id: 'landscape', label: 'Horizontal' },
                    { id: 'portrait', label: 'Vertical' }
                  ].map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOrientation(o.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        orientation === o.id
                          ? 'bg-[#E9FAF4] text-[#00B870] border-[#00D084]/40'
                          : 'bg-white text-slate-600 border-gray-200 hover:bg-slate-50'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Seleccione las columnas a incluir
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAllColumns}
                    className="text-xs font-bold text-[#00B870] hover:underline cursor-pointer"
                  >
                    {selectedColumns.length === INSCRITOS_EXPORT_COLUMNS.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {INSCRITOS_EXPORT_COLUMNS.map(col => {
                  const isSelected = selectedColumns.includes(col.id);
                  return (
                    <div
                      key={col.id}
                      onClick={() => toggleColumn(col.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#E9FAF4]/60 border-[#00D084]/40 shadow-2xs'
                          : 'bg-white border-gray-200 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSelected ? 'bg-[#00D084] text-white' : 'border border-gray-300 bg-white'
                      }`}>
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">{col.label}</h4>
                        <p className="text-[10px] font-medium text-slate-400 leading-tight mt-0.5">{col.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal con Resumen de Registros */}
        <div className="bg-slate-50 p-4 px-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Restablecer filtros"
            >
              <RotateCcw size={14} />
              <span>Restablecer</span>
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <span className="text-xs font-bold text-slate-700">
              <span className="text-[#00B870] font-black">{filteredRows.length}</span> / {rows.length} registros seleccionados
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || filteredRows.length === 0 || selectedColumns.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00D084] hover:bg-[#00B870] text-white text-xs font-bold shadow-md shadow-[#00D084]/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>{exportMode === 'asistencia' ? 'Generar Lista Asistencia PDF' : 'Generar Reporte PDF'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
