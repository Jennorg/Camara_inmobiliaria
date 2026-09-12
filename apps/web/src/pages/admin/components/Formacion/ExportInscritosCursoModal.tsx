import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  GripVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@/assets/Logo2.webp';
import { CursoDB } from './CursosAdminPanel';

export type ExportColumnId =
  | 'num'
  | 'nombre'
  | 'apellido_nombre'
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

export function getApellidoNombre(r: any): string {
  if (r.estudiante_apellidos && r.estudiante_nombres) {
    return `${r.estudiante_apellidos.trim()}, ${r.estudiante_nombres.trim()}`;
  }
  if (r.apellidos && r.nombres) {
    return `${r.apellidos.trim()}, ${r.nombres.trim()}`;
  }
  const raw = (r.estudiante_nombre || r.nombre || '').trim();
  if (!raw) return 'S/N';
  if (raw.includes(',')) return raw;

  const parts = raw.split(/\s+/);
  if (parts.length === 2) {
    return `${parts[1]}, ${parts[0]}`;
  }
  if (parts.length === 3) {
    return `${parts.slice(1).join(' ')}, ${parts[0]}`;
  }
  if (parts.length >= 4) {
    return `${parts.slice(2).join(' ')}, ${parts.slice(0, 2).join(' ')}`;
  }
  return raw;
}

export const INSCRITOS_EXPORT_COLUMNS: InscritosExportColumn[] = [
  { id: 'num', label: 'Número (#)', description: 'Índice o posición correlativa en el reporte', defaultSelected: true },
  { id: 'nombre', label: 'Nombre del Participante', description: 'Nombre completo (Nombre y Apellido)', defaultSelected: true },
  { id: 'apellido_nombre', label: 'Apellido, Nombre (Primero Apellido)', description: 'Formato de apellido primero (Ej: Pérez, Juan)', defaultSelected: false },
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

interface DraggableColumnItemProps {
  col: InscritosExportColumn;
  index: number;
  isSelected: boolean;
  orderNumber: number | null;
  onToggle: (id: ExportColumnId) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function DraggableColumnItem({
  col,
  index,
  isSelected,
  orderNumber,
  onToggle,
  onReorder,
}: DraggableColumnItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    const unbindDraggable = draggable({
      element: el,
      dragHandle: handleRef.current || undefined,
      getInitialData: () => ({ index, id: col.id }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });

    const unbindDropTarget = dropTargetForElements({
      element: el,
      getData: () => ({ index, id: col.id }),
      onDragEnter: ({ source }) => {
        if (source.data.index !== index) setIsOver(true);
      },
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false);
        const fromIdx = source.data.index as number;
        if (fromIdx !== undefined && fromIdx !== index) {
          onReorder(fromIdx, index);
        }
      },
    });

    return () => {
      unbindDraggable();
      unbindDropTarget();
    };
  }, [index, col.id, onReorder]);

  return (
    <div
      ref={itemRef}
      onClick={() => onToggle(col.id)}
      className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 group relative select-none ${isDragging
        ? 'opacity-40 scale-[0.98] border-dashed border-[#00D084] ring-2 ring-[#00D084]/40 bg-white'
        : isOver
          ? 'border-2 border-[#00D084] scale-[1.01] shadow-lg bg-[#E9FAF4] ring-2 ring-[#00D084]/30 z-10'
          : isSelected
            ? 'bg-[#E9FAF4]/60 border-[#00D084]/40 hover:border-[#00D084] shadow-2xs'
            : 'bg-white border-gray-200 hover:bg-slate-50/70 hover:border-gray-300'
        }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Drag Handle */}
        <div
          ref={handleRef}
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl cursor-grab active:cursor-grabbing transition-colors shrink-0"
          title="Arrastra para reordenar columna"
        >
          <GripVertical size={16} />
        </div>

        {/* Checkbox */}
        <div
          className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-[#00D084] text-white' : 'border border-gray-300 bg-white group-hover:border-gray-400'
            }`}
        >
          {isSelected && <Check size={13} strokeWidth={3} />}
        </div>

        {/* Info Columna */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-800 leading-tight">
              {col.label}
            </h4>
            {isSelected && orderNumber !== null ? (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#00D084]/15 text-[#00B870] border border-[#00D084]/30 shrink-0">
                Col #{orderNumber}
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 shrink-0">
                Omitida
              </span>
            )}
          </div>
          <p className="text-[10px] font-medium text-slate-400 leading-tight mt-0.5">
            {col.description}
          </p>
        </div>
      </div>
    </div>
  );
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
  const [sortBy, setSortBy] = useState<
    'nombre' | 'apellido_nombre' | 'cedula' | 'fecha' | 'estatus' | 'email'
  >('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Columnas State
  const [columnsOrder, setColumnsOrder] = useState<ExportColumnId[]>(() =>
    INSCRITOS_EXPORT_COLUMNS.map(c => c.id)
  );
  const [selectedColumns, setSelectedColumns] = useState<ExportColumnId[]>(DEFAULT_INSCRITOS_COLUMNS);
  const [exporting, setExporting] = useState(false);

  const handleReorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setColumnsOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const selectedOrderedList = useMemo(() => {
    return columnsOrder.filter(id => selectedColumns.includes(id));
  }, [columnsOrder, selectedColumns]);

  const colMap = useMemo(() => {
    const map = new Map<ExportColumnId, InscritosExportColumn>();
    INSCRITOS_EXPORT_COLUMNS.forEach(col => map.set(col.id, col));
    return map;
  }, []);

  // Cambiar de Modo (General vs Lista de Asistencia)
  const handleModeChange = (mode: 'general' | 'asistencia') => {
    setExportMode(mode);
    if (mode === 'asistencia') {
      setCantFirmas(1);
      setSelectedColumns(ASISTENCIA_INSCRITOS_COLUMNS);
      setColumnsOrder([
        ...ASISTENCIA_INSCRITOS_COLUMNS,
        ...INSCRITOS_EXPORT_COLUMNS.map(c => c.id).filter(id => !ASISTENCIA_INSCRITOS_COLUMNS.includes(id))
      ]);
      setOrientation('landscape');
    } else {
      setSelectedColumns(DEFAULT_INSCRITOS_COLUMNS);
      setColumnsOrder(INSCRITOS_EXPORT_COLUMNS.map(c => c.id));
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
      let valA = '';
      let valB = '';

      switch (sortBy) {
        case 'apellido_nombre':
          valA = getApellidoNombre(a).toLowerCase();
          valB = getApellidoNombre(b).toLowerCase();
          break;
        case 'cedula': {
          const numA = parseInt((a.estudiante_cedula || '').replace(/\D/g, ''), 10) || 0;
          const numB = parseInt((b.estudiante_cedula || '').replace(/\D/g, ''), 10) || 0;
          if (numA !== numB) {
            return sortDirection === 'asc' ? numA - numB : numB - numA;
          }
          valA = (a.estudiante_cedula || '').toLowerCase();
          valB = (b.estudiante_cedula || '').toLowerCase();
          break;
        }
        case 'fecha': {
          const dateA = a.creado_en ? new Date(a.creado_en).getTime() : 0;
          const dateB = b.creado_en ? new Date(b.creado_en).getTime() : 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }
        case 'estatus':
          valA = (a.estatus || '').toLowerCase();
          valB = (b.estatus || '').toLowerCase();
          break;
        case 'email':
          valA = (a.estudiante_email || '').toLowerCase();
          valB = (b.estudiante_email || '').toLowerCase();
          break;
        case 'nombre':
        default:
          valA = (a.estudiante_nombre || '').toLowerCase();
          valB = (b.estudiante_nombre || '').toLowerCase();
          break;
      }

      const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [rows, estatusFilter, searchQuery, searchField, fechaDesde, fechaHasta, sortBy, sortDirection]);

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
    setSortBy('nombre');
    setSortDirection('asc');
    setSelectedColumns(DEFAULT_INSCRITOS_COLUMNS);
    setColumnsOrder(INSCRITOS_EXPORT_COLUMNS.map(c => c.id));
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

      // Obtener las columnas seleccionadas en el orden personalizado por el usuario
      const orderedSelected = columnsOrder.filter(id => selectedColumns.includes(id));
      const baseColumns = orderedSelected.filter(c => !c.startsWith('firma'));
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
        if (cId === 'apellido_nombre') return 'Apellidos y Nombres';
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
          else if (cId === 'apellido_nombre') rowData.push(getApellidoNombre(r));
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
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${exportMode === 'general'
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
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${exportMode === 'asistencia'
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
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'filtros'
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
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'columnas'
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
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${estatusFilter === st
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

              {/* Organización y Orden de Filas */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    <ArrowUpDown size={14} className="text-[#00B870]" />
                    <span>Organizar Registros (Orden de la Lista)</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {sortDirection === 'asc' ? 'Orden Ascendente (A → Z)' : 'Orden Descendente (Z → A)'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Ordenar por Columna / Criterio
                    </label>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="w-full bg-white text-xs font-bold text-slate-700 px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00D084] focus:ring-2 focus:ring-[#00D084]/20 transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="nombre">Nombre (Nombre y Apellido)</option>
                      <option value="apellido_nombre">Apellido, Nombre (Primero Apellido)</option>
                      <option value="cedula">Cédula / Identificación</option>
                      <option value="fecha">Fecha de Registro</option>
                      <option value="estatus">Estatus de Inscripción</option>
                      <option value="email">Correo Electrónico</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Dirección del Orden
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSortDirection('asc')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap ${sortDirection === 'asc'
                          ? 'bg-[#E9FAF4] text-[#00B870] border-[#00D084]/40 shadow-2xs font-black'
                          : 'bg-white text-slate-600 border-gray-200 hover:bg-slate-50'
                          }`}
                        title="Ascendente (A-Z, Menor a Mayor, Más antiguo primero)"
                      >
                        <ArrowUp size={14} className="shrink-0" />
                        <span className="whitespace-nowrap">Ascendente (A-Z)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortDirection('desc')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap ${sortDirection === 'desc'
                          ? 'bg-[#E9FAF4] text-[#00B870] border-[#00D084]/40 shadow-2xs font-black'
                          : 'bg-white text-slate-600 border-gray-200 hover:bg-slate-50'
                          }`}
                        title="Descendente (Z-A, Mayor a Menor, Más reciente primero)"
                      >
                        <ArrowDown size={14} className="shrink-0" />
                        <span className="whitespace-nowrap">Descendente (Z-A)</span>
                      </button>
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
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${orientation === o.id
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                    Columnas del Reporte PDF
                  </span>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Arrastra con el ícono <span className="inline-flex items-center text-slate-700 font-bold">⠿</span> para cambiar el orden de las columnas en el PDF.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setColumnsOrder(INSCRITOS_EXPORT_COLUMNS.map(c => c.id))}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Restablecer el orden original de las columnas"
                  >
                    Restablecer orden
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={toggleSelectAllColumns}
                    className="text-xs font-bold text-[#00B870] hover:underline cursor-pointer"
                  >
                    {selectedColumns.length === INSCRITOS_EXPORT_COLUMNS.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {columnsOrder.map((colId, index) => {
                  const col = colMap.get(colId);
                  if (!col) return null;
                  const isSelected = selectedColumns.includes(col.id);
                  const orderIdx = selectedOrderedList.indexOf(col.id);
                  const orderNumber = orderIdx !== -1 ? orderIdx + 1 : null;

                  return (
                    <DraggableColumnItem
                      key={col.id}
                      col={col}
                      index={index}
                      isSelected={isSelected}
                      orderNumber={orderNumber}
                      onToggle={toggleColumn}
                      onReorder={handleReorderColumns}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal con Resumen de Registros */}
        <div className="bg-slate-50 p-4 px-6 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              title="Restablecer filtros"
            >
              <RotateCcw size={14} />
              <span>Restablecer</span>
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1 shrink-0" />
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
              <span><span className="text-[#00B870] font-black">{filteredRows.length}</span> / {rows.length} seleccionados</span>
            </span>
            <span className="hidden sm:inline-flex items-center text-[10px] text-slate-500 font-medium px-2 py-0.5 bg-slate-200/60 rounded-lg truncate" title={`Orden: ${sortBy === 'apellido_nombre' ? 'Apellido' : sortBy === 'nombre' ? 'Nombre' : sortBy === 'cedula' ? 'Cédula' : sortBy === 'fecha' ? 'Fecha' : sortBy === 'estatus' ? 'Estatus' : 'Correo'} (${sortDirection === 'asc' ? 'A-Z' : 'Z-A'})`}>
              {sortBy === 'apellido_nombre' ? 'Apellido' : sortBy === 'nombre' ? 'Nombre' : sortBy === 'cedula' ? 'Cédula' : sortBy === 'fecha' ? 'Fecha' : sortBy === 'estatus' ? 'Estatus' : 'Correo'} ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})
            </span>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || filteredRows.length === 0 || selectedColumns.length === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00D084] hover:bg-[#00B870] text-white text-xs font-bold shadow-md shadow-[#00D084]/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
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
