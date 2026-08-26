import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard, formatRif, getInitials } from '@/utils/formatters'
import { EstatusAfiliado, AfiliadoDTO } from '@/types/afiliados'
import { uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared'
import { apiFetch } from '@/lib/apiClient'

import {
  UserPlus, Search, Filter, RefreshCw, Trash2, Edit3, Save, X,
  ChevronRight, Building2, User as UserIcon, Users, CheckCircle2, AlertCircle,
  Mail, Phone, MapPin, BadgeCheck, FileText, Calendar, CreditCard,
  ShieldAlert, ArrowUpDown, ChevronDown, ImageIcon, Upload, Loader2,
  Briefcase, StickyNote, Globe, FileDown, Download, Music2, Facebook, Instagram, Linkedin,
  ExternalLink, GraduationCap, Award
} from 'lucide-react'
import ExportAfiliadosModal from '@/pages/admin/components/Afiliados/export/ExportAfiliadosModal'
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/utils/cropImage'
import CarnetAfiliadoModal from '@/components/CarnetAfiliadoModal'
import { CarnetCardPreview } from '@/components/CarnetCardPreview'
import type { ExportTipoFilter } from '@/pages/admin/components/Afiliados/export/filterAfiliadosForExport'
import Swal from 'sweetalert2'
import FileUpload from '@/components/common/FileUpload'
import { toast } from 'sonner'
import { toPng } from 'html-to-image'
import LogoBgImg from '@/assets/Logo4.webp'
import JSZip from 'jszip'
import QRCode from 'qrcode'


const CarnetIcon = ({ w = 16, h = 16 }: { w?: number; h?: number }) => {
  const combined_d = "M3 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3zm0 2h18v12H3V6zm3 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 1a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5z";
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" fill="currentColor" d={combined_d} />
    </svg>
  );
};


const ID_PREFIXES = ['V', 'E', 'J', 'G', 'P']

const cleanString = (str: string | null | undefined): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const formatIdentificacionSeparada = (item: AfiliadoDTO): string => {
  if (item.tipo_afiliado === 'Corporativo' && item.empresa_rif_numero) {
    const tipo = (item.empresa_rif_tipo || 'J').toUpperCase();
    let num = item.empresa_rif_numero.replace(/[\s.-]/g, '');
    if (num.toUpperCase().startsWith(tipo)) {
      num = num.substring(tipo.length);
    }

    if (num.length >= 2) {
      const checkDigit = num.substring(num.length - 1);
      const mainNumber = num.substring(0, num.length - 1);
      const formattedMain = mainNumber.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return `RIF: ${tipo}-${formattedMain}-${checkDigit}`;
    } else {
      const formattedMain = num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return `RIF: ${tipo}-${formattedMain}`;
    }
  } else {
    const ced = item.cedula || '';
    if (!ced) return '';
    const clean = ced.replace(/[\s.-]/g, '');
    const hasPrefix = /^[a-zA-Z]/.test(clean);
    const prefix = hasPrefix ? clean[0].toUpperCase() : 'V';
    const numbers = hasPrefix ? clean.substring(1) : clean;
    const formattedNumbers = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `Cédula: ${prefix}-${formattedNumbers}`;
  }
};

const formatCedulaOrRifParts = (item: AfiliadoDTO): { prefix: string; number: string } => {
  if (item.tipo_afiliado === 'Corporativo' && item.empresa_rif_numero) {
    const prefix = (item.empresa_rif_tipo || 'J').toUpperCase();
    let num = item.empresa_rif_numero.replace(/[\s.-]/g, '');
    if (num.toUpperCase().startsWith(prefix)) {
      num = num.substring(prefix.length);
    }
    if (num.length >= 2) {
      const checkDigit = num.substring(num.length - 1);
      const mainNumber = num.substring(0, num.length - 1);
      const formattedMain = mainNumber.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return { prefix, number: `${formattedMain}-${checkDigit}` };
    }
    const formattedMain = num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return { prefix, number: formattedMain || num };
  } else {
    const ced = item.cedula || '';
    if (!ced) return { prefix: 'V', number: 'Sin cédula' };
    const clean = ced.replace(/[\s.-]/g, '');
    const hasPrefix = /^[a-zA-Z]/.test(clean);
    const prefix = hasPrefix ? clean[0].toUpperCase() : 'V';
    const numbers = hasPrefix ? clean.substring(1) : clean;
    const formattedNumbers = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return { prefix, number: formattedNumbers || ced };
  }
};

const formatPhoneParts = (rawPhone: string | null | undefined): { countryCode: string; number: string; hasPhone: boolean } => {
  if (!rawPhone) return { countryCode: '+58', number: '', hasPhone: false };
  let clean = rawPhone.trim();
  if (!clean || ['sin telefono', 'sin teléfono', 'n/a', 'ninguno', 'none'].includes(clean.toLowerCase())) {
    return { countryCode: '+58', number: '', hasPhone: false };
  }

  const knownCodes = ['+58', '+507', '+503', '+502', '+504', '+505', '+506', '+593', '+591', '+595', '+598', '+57', '+54', '+55', '+56', '+52', '+51', '+34', '+1'];

  let countryCode = '+58';
  let number = clean;

  if (clean.startsWith('+')) {
    const matchedKnown = knownCodes.find(code => clean.startsWith(code));
    if (matchedKnown) {
      countryCode = matchedKnown;
      number = clean.slice(matchedKnown.length).trim().replace(/^[\s.-]+/, '');
    } else {
      const match = clean.match(/^(\+\d{1,3})[\s.-]+(.*)$/);
      if (match) {
        countryCode = match[1];
        number = match[2].trim();
      }
    }
  }

  if (!number) {
    return { countryCode, number: '', hasPhone: false };
  }

  return {
    countryCode,
    number,
    hasPhone: true
  };
};

const BookUserIcon = ({ className, size = 14 }: { className?: string, size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-book-user shrink-0 ${className}`}
  >
    <path d="M15 13a3 3 0 1 0-6 0" />
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    <circle cx="12" cy="8" r="2" />
  </svg>
);

const DefaultAvatarSVG = () => (
  <svg
    viewBox="0 0 200 240"
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    className="w-full h-full object-cover"
    style={{ display: "block", maxWidth: "200px" }}
  >
    <defs>
      {/* Degradado de fondo sutil */}
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>

      {/* Degradado para la chaqueta (volumen) */}
      <linearGradient id="jacketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>

      {/* Degradado para la corbata */}
      <linearGradient id="tieGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>

      {/* Sombra exterior del círculo */}
      <filter id="bgShadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx={0} dy={3} stdDeviation={6} floodColor="#0f172a" floodOpacity={0.08} />
      </filter>

      {/* Sombra suave detrás de la figura */}
      <filter id="figureShadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx={0} dy={4} stdDeviation={8} floodColor="#0f172a" floodOpacity={0.15} />
      </filter>
    </defs>

    {/* Fondo circular con sombra */}
    <circle
      cx="100"
      cy="120"
      r="110"
      fill="url(#bgGrad)"
      filter="url(#bgShadow)"
      stroke="#ffffff"
      strokeWidth="2"
    />

    {/* Figura completa con sombra */}
    <g filter="url(#figureShadow)">
      {/* Cabeza (silueta) */}
      <ellipse cx="100" cy="72" rx="28" ry="30" fill="#1e293b" />

      {/* Chaqueta / cuerpo */}
      <path
        d="M 68 95 Q 80 90, 100 88 Q 120 90, 132 95 C 142 110, 138 160, 118 180 L 112 232 L 88 232 L 82 180 C 62 160, 58 110, 68 95 Z"
        fill="url(#jacketGrad)"
      />

      {/* Camisa (cuello con puntas) */}
      <path
        d="M 100 88 L 80 98 L 90 105 L 100 100 L 110 105 L 120 98 Z"
        fill="#f8fafc"
      />

      {/* Corbata */}
      <rect x={97} y={95} width={6} height={75} rx={1} fill="url(#tieGrad)" />

      {/* Nudo de la corbata */}
      <polygon points="95,95 105,95 102,102 98,102" fill="url(#tieGrad)" />

      {/* Botones de la chaqueta */}
      <circle cx={100} cy={115} r={2} fill="#475569" />
      <circle cx={100} cy={135} r={2} fill="#475569" />
      <circle cx={100} cy={155} r={2} fill="#475569" />

      {/* Bolsillo izquierdo */}
      <rect x={72} y={115} width={14} height={10} rx={1} fill="none" stroke="#475569" strokeWidth={1} />

      {/* Cordón de la credencial */}
      <path
        d="M 100 100 Q 115 100 125 160"
        stroke="#94a3b8"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Credencial */}
      <rect x={120} y={160} width={22} height={16} rx={2} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} />
      {/* Foto en la credencial */}
      <rect x={124} y={162} width={6} height={5} fill="#475569" rx={0.5} />
      {/* Líneas de texto en la credencial */}
      <line x1="133" y1="164" x2="140" y2="164" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" />
      <line x1="133" y1="168" x2="138" y2="168" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" />
      <line x1="133" y1="172" x2="136" y2="172" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  </svg>
);

function DocLink({ label, url, detail, compact = false }: { label: string, url?: string | null, detail?: string | null, compact?: boolean }) {
  if (!url) return (
    <div className={`flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/30 ${compact ? 'py-2' : ''}`}>
      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] text-slate-300 italic font-medium">No cargado</span>
    </div>
  )

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-sm transition-colors group ${compact ? 'py-2' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
          <FileText size={16} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</span>
          <span className="text-[10px] font-bold text-slate-600 truncate">{detail ? `Por: ${detail}` : 'Ver documento'}</span>
        </div>
      </div>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors">
        <ExternalLink size={14} />
      </div>
    </a>
  );
}



export default function MiembrosPanel() {
  const { token, isAdmin, isSuperAdmin } = useAuth()
  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token])

  const [items, setItems] = useState<AfiliadoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchField, setSearchField] = useState<'nombre' | 'id' | 'codigo' | 'email'>('nombre')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 150)
    return () => clearTimeout(timer)
  }, [search])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [showTipoDropdown, setShowTipoDropdown] = useState(false)
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'Natural' | 'Corporativo' | 'Agente Corporativo'>('Todos')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [filterFoto, setFilterFoto] = useState<'todos' | 'con_foto' | 'sin_foto'>('todos')
  const [sortState, setSortState] = useState<'nombre_asc' | 'nombre_desc' | 'codigo_asc' | 'codigo_desc'>('codigo_asc')

  const [selected, setSelected] = useState<AfiliadoDTO | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<AfiliadoDTO>>({})
  const [companies, setCompanies] = useState<AfiliadoDTO[]>([])
  type ImageEditKind = 'logo' | 'foto'
  const [imageModal, setImageModal] = useState({
    kind: null as ImageEditKind | null,
    preview: null as string | null,
    file: null as File | null,
    uploading: false,
    error: '',
    dragOver: false,
  })

  const imageEditKind = imageModal.kind
  const imagePreview = imageModal.preview
  const imageFile = imageModal.file
  const imageUploading = imageModal.uploading
  const imageError = imageModal.error
  const imageDragOver = imageModal.dragOver

  const setImageEditKind = (kind: ImageEditKind | null) => setImageModal(m => ({ ...m, kind }))
  const setImagePreview = (preview: string | null) => setImageModal(m => ({ ...m, preview }))
  const setImageFile = (file: File | null) => setImageModal(m => ({ ...m, file }))
  const setImageUploading = (uploading: boolean) => setImageModal(m => ({ ...m, uploading }))
  const setImageError = (error: string) => setImageModal(m => ({ ...m, error }))
  const setImageDragOver = (dragOver: boolean) => setImageModal(m => ({ ...m, dragOver }))

  const imageFileInputRef = useRef<HTMLInputElement>(null)

  // Estados para el recorte de imagen
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [cropAspectChoice, setCropAspectChoice] = useState<number>(4 / 5)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showCarnetModal, setShowCarnetModal] = useState(false)

  // Documentos para nuevo miembro manual
  const [newDocs, setNewDocs] = useState({
    urlCv: '',
    nameCv: '',
    urlTitulo: '',
    nameTitulo: '',
    urlRegistro: '',
    nameRegistro: '',
    urlTituloRep: '',
    nameTituloRep: '',
  })

  const newUrlCv = newDocs.urlCv
  const newNameCv = newDocs.nameCv
  const newUrlTitulo = newDocs.urlTitulo
  const newNameTitulo = newDocs.nameTitulo
  const newUrlRegistro = newDocs.urlRegistro
  const newNameRegistro = newDocs.nameRegistro
  const newUrlTituloRep = newDocs.urlTituloRep
  const newNameTituloRep = newDocs.nameTituloRep

  const setNewUrlCv = (urlCv: string) => setNewDocs(d => ({ ...d, urlCv }))
  const setNewNameCv = (nameCv: string) => setNewDocs(d => ({ ...d, nameCv }))
  const setNewUrlTitulo = (urlTitulo: string) => setNewDocs(d => ({ ...d, urlTitulo }))
  const setNewNameTitulo = (nameTitulo: string) => setNewDocs(d => ({ ...d, nameTitulo }))
  const setNewUrlRegistro = (urlRegistro: string) => setNewDocs(d => ({ ...d, urlRegistro }))
  const setNewNameRegistro = (nameRegistro: string) => setNewDocs(d => ({ ...d, nameRegistro }))
  const setNewUrlTituloRep = (urlTituloRep: string) => setNewDocs(d => ({ ...d, urlTituloRep }))
  const setNewNameTituloRep = (nameTituloRep: string) => setNewDocs(d => ({ ...d, nameTituloRep }))

  // Cambio directo por administrador
  const [showChangeTypeModal, setShowChangeTypeModal] = useState(false)
  const [showChangeTypeMenu, setShowChangeTypeMenu] = useState(false)
  const [pendingNewType, setPendingNewType] = useState<'Natural' | 'Corporativo' | 'Agente Corporativo' | ''>('')
  const [affiliateToDelete, setAffiliateToDelete] = useState<number | null>(null)
  const [naturalTransitionTarget, setNaturalTransitionTarget] = useState<any | null>(null)
  const [empresas, setEmpresas] = useState<any[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCurrent, setBatchCurrent] = useState(0);
  const [currentMember, setCurrentMember] = useState<any>(null);
  const [currentMemberQrUrl, setCurrentMemberQrUrl] = useState('');
  const bulkCardRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  const handleBatchDownload = async () => {
    if (batchDownloading) return;
    setBatchDownloading(true);
    setIsCanceling(false);
    setBatchTotal(0);
    setBatchCurrent(0);
    cancelRef.current = false;

    try {
      const res = await fetch(`${API_URL}/api/public/afiliados/buscar?con_foto=true&limit=1000`);
      if (!res.ok) {
        throw new Error(`Error en la solicitud (${res.status})`);
      }
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error('No se pudo obtener el listado de afiliados.');
      }

      const activeMembers = json.data;
      if (activeMembers.length === 0) {
        toast.error('No se encontraron afiliados activos con fotografía.');
        setBatchDownloading(false);
        return;
      }

      setBatchTotal(activeMembers.length);

      const zip = new JSZip();
      let generatedCount = 0;

      const preloadImg = (url?: string | null) => {
        if (!url) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        });
      };

      // Procesamiento de a 1 por 1 (chunkSize = 1)
      for (let i = 0; i < activeMembers.length; i++) {
        if (cancelRef.current) {
          break;
        }

        const member = activeMembers[i];
        setBatchCurrent(i + 1);
        setCurrentMember(member);

        const mCode = (member.codigo && String(member.codigo).trim() !== '') ? String(member.codigo).trim() : null;
        const pUrl = mCode ? `${window.location.origin}/miembros/${mCode}` : `${window.location.origin}/miembros/${member.id_afiliado}?by=id`;

        const rawRedes = member?.redes_sociales;
        const redes = rawRedes
          ? (typeof rawRedes === 'string' ? (() => { try { return JSON.parse(rawRedes); } catch { return {}; } })() : rawRedes)
          : {};
        const useJuntaPhoto = Boolean(redes?.use_junta_photo);
        const carnetPhotoUrl = useJuntaPhoto
          ? (redes?.foto_junta_carnet_url || member.foto_junta_url)
          : redes?.foto_carnet_url;
        const activePhoto = carnetPhotoUrl || ((useJuntaPhoto && member.foto_junta_url) ? member.foto_junta_url : member.foto_url);

        const [qrUrl] = await Promise.all([
          QRCode.toDataURL(pUrl, {
            margin: 1,
            width: 240,
            color: { dark: '#000000', light: '#00000000' },
            errorCorrectionLevel: 'H'
          }),
          preloadImg(activePhoto),
          preloadImg(member.empresa_logo_url)
        ]);

        setCurrentMemberQrUrl(qrUrl);

        // Breve espera para actualización de estado del DOM (60ms)
        await new Promise((resolve) => setTimeout(resolve, 60));

        if (bulkCardRef.current) {
          try {
            const dataUrl = await toPng(bulkCardRef.current, {
              quality: 0.98,
              pixelRatio: 2,
              backgroundColor: '#ffffff',
              style: {
                transform: 'none',
                borderRadius: '0px',
              }
            });

            const base64Data = dataUrl.split(',')[1];
            const filename = `carnet-${member.codigo || member.id_afiliado}.png`;
            zip.file(filename, base64Data, { base64: true });
            generatedCount++;
          } catch (cardErr) {
            console.error(`Error procesando carnet de ${member.codigo}:`, cardErr);
          }
        }
      }

      if (generatedCount > 0) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `carnets-ciebo-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error('No se pudo generar ninguna credencial.');
      }
    } catch (err: any) {
      console.error('Error en descarga masiva:', err);
      toast.error(err.message || 'Ocurrió un error en la descarga masiva.');
    } finally {
      setBatchDownloading(false);
      setIsCanceling(false);
      setCurrentMember(null);
      setCurrentMemberQrUrl('');
      cancelRef.current = false;
    }
  };
  const [razonSocial, setRazonSocial] = useState('')
  const [rifTipo, setRifTipo] = useState('J')
  const [rifNumero, setRifNumero] = useState('')
  const [emailEmpresa, setEmailEmpresa] = useState('')
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('')
  const [direccionEmpresa, setDireccionEmpresa] = useState('')
  const [websiteEmpresa, setWebsiteEmpresa] = useState('')
  const [urlRegistro, setUrlRegistro] = useState('')
  const [urlRif, setUrlRif] = useState('')
  const [nombreRegistro, setNombreRegistro] = useState('')
  const [nombreRif, setNombreRif] = useState('')
  const [submittingChangeType, setSubmittingChangeType] = useState(false)

  const fetchEmpresas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/empresas`)
      if (!res.ok) return
      const json = await res.json()
      if (json.success) setEmpresas(json.data)
    } catch (err) { console.error(err) }
  }

  const handleDropdownTypeChange = (newType: string) => {
    if (!selected) return
    if (newType === selected.tipo_afiliado) return

    setPendingNewType(newType as any)
    if (newType === 'Natural') {
      confirmNaturalTransition()
    } else {
      fetchEmpresas()
      setShowChangeTypeModal(true)
    }
  }

  const confirmNaturalTransition = async () => {
    if (!selected) return
    setNaturalTransitionTarget(selected)
  }

  const executeDirectTypeChange = async (type: string, additionalData: any = {}) => {
    if (!selected) return
    setSubmittingChangeType(true)
    try {
      const res = await fetch(`${API_URL}/api/afiliados/admin/${selected.id_afiliado}/cambiar-membresia`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo_destino: type,
          ...additionalData
        })
      })
      if (!res.ok) throw new Error('Error al cambiar membresía')
      const json = await res.json()
      if (json.success) {
        toast.success(json.message || 'Membresía actualizada con éxito.')
        setShowChangeTypeModal(false)
        setIsEditing(false)
        // Reset states
        setSelectedEmpresaId('')
        setRazonSocial('')
        setRifNumero('')
        setEmailEmpresa('')
        setTelefonoEmpresa('')
        setDireccionEmpresa('')
        setWebsiteEmpresa('')
        setUrlRegistro('')
        setUrlRif('')
        setNombreRegistro('')
        setNombreRif('')

        // Reload details and list
        const resDetail = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (!resDetail.ok) throw new Error('Error al cargar detalle')
        const jsonDetail = await resDetail.json()
        if (jsonDetail.success) {
          setSelected(jsonDetail.data)
        }
        await load()
      } else {
        toast.error(json.message || 'No se pudo realizar el cambio.')
      }
    } catch (err) {
      toast.error('Error de conexión: No se pudo establecer comunicación con el servidor.')
    } finally {
      setSubmittingChangeType(false)
    }
  }

  const busyTransitionRef = useRef(false)
  const handleConfirmNaturalTransition = async () => {
    if (busyTransitionRef.current) return
    busyTransitionRef.current = true
    try {
      setNaturalTransitionTarget(null)
      await executeDirectTypeChange('Natural')
    } finally {
      busyTransitionRef.current = false
    }
  }
  const [newForm, setNewForm] = useState<Partial<AfiliadoDTO>>({
    tipo_afiliado: 'Natural',
    estatus: 'Afiliado'
  })

  async function fetchMiembrosData(authHeaders: Record<string, string>, signal?: AbortSignal) {
    const json = await apiFetch(`${API_URL}/api/afiliados`, { headers: authHeaders, signal })
    if (!json.success) throw new Error('Error de conexión')
    const approved = json.data.filter((a: AfiliadoDTO) =>
      ['Afiliado', 'Moroso', 'Suspendido', 'Rechazado'].includes(a.estatus)
    )
    const companies = approved.filter((a: AfiliadoDTO) => a.tipo_afiliado === 'Corporativo')
    return { approved, companies }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { approved, companies } = await fetchMiembrosData(authHeaders)
      setItems(approved)
      setCompanies(companies)
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    fetchMiembrosData(authHeaders, controller.signal)
      .then(({ approved, companies }) => {
        if (!controller.signal.aborted) {
          setItems(approved)
          setCompanies(companies)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Error de conexión')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [authHeaders])

  const handleSelect = async (item: AfiliadoDTO) => {
    setSelected(item)
    setIsEditing(false)
    setEditForm(item)
    setImageEditKind(null)
    setImagePreview(null)
    setImageFile(null)
    setImageError('')

    try {
      const res = await fetch(`${API_URL}/api/afiliados/${item.id_afiliado}`, { headers: authHeaders })
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const json = await res.json()
      if (json.success && json.data) {
        setSelected(prev => prev && prev.id_afiliado === item.id_afiliado ? { ...prev, ...json.data, documentos: json.data.documentos || [] } : prev)
        setEditForm(prev => prev && prev.id_afiliado === item.id_afiliado ? { ...prev, ...json.data, documentos: json.data.documentos || [] } : prev)
      } else {
        setSelected(prev => prev && prev.id_afiliado === item.id_afiliado ? { ...prev, documentos: [] } : prev)
        setEditForm(prev => prev && prev.id_afiliado === item.id_afiliado ? { ...prev, documentos: [] } : prev)
      }
    } catch (err) {
      console.error('Error al cargar documentos del afiliado:', err)
      setSelected(prev => prev && prev.id_afiliado === item.id_afiliado ? { ...prev, documentos: [] } : prev)
      setEditForm(prev => prev && prev.id_afiliado === item.id_afiliado ? { ...prev, documentos: [] } : prev)
    }
  }

  const openImageEditor = (kind: ImageEditKind) => {
    if (!selected) return
    setImageEditKind(kind)
    setImageError('')
    setImageFile(null)
    setCrop(kind === 'foto' ? { x: 0, y: -350 } : { x: 0, y: 0 })
    setZoom(kind === 'foto' ? 1.1 : 1)
    setCropAspectChoice(kind === 'foto' ? 4 / 5 : 1)
    setImagePreview(
      kind === 'logo'
        ? selected.empresa_logo_url || null
        : selected.foto_url || null
    )
  }

  const closeImageEditor = () => {
    setImageEditKind(null)
    setImageFile(null)
    setImagePreview(null)
    setImageError('')
    setCroppedAreaPixels(null)
  }

  const handleImageFileChange = (file: File) => {
    setImageFile(file)
    setImageError('')
    setCrop(imageEditKind === 'foto' ? { x: 0, y: -300 } : { x: 0, y: 0 })
    setZoom(imageEditKind === 'foto' ? 1.1 : 1)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const busySaveImageRef = useRef(false)
  const handleSaveImage = async () => {
    if (!selected || !imageEditKind || busySaveImageRef.current) return
    busySaveImageRef.current = true
    setImageUploading(true)
    setImageError('')
    try {
      const isLogo = imageEditKind === 'logo'
      let finalUrl = imagePreview || (isLogo ? selected.empresa_logo_url : selected.foto_url) || ''

      if (imageFile && imagePreview && croppedAreaPixels) {
        // Recortar la imagen antes de subirla
        const croppedImageBlob = await getCroppedImg(
          imagePreview,
          croppedAreaPixels,
          0,
          { horizontal: false, vertical: false },
          imageFile.type
        )
        if (croppedImageBlob) {
          const webpName = imageFile.name.replace(/\.[^/.]+$/, '') + '.webp'
          const croppedFile = new File([croppedImageBlob], webpName, { type: 'image/webp' })
          finalUrl = await uploadFileSupabase(
            croppedFile,
            isLogo
              ? (selected.tipo_afiliado === 'Corporativo' ? 'logos/empresas' : 'logos/marcas')
              : 'fotos/afiliados',
            true
          )
        }
      } else if (imageFile) {
        finalUrl = await uploadFileSupabase(
          imageFile,
          isLogo
            ? (selected.tipo_afiliado === 'Corporativo' ? 'logos/empresas' : 'logos/marcas')
            : 'fotos/afiliados'
        )
      }

      let payload: any = isLogo ? { empresa_logo_url: finalUrl } : { foto_url: finalUrl };
      if (!isLogo) {
        const rawRedes = selected.redes_sociales;
        const currentRedes = rawRedes
          ? (typeof rawRedes === 'string' ? (() => { try { return JSON.parse(rawRedes); } catch { return {}; } })() : rawRedes)
          : {};
        const updatedRedes = {
          ...currentRedes,
          foto_original_url: finalUrl,
          foto_carnet_url: null,
          carnet_crop: null
        };
        payload.redes_sociales = updatedRedes;
      }

      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const updated = isLogo
          ? { ...selected, empresa_logo_url: finalUrl }
          : { ...selected, foto_url: finalUrl, redes_sociales: payload.redes_sociales }
        setSelected(updated)
        setItems(items.map(item => item.id_afiliado === selected.id_afiliado ? updated : item))
        closeImageEditor()
      } else {
        setImageError('Error al guardar en el servidor')
      }
    } catch (err: any) {
      console.error('handleSaveImage error:', err)
      setImageError(err?.message || 'Error al subir la imagen')
    } finally {
      setImageUploading(false)
      busySaveImageRef.current = false
    }
  }

  const busyDeleteImageRef = useRef(false)
  const handleDeleteImage = async () => {
    if (!selected || !imageEditKind || busyDeleteImageRef.current) return
    busyDeleteImageRef.current = true
    try {
      const isLogo = imageEditKind === 'logo'
      if (!confirm(`¿Estás seguro de eliminar el ${isLogo ? 'logo' : 'foto'} actual?`)) return

      setImageUploading(true)
      setImageError('')
      const payload = isLogo ? { empresa_logo_url: null } : { foto_url: null }
      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const updated = isLogo
          ? { ...selected, empresa_logo_url: null }
          : { ...selected, foto_url: null }
        setSelected(updated)
        setItems(items.map(item => item.id_afiliado === selected.id_afiliado ? updated : item))
        closeImageEditor()
      } else {
        setImageError('Error al eliminar en el servidor')
      }
    } catch (err: any) {
      console.error('handleDeleteImage error:', err)
      setImageError(err?.message || 'Error al eliminar la imagen')
    } finally {
      setImageUploading(false)
      busyDeleteImageRef.current = false
    }
  }

  const updateField = async (field: keyof AfiliadoDTO, value: any) => {
    if (!selected) return
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      if (res.ok) {
        await handleSelect(selected)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const associatedMembers = useMemo(() => {
    if (!selected || selected.tipo_afiliado !== 'Corporativo' || !selected.id_empresa) return []
    return items.filter(item => item.id_empresa === selected.id_empresa && item.id_afiliado !== selected.id_afiliado)
  }, [items, selected])

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const nombre = cleanString(item.nombre_completo)
      const razonSocial = cleanString(item.empresa_razon_social)
      const cedula = cleanString(item.cedula)
      const rif = cleanString(item.empresa_rif_numero)
      const s = cleanString(debouncedSearch)

      let matchSearch = true
      if (s.trim()) {
        const terms = s.trim().split(/\s+/)
        if (searchField === 'id') {
          matchSearch = terms.every(term => cedula.includes(term) || rif.includes(term))
        } else if (searchField === 'codigo') {
          matchSearch = terms.every(term => cleanString(item.codigo).includes(term))
        } else if (searchField === 'email') {
          const emailPersona = cleanString(item.email || (item as any).persona_email || '')
          const emailEmpresa = cleanString(item.empresa_email || '')
          matchSearch = terms.every(term => emailPersona.includes(term) || emailEmpresa.includes(term))
        } else { // nombre (inclusivo)
          const repNombre = cleanString(item.representante_nombre || (item.nombres && item.apellidos ? `${item.nombres} ${item.apellidos}` : ''))
          const emailPersona = cleanString(item.email || (item as any).persona_email || '')
          const emailEmpresa = cleanString(item.empresa_email || '')
          matchSearch = terms.every(term =>
            nombre.includes(term) ||
            razonSocial.includes(term) ||
            repNombre.includes(term) ||
            cleanString(item.nombres).includes(term) ||
            cleanString(item.apellidos).includes(term) ||
            emailPersona.includes(term) ||
            emailEmpresa.includes(term)
          )
        }
      }

      let matchTipo = filterTipo === 'Todos' || item.tipo_afiliado === filterTipo
      if (filterTipo === 'Agente Corporativo') {
        matchTipo = item.tipo_afiliado === 'Agente' || item.tipo_afiliado === 'Agente Corporativo'
      }

      let matchFoto = true
      if (filterFoto === 'con_foto') {
        matchFoto = Boolean(item.foto_url || item.empresa_logo_url)
      } else if (filterFoto === 'sin_foto') {
        matchFoto = !item.foto_url && !item.empresa_logo_url
      }

      return matchSearch && matchTipo && matchFoto
    })

    result.sort((a, b) => {
      if (sortState.startsWith('codigo')) {
        const codA = parseInt(a.codigo || '0', 10) || 0;
        const codB = parseInt(b.codigo || '0', 10) || 0;
        return sortState === 'codigo_asc' ? codA - codB : codB - codA;
      } else {
        const nomA = (a.tipo_afiliado === 'Corporativo' && a.empresa_razon_social ? a.empresa_razon_social : a.nombre_completo || '').toLowerCase();
        const nomB = (b.tipo_afiliado === 'Corporativo' && b.empresa_razon_social ? b.empresa_razon_social : b.nombre_completo || '').toLowerCase();
        if (nomA < nomB) return sortState === 'nombre_asc' ? -1 : 1;
        if (nomA > nomB) return sortState === 'nombre_asc' ? 1 : -1;
        return 0;
      }
    });

    return result;
  }, [items, debouncedSearch, filterTipo, filterFoto, sortState, searchField])

  const handleEdit = (item: AfiliadoDTO) => {
    handleSelect(item)
    setIsEditing(true)
  }

  const savingMemberRef = useRef(false)
  const handleSave = async () => {
    if (!selected || savingMemberRef.current) return
    savingMemberRef.current = true
    try {
      // Filtrar campos de solo lectura y auxiliares para la actualización
      const { nombre_completo, acceso_email, creado_en, actualizado_en, ...payload } = editForm as any;

      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      let json: any = null
      try {
        json = await res.json()
      } catch (e) {
        console.error('Error parseando JSON en handleSave:', e)
      }
      if (res.ok && json?.success) {
        setIsEditing(false)
        await load()
        if (json.data) {
          setSelected(json.data)
        }
        toast.success(json.message || 'Afiliado actualizado con éxito')
      } else {
        toast.error(json?.message || `Error (${res.status}): No se pudo actualizar`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error de red o conexión al guardar')
    } finally {
      savingMemberRef.current = false
    }
  }

  const deletingMemberRef = useRef(false)
  const confirmDelete = async (id: number) => {
    if (deletingMemberRef.current) return
    deletingMemberRef.current = true
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      let json: any = null
      try {
        json = await res.json()
      } catch (e) {
        console.error('Error parseando JSON en confirmDelete:', e)
      }
      if (res.ok) {
        setSelected(null)
        load()
        toast.success('Afiliado eliminado con éxito')
      } else {
        toast.error(json?.message || `Error (${res.status}): No se pudo eliminar el afiliado`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error de red o conexión al eliminar')
    } finally {
      setAffiliateToDelete(null)
      deletingMemberRef.current = false
    }
  }

  const handleDelete = (id: number) => {
    setAffiliateToDelete(id)
  }

  const newTipo = newForm.tipo_afiliado || 'Natural'
  const isNewCorporativo = newTipo === 'Corporativo'

  const openNewMemberModal = () => {
    setNewForm({ tipo_afiliado: 'Natural', estatus: 'Afiliado' })
    setNewUrlCv('')
    setNewNameCv('')
    setNewUrlTitulo('')
    setNewNameTitulo('')
    setNewUrlRegistro('')
    setNewNameRegistro('')
    setNewUrlTituloRep('')
    setNewNameTituloRep('')
    setShowNewModal(true)
  }

  const handleNewTipoChange = (tipo: 'Natural' | 'Corporativo' | 'Agente Corporativo') => {
    setNewForm((prev) => ({
      ...prev,
      tipo_afiliado: tipo,
      ...(tipo === 'Corporativo'
        ? { id_empresa: null }
        : { empresa_razon_social: undefined, empresa_rif_tipo: undefined, empresa_rif_numero: undefined, empresa_email: undefined, empresa_telefono: undefined, empresa_website: undefined }),
      ...(tipo !== 'Agente Corporativo' ? { id_empresa: null } : {})
    }))
  }

  const [createError, setCreateError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})
  const creatingRef = useRef(false)

  const handleCreate = async () => {
    if (creatingRef.current) return
    creatingRef.current = true
    setCreateError(null)
    setFormErrors({})
    const errors: Record<string, boolean> = {}

    try {
      const tipoFinal = newTipo;

      // Basic validation
      if (!newForm.nombres?.trim()) errors.nombres = true
      if (!newForm.apellidos?.trim()) errors.apellidos = true
      if (!newForm.email?.trim()) errors.email = true
      if (!newForm.cedula?.trim()) errors.cedula = true

      if (tipoFinal === 'Agente Corporativo' && !newForm.id_empresa) {
        errors.id_empresa = true
      }

      if (tipoFinal === 'Corporativo') {
        if (!newForm.empresa_razon_social?.trim()) errors.empresa_razon_social = true
        if (!newForm.empresa_rif_numero?.trim()) errors.empresa_rif_numero = true

        // Validar documentos obligatorios de Corporativo
        if (!newUrlCv) errors.newUrlCv = true
        if (!newUrlTitulo) errors.newUrlTitulo = true // RIF de la Empresa
        if (!newUrlRegistro) errors.newUrlRegistro = true
        if (!newUrlTituloRep) errors.newUrlTituloRep = true
      } else {
        // Natural / Agente / Agente Corporativo
        if (!newForm.nivel_academico) errors.nivel_academico = true
        if (!newUrlCv) errors.newUrlCv = true
        if (newForm.nivel_academico && newForm.nivel_academico !== 'Bachiller' && !newUrlTitulo) {
          errors.newUrlTitulo = true
        }
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors)
        setCreateError('Por favor, complete todos los campos obligatorios marcados en rojo.')
        return
      }

      // Preparar listado de documentos
      const documentosToUpload: Array<{ tipo_doc: string; url: string; nombre_archivo: string }> = []
      if (tipoFinal === 'Corporativo') {
        if (newUrlCv) documentosToUpload.push({ tipo_doc: 'cv', url: newUrlCv, nombre_archivo: newNameCv || 'CV_Representante.pdf' })
        if (newUrlTitulo) documentosToUpload.push({ tipo_doc: 'rif_empresa', url: newUrlTitulo, nombre_archivo: newNameTitulo || 'RIF_Empresa.pdf' })
        if (newUrlRegistro) documentosToUpload.push({ tipo_doc: 'registro_mercantil', url: newUrlRegistro, nombre_archivo: newNameRegistro || 'Registro_Mercantil.pdf' })
        if (newUrlTituloRep) documentosToUpload.push({ tipo_doc: 'titulo_representante', url: newUrlTituloRep, nombre_archivo: newNameTituloRep || 'Titulo_Representante.pdf' })
      } else {
        if (newUrlCv) documentosToUpload.push({ tipo_doc: 'cv', url: newUrlCv, nombre_archivo: newNameCv || 'CV.pdf' })
        if (newUrlTitulo && newForm.nivel_academico !== 'Bachiller') {
          documentosToUpload.push({ tipo_doc: 'titulo', url: newUrlTitulo, nombre_archivo: newNameTitulo || 'Titulo.pdf' })
        }
      }

      const rifEmpresa = newForm.empresa_rif_numero?.trim();
      const payload = {
        ...newForm,
        tipo_afiliado: tipoFinal,
        id_empresa: tipoFinal === 'Agente Corporativo' ? newForm.id_empresa : null,
        cedula: tipoFinal === 'Corporativo' && rifEmpresa
          ? rifEmpresa
          : (newForm.cedula || ''),
        email: tipoFinal === 'Corporativo'
          ? (newForm.empresa_email || newForm.email)
          : newForm.email,
        telefono: tipoFinal === 'Corporativo'
          ? (newForm.empresa_telefono || newForm.telefono)
          : newForm.telefono,
        documentos: documentosToUpload
      }

      const res = await fetch(`${API_URL}/api/afiliados`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      let json: any = null
      try {
        json = await res.json()
      } catch (e) {
        console.error('Error parseando JSON en handleCreate:', e)
      }
      if (res.ok && json?.success) {
        setShowNewModal(false)
        setNewForm({ tipo_afiliado: 'Natural', estatus: 'Afiliado' })
        setNewUrlCv('')
        setNewNameCv('')
        setNewUrlTitulo('')
        setNewNameTitulo('')
        setNewUrlRegistro('')
        setNewNameRegistro('')
        setNewUrlTituloRep('')
        setNewNameTituloRep('')
        setFormErrors({})
        load()
      } else {
        setCreateError(json?.message || `Error (${res.status}): No se pudo crear`)
      }
    } catch (err) {
      console.error(err)
      setCreateError('Error de conexión al servidor.')
    } finally {
      creatingRef.current = false
    }
  }

  const ACADEMIC_OPTIONS = [
    { value: 'Bachiller', label: 'Bachiller' },
    { value: 'TSU', label: 'TSU' },
    { value: 'Nivel Profesional', label: 'Nivel Profesional' },
    { value: 'Postgrado', label: 'Postgrado' },
  ];

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">
      {/* Sidebar de Lista */}
      <div className={`w-full sm:w-80 border-r border-gray-100 flex flex-col min-h-0 overflow-hidden shrink-0 ${selected ? 'hidden sm:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">Directorio</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleBatchDownload}
                disabled={batchDownloading}
                title="Descargar todos los Carnets (Activos con Foto)"
                className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                {batchDownloading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                title="Exportar listado en PDF"
                className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <FileDown size={18} />
              </button>
              <button
                onClick={openNewMemberModal}
                className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20"
              >
                <UserPlus size={18} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1 flex items-center bg-slate-50 border border-gray-100 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-colors h-8 z-20">
              {/* Dropdown de criterio */}
              <div className="relative shrink-0 border-r border-gray-200/80 h-full flex items-center z-10">
                <button
                  type="button"
                  onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                  className="flex items-center gap-0.5 px-2 h-full text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <span>
                    {searchField === 'nombre' && 'Nombre'}
                    {searchField === 'id' && 'ID / RIF'}
                    {searchField === 'codigo' && 'Código'}
                    {searchField === 'email' && 'Correo'}
                  </span>
                  <ChevronDown size={10} className={`text-slate-400 transition-transform ${showSearchDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showSearchDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowSearchDropdown(false)} />
                    <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[130px] fade-in slide-in-from-top-1 duration-100">
                      {([
                        { key: 'nombre', label: 'Nombre' },
                        { key: 'id', label: 'Cédula / RIF' },
                        { key: 'codigo', label: 'Código' },
                        { key: 'email', label: 'Correo' },
                      ] as const).map(option => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => {
                            setSearchField(option.key);
                            setShowSearchDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${searchField === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="relative flex-grow h-full flex items-center">
                <Search className="absolute left-2 text-slate-400" size={12} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Buscar por ${searchField === 'nombre' ? 'nombre / rep / correo' :
                    searchField === 'id' ? 'cédula o RIF' :
                    searchField === 'codigo' ? 'código' : 'correo electrónico'
                    }...`}
                  className="w-full h-full pl-6 pr-8 bg-transparent text-xs font-semibold placeholder-slate-400 outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setSortState(prev => {
                  if (prev === 'nombre_asc') return 'nombre_desc';
                  if (prev === 'nombre_desc') return 'codigo_asc';
                  if (prev === 'codigo_asc') return 'codigo_desc';
                  return 'nombre_asc';
                });
              }}
              className="px-3 bg-slate-50 border border-gray-100 rounded-xl text-slate-600 flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors shrink-0"
              title="Cambiar criterio de ordenación"
            >
              <ArrowUpDown size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {sortState === 'nombre_asc' && 'A-Z'}
                {sortState === 'nombre_desc' && 'Z-A'}
                {sortState === 'codigo_asc' && 'CÓD. ↑'}
                {sortState === 'codigo_desc' && 'CÓD. ↓'}
              </span>
            </button>
          </div>

          <div className="relative w-full">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="w-full flex items-center justify-between gap-1.5 px-2 py-2 bg-slate-50 border border-gray-100 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                  Filtro: {filterTipo === 'Todos' ? 'Todos' : filterTipo === 'Natural' ? 'Agente Independiente' : filterTipo === 'Agente Corporativo' ? 'Agente Corporativo' : 'Corporativo'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {filterTipo === 'Todos' && <Users size={14} className="text-emerald-600 shrink-0" />}
                {filterTipo === 'Natural' && <UserIcon size={14} className="text-emerald-600 shrink-0" />}
                {filterTipo === 'Agente Corporativo' && <BookUserIcon size={14} className="text-emerald-600 shrink-0" />}
                {filterTipo === 'Corporativo' && <Building2 size={14} className="text-emerald-600 shrink-0" />}
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {showFilterDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                <div className="transition-opacity transition-transform absolute left-0 right-0 mt-1.5 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden z-50 fade-in slide-in-from-top-1 duration-200">
                  <div className="py-1">
                    {[
                      { id: 'Todos', label: 'Todos', icon: Users },
                      { id: 'Natural', label: 'Agente Independiente', icon: UserIcon },
                      { id: 'Agente Corporativo', label: 'Agente Corporativo', icon: BookUserIcon },
                      { id: 'Corporativo', label: 'Corporativo', icon: Building2 },
                    ].map((f) => {
                      const Icon = f.icon;
                      const isSelected = filterTipo === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setFilterTipo(f.id as any);
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors duration-200 flex items-center gap-2 ${isSelected ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <Icon size={14} className={isSelected ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'} />
                          <span className="truncate">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Filtro por fotografía */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={() => setFilterFoto('todos')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                filterFoto === 'todos'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilterFoto('con_foto')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                filterFoto === 'con_foto'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Con Foto
            </button>
            <button
              type="button"
              onClick={() => setFilterFoto('sin_foto')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                filterFoto === 'sin_foto'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-amber-700'
              }`}
            >
              Sin Foto
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-50">
          {loading ? (
            <div className="p-8 text-center"><RefreshCw size={24} className="animate-spin text-emerald-500 mx-auto" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No se encontraron miembros</div>
          ) : (
            filteredItems.map(item => (
              <button
                key={item.id_afiliado}
                onClick={() => handleSelect(item)}
                className={`w-full p-4 text-left hover:bg-slate-50 transition-colors group flex items-center justify-between ${selected?.id_afiliado === item.id_afiliado ? 'bg-emerald-50/50 border-l-4 border-emerald-500' : 'border-l-4 border-transparent'}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="relative group/tooltip shrink-0 flex items-center">
                      <span className="text-emerald-600 flex items-center cursor-pointer">
                        {item.tipo_afiliado === 'Corporativo' && <Building2 size={14} />}
                        {(item.tipo_afiliado === 'Agente' || item.tipo_afiliado === 'Agente Corporativo') && <BookUserIcon size={14} />}
                        {item.tipo_afiliado !== 'Corporativo' && item.tipo_afiliado !== 'Agente' && item.tipo_afiliado !== 'Agente Corporativo' && <UserIcon size={14} />}
                      </span>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/tooltip:block bg-slate-800 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-md whitespace-nowrap z-50 pointer-events-none">
                        {item.tipo_afiliado === 'Corporativo' ? 'Corporativo' : item.tipo_afiliado === 'Agente' || item.tipo_afiliado === 'Agente Corporativo' ? 'Agente Corporativo' : 'Agente Independiente'}
                      </span>
                    </div>
                    <p className="font-bold text-slate-800 text-sm truncate">
                      {item.tipo_afiliado === 'Corporativo' && item.empresa_razon_social
                        ? item.empresa_razon_social
                        : formatNombreCard(item.nombre_completo)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-1 pl-5">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatIdentificacionSeparada(item)}
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className={`text-slate-300 group-hover:translate-x-1 transition-transform ${selected?.id_afiliado === item.id_afiliado ? 'text-emerald-500' : ''}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Panel de Detalle / Edición */}
      <div className={`flex-1 overflow-y-auto min-h-0 bg-slate-50/30 p-6 sm:p-8 ${!selected ? 'hidden sm:block' : 'block'}`}>
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center">
              <BadgeCheck size={40} strokeWidth={1} />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-600">Selecciona un miembro</p>
              <p className="text-xs">Para visualizar o editar su información completa</p>
            </div>
          </div>
        ) : (
          <div className="transition-opacity transition-transform max-w-4xl mx-auto space-y-6 fade-in slide-in-from-bottom-4 duration-300">
            <button
              onClick={() => setSelected(null)}
              className="sm:hidden flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors mb-4"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Volver a la lista
            </button>
            {/* Cabecera de Detalle */}
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col gap-4 relative">
              {/* Barra de Acciones */}
              <div className="flex items-center justify-end gap-2 w-full z-10">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setShowCarnetModal(true)}
                      className="px-3 sm:px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 active:scale-95 transition-colors transition-transform flex items-center gap-2 font-bold text-xs shadow-xs border border-emerald-200/40"
                      title="Ver Carnet de Afiliado"
                    >
                      <CarnetIcon w={16} h={16} />
                      <span className="hidden sm:inline">Ver Carnet</span>
                      <span className="sm:hidden">Carnet</span>
                    </button>
                    <button
                      onClick={() => handleEdit(selected)}
                      className="p-2.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition-colors transition-transform"
                      title="Editar"
                    >
                      <Edit3 size={18} />
                    </button>
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        onClick={() => handleDelete(selected.id_afiliado)}
                        className="p-2.5 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 active:scale-95 transition-colors transition-transform"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      className="p-2.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                      title="Guardar"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="p-2.5 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-colors"
                      title="Cancelar"
                    >
                      <X size={18} />
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center justify-center text-center gap-6">
                {/* Avatar / Logo */}
                {selected.tipo_afiliado === 'Corporativo' || selected.tipo_afiliado === 'Natural' ? (
                  <div className="flex items-center justify-center gap-4 shrink-0">
                    {/* Caja de Logo */}
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <button
                          type="button"
                          className="w-24 h-24 rounded-[2rem] flex items-center justify-center overflow-hidden bg-emerald-50 border-2 border-emerald-100 shadow-inner cursor-pointer hover:border-emerald-300 transition-colors"
                          onClick={() => openImageEditor('logo')}
                          title={selected.tipo_afiliado === 'Corporativo' ? "Haz clic para cambiar el logo de la empresa" : "Haz clic para cambiar el logo comercial / personal"}
                        >
                          {selected.empresa_logo_url ? (
                            <img src={selected.empresa_logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                          ) : (
                            <Building2 size={36} className="text-emerald-900" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-emerald-50 transition-colors"
                          onClick={() => openImageEditor('logo')}
                          title={selected.tipo_afiliado === 'Corporativo' ? "Editar logo de la empresa" : "Editar logo de marca"}
                        >
                          <Edit3 size={12} className="text-slate-500" />
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mt-2">
                        {selected.tipo_afiliado === 'Corporativo' ? 'Logo Empresa' : 'Logo Personal'}
                      </p>
                    </div>

                    {/* Caja de Foto */}
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <button
                          type="button"
                          className="w-36 aspect-[4/5] rounded-t-2xl rounded-b-xl flex items-center justify-center overflow-hidden bg-slate-100 border-2 border-slate-200 shadow-inner cursor-pointer hover:border-emerald-300 transition-colors"
                          onClick={() => openImageEditor('foto')}
                          title={selected.tipo_afiliado === 'Corporativo' ? "Haz clic para cambiar la foto del representante" : "Haz clic para cambiar la foto de perfil"}
                        >
                          {selected.foto_url ? (
                            <img src={selected.foto_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-black text-emerald-700 uppercase">
                              {getInitials(selected.nombres, selected.apellidos)}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-emerald-50 transition-colors"
                          onClick={() => openImageEditor('foto')}
                          title={selected.tipo_afiliado === 'Corporativo' ? "Editar foto del representante" : "Editar foto de perfil"}
                        >
                          <Edit3 size={14} className="text-slate-500" />
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mt-2">
                        {selected.tipo_afiliado === 'Corporativo' ? 'Representante' : 'Foto Perfil'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative shrink-0 flex justify-center">
                    <div
                      className="w-36 aspect-[4/5] rounded-t-2xl rounded-b-xl flex items-center justify-center overflow-hidden bg-emerald-50 border-2 border-emerald-100 shadow-inner cursor-pointer hover:border-emerald-300 transition-colors"
                      onClick={() => openImageEditor('foto')}
                      title="Haz clic para cambiar la foto de perfil"
                    >
                      {selected.foto_url ? (
                        <img src={selected.foto_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-black text-emerald-600 uppercase tracking-tighter">
                          {getInitials(selected.nombres, selected.apellidos)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-emerald-50 transition-colors"
                      onClick={() => openImageEditor('foto')}
                      title="Editar foto de perfil"
                    >
                      <Edit3 size={14} className="text-slate-500" />
                    </button>
                  </div>
                )}


                <div className="text-center space-y-1 w-full flex flex-col items-center">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                      {/* nombre_completo es columna VIRTUAL GENERATED — se muestra, no se edita */}
                      {selected.tipo_afiliado === 'Corporativo' && selected.empresa_razon_social
                        ? (isEditing ? editForm.empresa_razon_social : selected.empresa_razon_social)
                        : (isEditing ? `${editForm.nombres || ''} ${editForm.apellidos || ''}` : formatNombreCard(selected.nombre_completo))}
                    </h2>
                    {selected.tipo_afiliado === 'Corporativo' && (
                      <p className="text-sm font-bold text-slate-500">
                        Representante: {isEditing ? `${editForm.nombres || ''} ${editForm.apellidos || ''}` : `${selected.nombres} ${selected.apellidos}`}
                      </p>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex items-center justify-center gap-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado en Directorio:</span>
                      <button
                        onClick={() => setEditForm({ ...editForm, activo: editForm.activo ? 0 : 1 })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${editForm.activo ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {editForm.activo ? <CheckCircle2 size={14} /> : <X size={14} />}
                        {editForm.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                    <DataField
                      label="Código de Afiliado"
                      value={selected.codigo || 'Sin Código'}
                      isEditing={isEditing}
                      fieldName="codigo"
                      form={editForm}
                      setForm={setEditForm}
                      className="!bg-transparent !p-0 !border-none !text-slate-400 !font-bold !text-sm !uppercase !tracking-widest text-center"
                      labelClassName="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* ── SECCIÓN PERSONAL UNIFICADA ── */}
              <div className="border-t border-gray-100 mt-8 pt-8 text-left">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-6">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-500">
                    <UserIcon size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                    {(isEditing ? editForm.tipo_afiliado : selected.tipo_afiliado) === 'Corporativo' ? 'Representante Legal' :
                      ((isEditing ? editForm.tipo_afiliado : selected.tipo_afiliado) === 'Agente' || selected.tipo_afiliado === 'Agente Corporativo') ? 'Información del Agente' :
                        'Información Personal'}
                  </h3>
                </div>

                {/* Datos en grid 3 columnas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <DataField label="Nombres" value={selected.nombres} isEditing={isEditing} fieldName="nombres" form={editForm} setForm={setEditForm} />
                  <DataField label="Apellidos" value={selected.apellidos} isEditing={isEditing} fieldName="apellidos" form={editForm} setForm={setEditForm} />
                  <DataField label="Código de Afiliado" value={selected.codigo || 'No asignado'} isEditing={isEditing} fieldName="codigo" form={editForm} setForm={setEditForm} />
                  <DataField label="Correo Electrónico" value={selected.email} isEditing={isEditing} fieldName="email" form={editForm} setForm={setEditForm} />
                  {/* Teléfono con código de país */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                    {isEditing ? (
                      (() => {
                        const parts = formatPhoneParts(editForm.telefono);
                        const countryCodeOptions = ['+58', '+1', '+34', '+57', '+54', '+55', '+56', '+52', '+51', '+507'];
                        const currentCode = countryCodeOptions.includes(parts.countryCode) ? parts.countryCode : '+58';
                        const numOnly = parts.number;
                        return (
                          <div className="flex gap-0 w-full">
                            <div className="relative shrink-0">
                              <select
                                className="w-16 bg-slate-50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-2.5 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 transition-colors appearance-none cursor-pointer text-slate-700"
                                value={currentCode}
                                onChange={(e) => {
                                  const newCode = e.target.value;
                                  setEditForm({ ...editForm, telefono: `${newCode} ${numOnly}`.trim() });
                                }}
                              >
                                {countryCodeOptions.map(code => (
                                  <option key={code} value={code}>{code}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <input
                              type="text"
                              className="flex-1 bg-slate-50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors text-slate-700"
                              value={numOnly}
                              onChange={(e) => {
                                setEditForm({ ...editForm, telefono: `${currentCode} ${e.target.value}`.trim() });
                              }}
                            />
                          </div>
                        );
                      })()
                    ) : (
                      (() => {
                        const phoneParts = formatPhoneParts(selected.telefono);
                        if (!phoneParts.hasPhone) {
                          return (
                            <p className="bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm font-bold text-slate-700 w-fit">
                              Sin teléfono
                            </p>
                          );
                        }
                        return (
                          <div className="flex gap-0 w-full">
                            <div className="bg-slate-50/50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-3 py-2 text-sm font-black text-slate-700 flex items-center justify-center min-w-[52px] shrink-0">
                              {phoneParts.countryCode}
                            </div>
                            <div className="bg-slate-50/50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-bold text-slate-700 flex-1">
                              {phoneParts.number}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                  <DataField label="Dirección" value={selected.direccion || 'Sin dirección'} isEditing={isEditing} fieldName="direccion" form={editForm} setForm={setEditForm} />
                  <DataField label="Fecha de Nacimiento" value={selected.fecha_nacimiento || 'N/A'} isEditing={isEditing} fieldName="fecha_nacimiento" form={editForm} setForm={setEditForm} type="date" />
                  <DataField label="Nivel Académico" value={selected.nivel_academico || 'No especificado'} isEditing={isEditing} fieldName="nivel_academico" form={editForm} setForm={setEditForm} type="select" options={ACADEMIC_OPTIONS} />
                  <DataField label="Profesión / Especialidad" value={selected.profesion || 'No especificada'} isEditing={isEditing} fieldName="profesion" form={editForm} setForm={setEditForm} />
                </div>

                {/* Cédula con editor de prefijo */}
                <div className="space-y-1.5 mt-6">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cédula</label>
                  {isEditing ? (
                    <div className="flex gap-0 max-w-xs">
                      <div className="relative shrink-0">
                        <select
                          className="w-16 bg-slate-50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 transition-colors appearance-none cursor-pointer"
                          value={editForm.cedula?.split('-')[0] || 'V'}
                          onChange={(e) => {
                            const parts = (editForm.cedula || '').split('-');
                            const rest = parts.slice(1).join('-');
                            setEditForm({ ...editForm, cedula: `${e.target.value}-${rest}` })
                          }}
                        >
                          {ID_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <input
                        type="text"
                        className="flex-1 bg-slate-50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
                        value={(editForm.cedula || '').split('-').slice(1).join('-')}
                        onChange={(e) => {
                          const pre = (editForm.cedula || '').split('-')[0] || 'V'
                          setEditForm({ ...editForm, cedula: `${pre}-${e.target.value}` })
                        }}
                      />
                    </div>
                  ) : (
                    (() => {
                      const idParts = formatCedulaOrRifParts({ ...selected, tipo_afiliado: 'Natural' }); // Force natural parsing for personal cedula
                      return (
                        <div className="flex gap-0 max-w-xs">
                          <div className="bg-slate-50/50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-3.5 py-2 text-sm font-black text-slate-700 flex items-center justify-center min-w-[44px] shrink-0">
                            {idParts.prefix}
                          </div>
                          <div className="bg-slate-50/50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-bold text-slate-700 flex-1">
                            {idParts.number}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Tipo de Afiliación + Vinculación empresa para Agentes */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3 mt-6">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Tipo de Afiliación</p>
                    <div className="relative max-w-[180px] w-full">
                      <select
                        className="w-full bg-slate-50 border border-gray-100 rounded-xl text-slate-600 hover:bg-slate-100 hover:border-gray-200 transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider px-3 py-2 pr-8 appearance-none outline-none focus:ring-2 focus:ring-emerald-500/10"
                        value={isEditing ? (editForm.tipo_afiliado || selected.tipo_afiliado) : selected.tipo_afiliado}
                        onChange={(e) => handleDropdownTypeChange(e.target.value)}
                      >
                        <option value="Natural">Agente Independiente</option>
                        <option value="Agente Corporativo">Agente Corporativo</option>
                        <option value="Corporativo">Corporativo</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {(isEditing ? editForm.tipo_afiliado === 'Agente Corporativo' : (selected.tipo_afiliado === 'Agente' || selected.tipo_afiliado === 'Agente Corporativo')) && (
                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Empresa Vinculada</p>
                      {isEditing ? (
                        <CompanySearchField
                          companies={companies}
                          selectedIdEmpresa={editForm.id_empresa}
                          onSelect={(id) => setEditForm({ ...editForm, id_empresa: id })}
                        />
                      ) : selected.id_empresa ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-emerald-900" />
                            <span className="text-xs font-bold text-slate-700">{selected.empresa_razon_social}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">RIF: {selected.empresa_rif_numero}</p>
                        </>
                      ) : (
                        <p className="text-xs font-bold text-slate-400 italic">No vinculado</p>
                      )}
                    </div>
                  )}

                  {/* Aprobar CIBIR (Certificación vs Acreditación) */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-2xl flex items-center justify-between gap-4 pt-3 border-t border-gray-200">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <GraduationCap size={16} className="text-emerald-600" />
                        <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">Aprobar CIBIR</span>
                      </div>
                      <p className="text-[11px] font-medium text-emerald-800/80 leading-snug">
                        {!Boolean(isEditing ? (editForm.cibir_acreditado ?? editForm.cibir_convalidado) : (selected.cibir_acreditado ?? selected.cibir_convalidado))
                          ? '✓ Aprobado en CIBIR (Genera certificado CIBIR de aprobación)'
                          : '✗ Acreditado por convalidación (Exonerado / Sin certificado CIBIR)'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!Boolean(isEditing ? (editForm.cibir_acreditado ?? editForm.cibir_convalidado) : (selected.cibir_acreditado ?? selected.cibir_convalidado))}
                        onChange={(e) => {
                          const val = e.target.checked ? 0 : 1;
                          if (isEditing) {
                            setEditForm({ ...editForm, cibir_acreditado: val });
                          } else {
                            updateField('cibir_acreditado', val);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de Datos — Secciones dinámicas por tipo de afiliado */}
            <div className="grid grid-cols-1 gap-6">

              {/* ── SECCIÓN: INFORMACIÓN DE LA EMPRESA (solo Corporativo) ── */}
              {(isEditing ? editForm.tipo_afiliado === 'Corporativo' : selected.tipo_afiliado === 'Corporativo') && (
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-emerald-100">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <Building2 size={16} />
                      </div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Información de la Empresa</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DataField label="Razón Social" value={selected.empresa_razon_social || 'Sin razón social'} isEditing={isEditing} fieldName="empresa_razon_social" form={editForm} setForm={setEditForm} />
                      {/* RIF de la Empresa */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RIF de la Empresa</label>
                        {isEditing ? (
                          <div className="flex gap-0 max-w-xs">
                            <div className="relative shrink-0">
                              <select
                                className="w-16 bg-slate-50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 transition-colors appearance-none cursor-pointer"
                                value={editForm.empresa_rif_tipo || 'J'}
                                onChange={(e) => setEditForm({ ...editForm, empresa_rif_tipo: e.target.value })}
                              >
                                {ID_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <input
                              type="text"
                              className="flex-1 bg-slate-50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
                              value={editForm.empresa_rif_numero || ''}
                              onChange={(e) => setEditForm({ ...editForm, empresa_rif_numero: e.target.value })}
                            />
                          </div>
                        ) : (
                          (() => {
                            const rifParts = formatCedulaOrRifParts({ ...selected, tipo_afiliado: 'Corporativo' });
                            return (
                              <div className="flex gap-0 max-w-xs">
                                <div className="bg-slate-50/50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-3.5 py-2 text-sm font-black text-slate-700 flex items-center justify-center min-w-[44px] shrink-0">
                                  {rifParts.prefix}
                                </div>
                                <div className="bg-slate-50/50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-bold text-slate-700 flex-1">
                                  {rifParts.number || 'Sin RIF'}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                      <DataField label="Correo de la Empresa" value={selected.empresa_email || 'Sin correo'} isEditing={isEditing} fieldName="empresa_email" form={editForm} setForm={setEditForm} />
                      {/* Teléfono de la Empresa con código de país */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono de la Empresa</label>
                        {isEditing ? (
                          (() => {
                            const parts = formatPhoneParts(editForm.empresa_telefono);
                            const countryCodeOptions = ['+58', '+1', '+34', '+57', '+54', '+55', '+56', '+52', '+51', '+507'];
                            const currentCode = countryCodeOptions.includes(parts.countryCode) ? parts.countryCode : '+58';
                            const numOnly = parts.number;
                            return (
                              <div className="flex gap-0 w-full">
                                <div className="relative shrink-0">
                                  <select
                                    className="w-16 bg-slate-50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-2.5 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 transition-colors appearance-none cursor-pointer text-slate-700"
                                    value={currentCode}
                                    onChange={(e) => {
                                      const newCode = e.target.value;
                                      setEditForm({ ...editForm, empresa_telefono: `${newCode} ${numOnly}`.trim() });
                                    }}
                                  >
                                    {countryCodeOptions.map(code => (
                                      <option key={code} value={code}>{code}</option>
                                    ))}
                                  </select>
                                  <ChevronDown size={14} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                                <input
                                  type="text"
                                  className="flex-1 bg-slate-50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors text-slate-700"
                                  value={numOnly}
                                  onChange={(e) => {
                                    setEditForm({ ...editForm, empresa_telefono: `${currentCode} ${e.target.value}`.trim() });
                                  }}
                                />
                              </div>
                            );
                          })()
                        ) : (
                          (() => {
                            const phoneParts = formatPhoneParts(selected.empresa_telefono);
                            if (!phoneParts.hasPhone) {
                              return (
                                <p className="bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm font-bold text-slate-700 w-fit">
                                  Sin teléfono
                                </p>
                              );
                            }
                            return (
                              <div className="flex gap-0 w-full">
                                <div className="bg-slate-50/50 border border-gray-100 rounded-l-xl rounded-r-none border-r-0 px-3 py-2 text-sm font-black text-slate-700 flex items-center justify-center min-w-[52px] shrink-0">
                                  {phoneParts.countryCode}
                                </div>
                                <div className="bg-slate-50/50 border border-gray-100 rounded-r-xl rounded-l-none px-4 py-2 text-sm font-bold text-slate-700 flex-1">
                                  {phoneParts.number}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                      <DataField label="Sitio Web" value={selected.empresa_website || 'Sin sitio web'} isEditing={isEditing} fieldName="empresa_website" form={editForm} setForm={setEditForm} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECCIÓN: REDES SOCIALES ── */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Globe size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Redes Sociales y Web</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DataField label="Sitio Web" value={selected.website || 'No configurado'} isEditing={isEditing} fieldName="website" form={editForm} setForm={setEditForm} />
                  <DataField label="Instagram" value={selected.instagram || 'No configurado'} isEditing={isEditing} fieldName="instagram" form={editForm} setForm={setEditForm} />
                  <DataField label="Facebook" value={selected.facebook || 'No configurado'} isEditing={isEditing} fieldName="facebook" form={editForm} setForm={setEditForm} />
                  <DataField label="LinkedIn" value={selected.linkedin || 'No configurado'} isEditing={isEditing} fieldName="linkedin" form={editForm} setForm={setEditForm} />
                  <DataField label="X (Twitter)" value={selected.twitter || 'No configurado'} isEditing={isEditing} fieldName="twitter" form={editForm} setForm={setEditForm} />
                  <DataField label="TikTok" value={selected.tiktok || 'No configurado'} isEditing={isEditing} fieldName="tiktok" form={editForm} setForm={setEditForm} />
                </div>
              </div>
            {/* Certificados Entregados / Emitidos */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Award size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Certificados Entregados</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Comprobantes y títulos digitales emitidos</p>
                  </div>
                </div>
                {(selected as any).certificados && (selected as any).certificados.length > 0 && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                    {(selected as any).certificados.length} {(selected as any).certificados.length === 1 ? 'Certificado' : 'Certificados'}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {(selected as any).certificados === undefined ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                    <RefreshCw size={15} className="animate-spin text-amber-500" />
                    Cargando certificados...
                  </div>
                ) : (selected as any).certificados && (selected as any).certificados.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(selected as any).certificados.map((cert: any) => {
                      const certTitle = cert.curso_nombre || (cert.programa_codigo ? `Programa ${cert.programa_codigo}` : 'Certificado de Aprobación');
                      const validationCode = cert.codigo_validacion;
                      const fechaStr = cert.fecha_emision ? new Date(cert.fecha_emision).toLocaleDateString() : '';

                      return (
                        <div
                          key={cert.id_certificado || validationCode}
                          className="p-3.5 bg-slate-50/80 border border-slate-100 rounded-2xl hover:border-amber-200 hover:bg-amber-50/30 transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/50">
                              <Award size={18} />
                            </div>
                            <div className="min-w-0">
                              <h6 className="text-xs font-black text-slate-800 truncate group-hover:text-amber-950 uppercase tracking-tight">
                                {certTitle}
                              </h6>
                              <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                Cód: <span className="text-amber-700 font-black">{validationCode}</span> {fechaStr ? `· ${fechaStr}` : ''}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/comprobante/${encodeURIComponent(validationCode)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-100/80 border border-slate-200 transition-colors shrink-0 shadow-2xs"
                            title="Ver Certificado Digital"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Award size={22} className="mx-auto text-slate-300 mb-1.5" />
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Sin certificados emitidos</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Este afiliado aún no posee certificados de aprobación registrados.</p>
                  </div>
                )}
              </div>
            </div>

            <AdminDocumentosManager
              afiliado={selected}
              token={token}
              onUpdateDocs={(updatedDocs) => {
                setSelected((prev: any) => prev ? { ...prev, documentos: updatedDocs } : prev);
                setEditForm((prev: any) => prev ? { ...prev, documentos: updatedDocs } : prev);
                setApprovedMembers((prev: any[]) => prev.map(m => m.id_afiliado === selected.id_afiliado ? { ...m, documentos: updatedDocs } : m));
              }}
            />

            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-medium pt-2">
              <Calendar size={12} /> Registrado el {new Date(selected.fecha_registro).toLocaleDateString()}
            </div>

            {/* Nueva Sección: Afiliados Asociados (Solo para Corporativos) */}
            {selected.tipo_afiliado === 'Corporativo' && (
              <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                      <UserIcon size={16} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Afiliados Asociados</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Trabajadores directos del corporativo</p>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {associatedMembers.length} MIEMBROS
                  </span>
                </div>

                {associatedMembers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {associatedMembers.map(m => (
                      <div
                        key={m.id_afiliado}
                        onClick={() => handleSelect(m)}
                        className="group flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-emerald-200 transition-colors cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                          <UserIcon size={18} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-black text-slate-700 truncate group-hover:text-emerald-600 transition-colors">
                            {m.nombres} {m.apellidos}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">
                            {m.cedula}
                          </p>
                        </div>
                        <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-transform group-hover:translate-x-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">No hay trabajadores asociados todavía</p>
                    <p className="text-[10px] text-slate-300 mt-1">Los trabajadores aparecerán aquí una vez vinculados a este RIF.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Modal Nuevo Miembro */}
      {showNewModal && (
        <div className="transition-opacity fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md fade-in duration-300">
          <div className="transition-transform bg-white w-full max-w-2xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col zoom-in-95 duration-300">
            <div className="bg-slate-50 p-8 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-800">Registrar Nuevo Miembro</h3>
                <p className="text-sm text-slate-400 font-medium">Carga un nuevo afiliado directamente al directorio</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1">
              {/* SECCIÓN 1: Perfil y Datos Personales */}
              <FormSection
                icon={<UserIcon size={16} />}
                title="Perfil y Datos Personales"
                subtitle="Información del representante legal, agente o miembro independiente"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Miembro</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowTipoDropdown(!showTipoDropdown)}
                        className="w-full bg-slate-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>
                          {newTipo === 'Natural' && 'Agente Independiente'}
                          {newTipo === 'Agente Corporativo' && 'Agente Corporativo'}
                          {newTipo === 'Corporativo' && 'Corporativo (empresa)'}
                        </span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${showTipoDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showTipoDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowTipoDropdown(false)} />
                          <div className="transition-opacity transition-transform absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl py-1.5 z-50 fade-in slide-in-from-top-1 duration-200">
                            {([
                              { value: 'Natural', label: 'Agente Independiente' },
                              { value: 'Agente Corporativo', label: 'Agente Corporativo' },
                              { value: 'Corporativo', label: 'Corporativo (empresa)' },
                            ] as const).map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  handleNewTipoChange(opt.value)
                                  setShowTipoDropdown(false)
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${newTipo === opt.value ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>


                  <DataInput label="Nombres" placeholder="Ej: Juan" value={(newForm as any).nombres || ''} onChange={(v: string) => setNewForm({ ...newForm, nombres: v } as any)} isRequired hasError={formErrors.nombres} />
                  <DataInput label="Apellidos" placeholder="Ej: Pérez" value={(newForm as any).apellidos || ''} onChange={(v: string) => setNewForm({ ...newForm, apellidos: v } as any)} isRequired hasError={formErrors.apellidos} />

                  <div className="sm:col-span-2 space-y-1.5 relative z-0 focus-within:z-20">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${formErrors.cedula ? 'text-red-500' : 'text-slate-400'}`}>
                      {isNewCorporativo ? "Cédula del representante" : "Cédula"} <span className="text-emerald-500">*</span>
                    </label>
                    <div className="flex gap-2 relative z-10">
                      <select
                        className={`w-20 bg-slate-50 border rounded-2xl px-3 py-3 text-sm font-bold outline-none relative z-10 focus:z-20 focus:ring-4 transition-colors ${formErrors.cedula ? 'border-red-500 ring-red-500/10' : 'border-gray-100 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                        value={newForm.cedula_tipo || 'V'}
                        onChange={(e) => setNewForm({ ...newForm, cedula_tipo: e.target.value })}
                      >
                        {['V', 'E', 'P'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input
                        className={`flex-1 bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-bold outline-none relative z-10 focus:z-20 focus:ring-4 transition-colors ${formErrors.cedula ? 'border-red-500 ring-red-500/10' : 'border-gray-100 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                        placeholder="12345678"
                        inputMode="numeric"
                        value={newForm.cedula || ''}
                        onChange={(e) => setNewForm({ ...newForm, cedula: e.target.value })}
                      />
                    </div>
                  </div>

                  <DataInput label="Fecha de nacimiento" type="date" value={newForm.fecha_nacimiento || ''} onChange={(v: string) => setNewForm({ ...newForm, fecha_nacimiento: v })} />
                  <DataInput label="Correo electrónico" type="email" placeholder="juan@ejemplo.com" value={newForm.email || ''} onChange={(v: string) => setNewForm({ ...newForm, email: v })} isRequired hasError={formErrors.email} />
                  <DataInput label="Teléfono" type="tel" placeholder="+58 412..." value={newForm.telefono || ''} onChange={(v: string) => setNewForm({ ...newForm, telefono: v })} />
                  <div className="space-y-1.5 relative z-0 focus-within:z-20">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.nivel_academico ? 'text-red-500' : 'text-slate-400'}`}>Nivel académico</label>
                    <div className="relative">
                      <select
                        className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-bold outline-none relative z-10 focus:z-20 focus:ring-4 transition-colors ${formErrors.nivel_academico ? 'border-red-500 ring-red-500/10' : 'border-gray-100 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                        value={newForm.nivel_academico || ''}
                        onChange={(e) => setNewForm({ ...newForm, nivel_academico: e.target.value })}
                      >
                        <option value="">No especificado</option>
                        {ACADEMIC_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <DataInput label="Código de Afiliado (opcional)" placeholder="Dejar en blanco para autogenerar" value={newForm.codigo || ''} onChange={(v: string) => setNewForm({ ...newForm, codigo: v })} />
                  
                  {/* Aprobar CIBIR (Certificación vs Acreditación) */}
                  <div className="sm:col-span-2 bg-emerald-50/60 border border-emerald-200/60 p-4 rounded-2xl flex items-center justify-between gap-4 mt-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <GraduationCap size={16} className="text-emerald-600" />
                        <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">Aprobar CIBIR</span>
                      </div>
                      <p className="text-[11px] font-medium text-emerald-800/80 leading-snug">
                        {!newForm.cibir_acreditado 
                          ? '✓ Aprobado en CIBIR (Genera certificado CIBIR de aprobación)' 
                          : '✗ Acreditado por convalidación (Exonerado / Sin certificado CIBIR)'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!newForm.cibir_acreditado}
                        onChange={(e) => setNewForm({ ...newForm, cibir_acreditado: e.target.checked ? 0 : 1 })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                </div>

                {/* Redes Sociales del Individuo */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Redes Sociales y Web (Personal)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DataInput type="url" label="Sitio Web" placeholder="https://..." value={newForm.website || ''} onChange={(v: string) => setNewForm({ ...newForm, website: v })} />
                    <DataInput type="url" label="Instagram" placeholder="https://instagram.com/..." value={newForm.instagram || ''} onChange={(v: string) => setNewForm({ ...newForm, instagram: v })} />
                    <DataInput type="url" label="Facebook" placeholder="https://facebook.com/..." value={newForm.facebook || ''} onChange={(v: string) => setNewForm({ ...newForm, facebook: v })} />
                    <DataInput type="url" label="LinkedIn" placeholder="https://linkedin.com/in/..." value={newForm.linkedin || ''} onChange={(v: string) => setNewForm({ ...newForm, linkedin: v })} />
                    <DataInput type="url" label="X (Twitter)" placeholder="https://x.com/..." value={newForm.twitter || ''} onChange={(v: string) => setNewForm({ ...newForm, twitter: v })} />
                    <DataInput type="url" label="TikTok" placeholder="https://tiktok.com/@..." value={newForm.tiktok || ''} onChange={(v: string) => setNewForm({ ...newForm, tiktok: v })} />
                  </div>
                </div>

                {/* Documentación del Expediente (todos los tipos) */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    {isNewCorporativo ? 'Documentación del Representante Legal' : 'Documentación del Expediente'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                    <FileUpload
                      label="Síntesis Curricular (CV)"
                      required
                      accept=".pdf,image/*"
                      folder="cvs"
                      initialUrl={newUrlCv || undefined}
                      initialFileName={newNameCv || undefined}
                      onUploadSuccess={(url, name) => { setNewUrlCv(url); setNewNameCv(name || (isNewCorporativo ? 'CV_Representante.pdf' : 'CV.pdf')); }}
                      onClear={() => { setNewUrlCv(''); setNewNameCv(''); }}
                      hasError={formErrors.newUrlCv}
                    />
                    {isNewCorporativo ? (
                      <FileUpload
                        label="Título Académico"
                        required
                        accept=".pdf,image/*"
                        folder="titulos"
                        initialUrl={newUrlTituloRep || undefined}
                        initialFileName={newNameTituloRep || undefined}
                        onUploadSuccess={(url, name) => { setNewUrlTituloRep(url); setNewNameTituloRep(name || 'Titulo_Representante.pdf'); }}
                        onClear={() => { setNewUrlTituloRep(''); setNewNameTituloRep(''); }}
                        hasError={formErrors.newUrlTituloRep}
                      />
                    ) : (
                      <FileUpload
                        label="Título Profesional"
                        required={!!(newForm.nivel_academico && newForm.nivel_academico !== 'Bachiller')}
                        accept=".pdf,image/*"
                        folder="titulos"
                        initialUrl={newUrlTitulo || undefined}
                        initialFileName={newNameTitulo || undefined}
                        onUploadSuccess={(url, name) => { setNewUrlTitulo(url); setNewNameTitulo(name || 'Titulo.pdf'); }}
                        onClear={() => { setNewUrlTitulo(''); setNewNameTitulo(''); }}
                        hasError={formErrors.newUrlTitulo}
                      />
                    )}
                  </div>
                </div>
              </FormSection>

              {/* SECCIÓN 2: Información de la Empresa (Solo Corporativos) */}
              {isNewCorporativo && (
                <FormSection
                  icon={<Building2 size={16} />}
                  title="Datos de la Empresa"
                  subtitle="Información pública y de contacto de la inmobiliaria"
                  variant="emerald"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <DataInput
                        label="Razón social"
                        placeholder="Inmobiliaria XYZ C.A."
                        value={newForm.empresa_razon_social || ''}
                        onChange={(v: string) => setNewForm({ ...newForm, empresa_razon_social: v })}
                        isRequired
                        hasError={formErrors.empresa_razon_social}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo RIF <span className="text-emerald-500">*</span></label>
                      <div className="relative">
                        <select
                          className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-colors appearance-none cursor-pointer"
                          value={newForm.empresa_rif_tipo || 'J'}
                          onChange={(e) => setNewForm({ ...newForm, empresa_rif_tipo: e.target.value })}
                        >
                          {ID_PREFIXES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <DataInput
                      label="Número RIF"
                      placeholder="12345678-9"
                      value={newForm.empresa_rif_numero || ''}
                      onChange={(v: string) => setNewForm({ ...newForm, empresa_rif_numero: v })}
                      isRequired
                      hasError={formErrors.empresa_rif_numero}
                    />
                    <DataInput type="email" label="Correo corporativo" placeholder="contacto@empresa.com" value={newForm.empresa_email || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_email: v })} />
                    <DataInput type="tel" label="Teléfono corporativo" placeholder="+58 412..." value={newForm.empresa_telefono || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_telefono: v })} />
                    <div className="sm:col-span-2">
                      <DataInput label="Dirección fiscal o de oficina" placeholder="Av. Principal..." value={newForm.empresa_direccion || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_direccion: v })} />
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-emerald-100/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Redes Sociales y Web (Empresa)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DataInput type="url" label="Sitio web de la empresa" placeholder="https://www.empresa.com" value={newForm.empresa_website || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_website: v })} />
                      <DataInput type="url" label="Instagram Empresa" placeholder="https://instagram.com/..." value={newForm.empresa_instagram || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_instagram: v })} />
                      <DataInput type="url" label="Facebook Empresa" placeholder="https://facebook.com/..." value={newForm.empresa_facebook || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_facebook: v })} />
                      <DataInput type="url" label="LinkedIn Empresa" placeholder="https://linkedin.com/company/..." value={newForm.empresa_linkedin || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_linkedin: v })} />
                      <DataInput type="url" label="X (Twitter) Empresa" placeholder="https://x.com/..." value={newForm.empresa_twitter || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_twitter: v })} />
                      <DataInput type="url" label="TikTok Empresa" placeholder="https://tiktok.com/@..." value={newForm.empresa_tiktok || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_tiktok: v })} />
                    </div>
                  </div>

                  {/* Documentos Legales de la Empresa */}
                  <div className="mt-4 pt-4 border-t border-emerald-100/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Documentación Legal de la Empresa</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                      <FileUpload
                        label="RIF de la Empresa"
                        required
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        initialUrl={newUrlTitulo || undefined}
                        initialFileName={newNameTitulo || undefined}
                        onUploadSuccess={(url, name) => { setNewUrlTitulo(url); setNewNameTitulo(name || 'RIF_Empresa.pdf'); }}
                        onClear={() => { setNewUrlTitulo(''); setNewNameTitulo(''); }}
                        hasError={formErrors.newUrlTitulo}
                      />
                      <FileUpload
                        label="Registro Mercantil"
                        required
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        initialUrl={newUrlRegistro || undefined}
                        initialFileName={newNameRegistro || undefined}
                        onUploadSuccess={(url, name) => { setNewUrlRegistro(url); setNewNameRegistro(name || 'Registro_Mercantil.pdf'); }}
                        onClear={() => { setNewUrlRegistro(''); setNewNameRegistro(''); }}
                        hasError={formErrors.newUrlRegistro}
                      />
                    </div>
                  </div>
                </FormSection>
              )}

              {/* SECCIÓN 2 ALT: Vinculación Corporativa (Solo Agentes Corporativos) */}
              {newTipo === 'Agente Corporativo' && (
                <VinculacionCorporativaSection
                  companies={companies}
                  idEmpresa={newForm.id_empresa}
                  onSelect={(id) => setNewForm({ ...newForm, id_empresa: id })}
                  hasError={formErrors.id_empresa}
                />
              )}
              {/* SECCIÓN: Fotografía y Logo (Opcionales) */}
              <FormSection
                icon={<ImageIcon size={16} />}
                title="Fotografía y Logo (Opcionales)"
                subtitle="Cargue la foto de perfil del afiliado y/o el logo corporativo de la empresa"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                  <FileUpload
                    label="Foto de Perfil (Opcional)"
                    accept="image/*"
                    folder="fotos/afiliados"
                    initialUrl={(newForm as any).foto_url || undefined}
                    onUploadSuccess={(url) => setNewForm({ ...newForm, foto_url: url } as any)}
                    onClear={() => setNewForm({ ...newForm, foto_url: null } as any)}
                    enableCrop
                    cropAspect={4 / 5}
                    cropShape="rect"
                  />
                  {newTipo !== 'Agente Corporativo' && (
                    <FileUpload
                      label={newTipo === 'Corporativo' ? "Logo Empresa (Opcional)" : "Logo Personal (Opcional)"}
                      accept="image/*"
                      folder={newTipo === 'Corporativo' ? "logos/empresas" : "logos/marcas"}
                      initialUrl={(newForm as any).empresa_logo_url || undefined}
                      onUploadSuccess={(url) => setNewForm({ ...newForm, empresa_logo_url: url } as any)}
                      onClear={() => setNewForm({ ...newForm, empresa_logo_url: null } as any)}
                      enableCrop
                      cropAspect={1}
                      cropShape="rect"
                    />
                  )}
                </div>
              </FormSection>


            </div>

            <div className="px-8 pb-8 flex flex-col gap-4 bg-white">
              {createError && (
                <div className="transition-transform flex items-center gap-3 text-white bg-red-600 border border-red-700 p-4 rounded-2xl text-xs font-bold justify-center shadow-md shadow-red-600/20 slide-in-from-top-2 duration-300">
                  <AlertCircle size={18} className="text-white shrink-0" />
                  {createError}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-8 py-4 rounded-2xl text-sm font-bold text-slate-500 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Registrar Miembro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDITOR DE IMAGEN (logo o foto de perfil) ─────────────────────────── */}
      {imageEditKind && selected && (
        <div
          className="transition-opacity fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm fade-in duration-200"
          onClick={closeImageEditor}
        >
          <div
            className="transition-transform bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-800 text-base">
                  {imageEditKind === 'logo'
                    ? (selected.tipo_afiliado === 'Corporativo' ? 'Logo de la Empresa' : 'Logo Personal / Comercial')
                    : 'Foto de Perfil'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {imageEditKind === 'logo'
                    ? (selected.tipo_afiliado === 'Corporativo' ? (selected.empresa_razon_social || formatNombreCard(selected.nombre_completo)) : formatNombreCard(selected.nombre_completo))
                    : formatNombreCard(selected.nombre_completo)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeImageEditor}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className={`relative w-full h-64 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer overflow-hidden transition-colors ${imageDragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              onClick={() => !imagePreview && imageFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setImageDragOver(true) }}
              onDragLeave={() => setImageDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setImageDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file && file.type.startsWith('image/')) handleImageFileChange(file)
              }}
            >
              {imagePreview ? (
                <div className="relative w-full h-full">
                  <Cropper
                    image={imagePreview}
                    crop={crop}
                    zoom={zoom}
                    minZoom={imageEditKind === 'logo' ? 0.2 : 1}
                    maxZoom={4}
                    restrictPosition={imageEditKind === 'logo' ? false : true}
                    aspect={cropAspectChoice}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                    cropShape="rect"
                    showGrid={true}
                    onMediaLoaded={(mediaSize) => {
                      if (imageEditKind === 'foto') {
                        setZoom(1.1)
                        setCrop({ x: 0, y: -10 })
                      }
                    }}
                  />
                  {/* Guía central vertical para encuadre */}
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] border-l-2 border-dashed border-white/60 drop-shadow-md pointer-events-none z-10" />
                </div>
              ) : (
                <>
                  <ImageIcon size={28} className="text-slate-300" />
                  <p className="text-xs font-bold text-slate-400 text-center px-4">
                    Arrastra o haz clic para seleccionar
                    <br />
                    <span className="text-slate-300 font-normal text-[10px]">PNG, JPG, WEBP</span>
                  </p>
                </>
              )}
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageFileChange(file)
                }}
              />
            </div>

            {imageEditKind === 'logo' ? (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-100/80 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Encuadre Logo:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCropAspectChoice(1)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${cropAspectChoice === 1 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Cuadrado (1:1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropAspectChoice(16 / 9)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${cropAspectChoice === 16 / 9 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Horizontal (16:9)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-100/80 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Encuadre:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCropAspectChoice(1)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${cropAspectChoice === 1 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Cuadrado (1:1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropAspectChoice(4 / 5)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${cropAspectChoice === 4 / 5 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Perfil (4:5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropAspectChoice(16 / 9)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${cropAspectChoice === 16 / 9 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Horizontal (16:9)
                  </button>
                </div>
              </div>
            )}

            {imagePreview && (
              <div className="space-y-4">
                <div className="px-2">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zoom</span>
                    <span className="text-[10px] font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={0.2}
                    max={4}
                    step={0.02}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null); setCroppedAreaPixels(null) }}
                  className="w-full text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center gap-1"
                >
                  <X size={10} /> Cambiar imagen
                </button>
              </div>
            )}

            {imageError && (
              <p className="text-xs font-bold text-rose-500 text-center">{imageError}</p>
            )}

            {((imageEditKind === 'logo' && selected.empresa_logo_url) || (imageEditKind === 'foto' && selected.foto_url)) && (
              <button
                type="button"
                onClick={handleDeleteImage}
                disabled={imageUploading}
                className="w-full bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold py-2.5 rounded-2xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={12} />
                {imageEditKind === 'logo' ? (selected.tipo_afiliado === 'Corporativo' ? 'Eliminar Logo de Empresa' : 'Eliminar Logo Personal') : 'Eliminar Foto actual'}
              </button>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeImageEditor}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveImage}
                disabled={imageUploading}
                className="flex-[2] bg-emerald-500 text-white text-sm font-bold py-3 rounded-2xl hover:bg-emerald-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {imageUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {imageUploading ? 'Subiendo...' : imageEditKind === 'logo' ? (selected.tipo_afiliado === 'Corporativo' ? 'Guardar Logo Empresa' : 'Guardar Logo Personal') : 'Guardar Foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Widget de Progreso de Descarga Masiva */}
      {batchDownloading && (
        <div className="transition-transform fixed bottom-6 right-6 z-[120] bg-white border border-gray-200 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 min-w-[280px] slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Descarga Masiva
            </span>
            <Loader2 className="animate-spin text-emerald-600" size={16} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-800">
              {isCanceling ? 'Cancelando...' : `Procesando ${batchCurrent} de ${batchTotal}`}
            </div>
            {currentMember && (
              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider truncate max-w-[250px]">
                {currentMember.nombres || currentMember.nombre_completo || currentMember.representante_nombre}
              </div>
            )}
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-colors duration-300"
              style={{ width: `${(batchCurrent / batchTotal) * 100}%` }}
            />
          </div>
          <button
            type="button"
            disabled={isCanceling}
            onClick={() => {
              cancelRef.current = true;
              setIsCanceling(true);
            }}
            className="mt-1 text-center w-full py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors transition-opacity cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Contenedor Oculto para Captura de Carnet en Lote */}
      {currentMember && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
          <CarnetCardPreview
            cardRef={bulkCardRef}
            afiliado={currentMember as any}
            useJuntaPhoto={(() => {
              const rawRedes = currentMember?.redes_sociales;
              const redes = rawRedes
                ? (typeof rawRedes === 'string' ? (() => { try { return JSON.parse(rawRedes); } catch { return {}; } })() : rawRedes)
                : {};
              return Boolean(redes?.use_junta_photo);
            })()}
            qrCodeUrl={currentMemberQrUrl}
            hideActionButtons={true}
          />
        </div>
      )}



      <ExportAfiliadosModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        authHeaders={authHeaders}
        initialFilters={{
          tipo: filterTipo as ExportTipoFilter,
          search,
          estatus: 'Afiliado',
        }}
      />

      {showChangeTypeModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-[#022c22]/60 backdrop-blur-sm" aria-hidden="true" onClick={() => setShowChangeTypeModal(false)} />
          <div className="relative bg-white w-[calc(100vw-2rem)] sm:w-full max-w-xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-fit max-h-[90vh] transition-colors duration-500 ease-in-out">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                  Cambiar Tipo de Membresía
                </h3>
                <p className="text-[10px] font-bold text-gray-400 mt-1">
                  Mover a {selected ? formatNombreCard(selected.nombre_completo) : ''} a la membresía: {pendingNewType}
                </p>
              </div>
              <button
                onClick={() => setShowChangeTypeModal(false)}
                className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-3 max-h-[calc(90vh-140px)]">
              {pendingNewType === 'Agente Corporativo' && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Seleccionar Empresa Destino
                    </label>
                    <CompanySearchField
                      companies={empresas.map(emp => ({
                        ...emp,
                        empresa_razon_social: emp.razon_social,
                        empresa_rif_numero: `${emp.rif_tipo}-${emp.rif_numero}`
                      }))}
                      selectedIdEmpresa={Number(selectedEmpresaId) || null}
                      onSelect={(id) => setSelectedEmpresaId(id ? String(id) : '')}
                    />
                  </div>
                </div>
              )}

              {pendingNewType === 'Corporativo' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      Información de la Nueva Empresa
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-full flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Razón Social *</label>
                        <input
                          type="text"
                          value={razonSocial}
                          onChange={e => setRazonSocial(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="Nombre comercial de la inmobiliaria"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo RIF *</label>
                        <select
                          value={rifTipo}
                          onChange={e => setRifTipo(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                        >
                          <option value="J">J (Jurídico)</option>
                          <option value="G">G (Gubernamental)</option>
                          <option value="P">P (Persona Firma Personal)</option>
                          <option value="V">V (Venezolano)</option>
                          <option value="E">E (Extranjero)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Número de RIF (Solo números) *</label>
                        <input
                          type="text"
                          value={rifNumero}
                          onChange={e => setRifNumero(e.target.value.replace(/\D/g, ''))}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="123456789"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Correo de la Empresa *</label>
                        <input
                          type="email"
                          value={emailEmpresa}
                          onChange={e => setEmailEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="contacto@empresa.com"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Teléfono *</label>
                        <input
                          type="text"
                          value={telefonoEmpresa}
                          onChange={e => setTelefonoEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="+58 212 555-5555"
                        />
                      </div>

                      <div className="col-span-full flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dirección Física (Opcional)</label>
                        <textarea
                          rows={2}
                          value={direccionEmpresa}
                          onChange={e => setDireccionEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white resize-none"
                          placeholder="Dirección exacta..."
                        />
                      </div>

                      <div className="col-span-full flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sitio Web (Opcional)</label>
                        <input
                          type="text"
                          value={websiteEmpresa}
                          onChange={e => setWebsiteEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="www.tuempresa.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      Documentación de la Empresa
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FileUpload
                        label="Registro Mercantil"
                        required
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        onUploadSuccess={(url, name) => {
                          setUrlRegistro(url);
                          setNombreRegistro(name || 'Registro_Mercantil.pdf');
                        }}
                        onClear={() => {
                          setUrlRegistro('');
                          setNombreRegistro('');
                        }}
                      />
                      <FileUpload
                        label="RIF de la Empresa"
                        required
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        onUploadSuccess={(url, name) => {
                          setUrlRif(url);
                          setNombreRif(name || 'RIF_Empresa.pdf');
                        }}
                        onClear={() => {
                          setUrlRif('');
                          setNombreRif('');
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowChangeTypeModal(false)}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[10px] hover:bg-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  submittingChangeType ||
                  (pendingNewType === 'Agente Corporativo' && !selectedEmpresaId) ||
                  (pendingNewType === 'Corporativo' && (!razonSocial || !rifNumero || !emailEmpresa || !telefonoEmpresa || !urlRegistro || !urlRif))
                }
                onClick={() => {
                  const data: any = {};
                  if (pendingNewType === 'Agente Corporativo') {
                    data.id_empresa_solicitada = Number(selectedEmpresaId);
                  } else if (pendingNewType === 'Corporativo') {
                    data.datos_empresa = {
                      razon_social: razonSocial.trim(),
                      rif_tipo: rifTipo,
                      rif_numero: rifNumero.replace(/\D/g, ''),
                      email: emailEmpresa.trim().toLowerCase(),
                      telefono: telefonoEmpresa.trim(),
                      direccion: direccionEmpresa.trim(),
                      website: websiteEmpresa.trim()
                    };
                    data.documentos_empresa = [
                      { tipo_doc: 'registro_mercantil', url: urlRegistro, nombre_archivo: nombreRegistro },
                      { tipo_doc: 'rif_empresa', url: urlRif, nombre_archivo: nombreRif }
                    ];
                  }
                  executeDirectTypeChange(pendingNewType, data);
                }}
                className="flex-[2] h-12 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                {submittingChangeType ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {affiliateToDelete !== null && (
        <div className='fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 w-[calc(100vw-2rem)] sm:w-full max-w-sm mx-auto fade-in zoom-in duration-200 text-center'>
            <div className='w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-3'>
              <Trash2 size={28} />
            </div>
            <h3 className='text-base font-black text-slate-800 mb-1.5'>¿Eliminar afiliado?</h3>
            <p className='text-xs text-slate-500 mb-4 leading-relaxed'>
              ¿Estás seguro de eliminar este afiliado? Esta acción no se puede deshacer y borrará permanentemente sus datos.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                onClick={() => confirmDelete(affiliateToDelete)}
                className='w-full py-2.5 bg-rose-500 text-white rounded-xl text-xs font-black hover:bg-rose-600 shadow-lg shadow-rose-500/25 transition-colors flex items-center justify-center gap-2'
              >
                <Trash2 size={16} />
                Eliminar Permanentemente
              </button>
              <button 
                type='button' 
                onClick={() => setAffiliateToDelete(null)} 
                className='w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors'
              >
                Mantener afiliado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Natural Transition confirmation modal */}
      {naturalTransitionTarget && (
        <div className='fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 w-[calc(100vw-2rem)] sm:w-full max-w-sm mx-auto fade-in zoom-in duration-200 text-center'>
            <div className='w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mx-auto mb-3'>
              <ShieldAlert size={28} />
            </div>
            <h3 className='text-base font-black text-slate-800 mb-1.5'>¿Cambiar a Agente Independiente?</h3>
            <p className='text-xs text-slate-500 mb-4 leading-relaxed'>
              ¿Estás seguro de convertir a <span className='font-bold text-slate-700'>{formatNombreCard(naturalTransitionTarget.nombre_completo)}</span> en Agente Independiente (Natural)? Se romperá cualquier vínculo con su empresa actual.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                onClick={handleConfirmNaturalTransition}
                disabled={submittingChangeType}
                className='w-full py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 disabled:opacity-50'
              >
                <BadgeCheck size={16} />
                Sí, cambiar
              </button>
              <button 
                type='button' 
                onClick={() => setNaturalTransitionTarget(null)} 
                className='w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors'
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <CarnetAfiliadoModal
        isOpen={showCarnetModal}
        onClose={() => setShowCarnetModal(false)}
        afiliado={selected}
        onUpdateAfiliado={(updatedFields) => {
          if (selected) {
            const updated = {
              ...selected,
              ...updatedFields
            };
            setSelected(updated);
            setItems(items.map(item => item.id_afiliado === selected.id_afiliado ? updated : item));
          }
        }}
      />
    </div>
  )
}

function DataField({ label, value, isEditing, fieldName, form, setForm, type = 'text', options = [], className = '', labelClassName = '' }: any) {
  return (
    <div className="space-y-1">
      <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 ${labelClassName}`}>{label}</label>
      {isEditing ? (
        type === 'select' ? (
          <div className="relative">
            <select
              className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
              value={form[fieldName] || ''}
              onChange={(e) => setForm({ ...form, [fieldName]: e.target.value })}
            >
              <option value="">Seleccionar...</option>
              {options.map((opt: any) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        ) : (
          <input
            type={type}
            className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
            value={form[fieldName] || ''}
            onChange={(e) => setForm({ ...form, [fieldName]: e.target.value })}
          />
        )
      ) : (
        <p className={`bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm font-bold text-slate-700 ${className}`}>{value}</p>
      )}
    </div>
  )
}

function FormSection({
  icon,
  title,
  subtitle,
  children,
  variant = 'default',
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  variant?: 'default' | 'emerald'
}) {
  const isEmerald = variant === 'emerald'
  return (
    <section
      className={`rounded-2xl border p-5 space-y-4 ${isEmerald ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50/50 border-gray-100'
        }`}
    >
      <div className="flex items-start gap-3 pb-3 border-b border-gray-100/80">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isEmerald ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}
        >
          {icon}
        </div>
        <div>
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function DataInput({ label, placeholder, value, onChange, type = 'text', isRequired = false, hasError = false }: any) {
  return (
    <div className="space-y-1.5 relative z-0 focus-within:z-20">
      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${hasError ? 'text-red-500' : 'text-slate-400'}`}>
        {label} {isRequired && <span className="text-emerald-500">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-bold outline-none relative z-10 focus:z-20 focus:ring-4 transition-colors ${hasError
          ? 'border-red-500 ring-4 ring-red-500/10 focus:ring-red-500/20'
          : 'border-gray-100 focus:border-emerald-500 focus:ring-emerald-500/10'
          }`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function VinculacionCorporativaSection({
  companies,
  idEmpresa,
  onSelect,
  hasError,
}: {
  companies: any[]
  idEmpresa: number | null | undefined
  onSelect: (id: number | null) => void
  hasError: boolean
}) {
  const [corpSearchField, setCorpSearchField] = React.useState<'nombre' | 'rif' | 'codigo'>('nombre')
  const [corpSearch, setCorpSearch] = React.useState('')
  const [showCorpDropdown, setShowCorpDropdown] = React.useState(false)
  const [showCorpResults, setShowCorpResults] = React.useState(false)

  const filteredCompanies = companies.filter((c) => {
    if (!corpSearch.trim()) return true
    const q = corpSearch.toLowerCase()
    if (corpSearchField === 'nombre') {
      const razon = (c.empresa_razon_social || '').toLowerCase();
      const nom = (c.nombre_completo || '').toLowerCase();
      const persona = `${c.nombres || ''} ${c.apellidos || ''}`.trim().toLowerCase();
      const rep = (c.representante_legal || c.representante_nombre || '').toLowerCase();
      return razon.includes(q) || nom.includes(q) || persona.includes(q) || rep.includes(q);
    }
    if (corpSearchField === 'rif') return (c.empresa_rif_numero || c.cedula || '').toLowerCase().includes(q)
    if (corpSearchField === 'codigo') return (c.codigo || '').toLowerCase().includes(q)
    return true
  })

  const selectedCompany = companies.find(c => c.id_empresa === idEmpresa)

  return (
    <FormSection
      icon={<Building2 size={16} />}
      title="Vinculación Corporativa"
      subtitle="Empresa a la que representa este agente"
      variant="emerald"
    >
      <div className="space-y-3">
        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${hasError ? 'text-red-500' : 'text-slate-400'}`}>
          Seleccionar Empresa <span className="text-emerald-500">*</span>
        </label>

        {/* Buscador con dropdown de criterio */}
        <div className={`relative flex items-center bg-slate-50 border rounded-2xl focus-within:ring-4 transition-colors h-12 ${hasError ? 'border-red-500 ring-red-500/10' : 'border-emerald-100 focus-within:ring-emerald-500/10 focus-within:border-emerald-500'}`}>
          <div className="relative shrink-0 border-r border-gray-200/80 h-full flex items-center">
            <button
              type="button"
              onClick={() => setShowCorpDropdown(!showCorpDropdown)}
              className="flex items-center gap-0.5 px-3 h-full text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
            >
              <span>
                {corpSearchField === 'nombre' && 'Nombre'}
                {corpSearchField === 'rif' && 'RIF'}
                {corpSearchField === 'codigo' && 'Código'}
              </span>
              <ChevronDown size={10} className={`text-slate-400 transition-transform ${showCorpDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showCorpDropdown && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowCorpDropdown(false)} />
                <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[120px] fade-in slide-in-from-top-1 duration-200">
                  {([
                    { key: 'nombre' as const, label: 'Nombre' },
                    { key: 'rif' as const, label: 'RIF' },
                    { key: 'codigo' as const, label: 'Código' },
                  ]).map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => { setCorpSearchField(option.key); setShowCorpDropdown(false); setCorpSearch(''); }}
                      className={`w-full text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${corpSearchField === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative flex-grow h-full flex items-center">
            <Search className="absolute left-3 text-slate-400" size={13} />
            <input
              type="text"
              value={corpSearch}
              onChange={(e) => { setCorpSearch(e.target.value); setShowCorpResults(true); }}
              onFocus={() => setShowCorpResults(true)}
              placeholder={`Buscar por ${corpSearchField === 'nombre' ? 'razón social' : corpSearchField === 'rif' ? 'RIF' : 'código'}...`}
              className="w-full h-full pl-8 pr-8 bg-transparent text-sm font-semibold placeholder-slate-400 outline-none"
            />
            {corpSearch && (
              <button
                type="button"
                onClick={() => { setCorpSearch(''); onSelect(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 transition-colors"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Empresa seleccionada */}
        {selectedCompany && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Building2 size={14} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-emerald-800 truncate">{selectedCompany.empresa_razon_social || selectedCompany.nombre_completo}</p>
              <p className="text-[10px] text-emerald-600 font-semibold">RIF: {selectedCompany.empresa_rif_numero || selectedCompany.cedula}{selectedCompany.codigo ? ` · Cód: ${selectedCompany.codigo}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => { onSelect(null); setCorpSearch(''); }}
              className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center hover:bg-emerald-300 transition-colors shrink-0"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* Lista de resultados */}
        {showCorpResults && corpSearch.trim() && !selectedCompany && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setShowCorpResults(false)} />
            <div className="relative z-20">
              <div className="absolute top-0 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto py-1">
                {filteredCompanies.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-400 font-semibold text-center">Sin resultados</p>
                ) : (
                  filteredCompanies.map((c) => (
                    <button
                      key={c.id_afiliado}
                      type="button"
                      onClick={() => {
                        onSelect(c.id_empresa ?? null)
                        setCorpSearch(c.empresa_razon_social || c.nombre_completo || '')
                        setShowCorpResults(false)
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                        <Building2 size={13} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{c.empresa_razon_social || c.nombre_completo}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">RIF: {c.empresa_rif_numero || c.cedula}{c.codigo ? ` · Cód: ${c.codigo}` : ''}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </FormSection>
  )
}

interface AdminDocumentosManagerProps {
  afiliado: AfiliadoDTO;
  token: string | null;
  onUpdateDocs: (updatedDocs: any[]) => void;
}

const PREDEFINED_DOC_TYPES = [
  { key: 'cv', label: 'Curriculum Vitae', icon: FileText, folder: 'cvs' },
  { key: 'titulo', label: 'Título Académico', icon: GraduationCap, folder: 'titulos' },
  { key: 'referencia_afiliado_1', label: 'Referencia Gremial 1', icon: Award, folder: 'referencias' },
  { key: 'referencia_afiliado_2', label: 'Referencia Gremial 2', icon: Award, folder: 'referencias' },
  { key: 'curso_extra', label: 'Certificado de Curso Relevante', icon: Award, folder: 'cursos' },
  { key: 'especializacion', label: 'Especialización', icon: Award, folder: 'especializaciones' },
  { key: 'diplomado', label: 'Diplomado', icon: Award, folder: 'diplomados' },
  { key: 'otro_documento', label: 'Otro Documento', icon: FileText, folder: 'otros' },
];

const CORP_DOC_TYPES = [
  { key: 'registro_mercantil', label: 'Registro Mercantil', icon: Building2, folder: 'documentos_empresa' },
  { key: 'rif_empresa', label: 'RIF de la Empresa', icon: Building2, folder: 'documentos_empresa' },
  { key: 'titulo_representante', label: 'Título del Representante Legal', icon: GraduationCap, folder: 'documentos_empresa' },
];

function AdminDocumentosManager({ afiliado, token, onUpdateDocs }: AdminDocumentosManagerProps) {
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const isCorp = afiliado.tipo_afiliado === 'Corporativo' || Boolean(afiliado.empresa_razon_social);
  const availableTypes = isCorp ? [...PREDEFINED_DOC_TYPES, ...CORP_DOC_TYPES] : PREDEFINED_DOC_TYPES;

  const currentDocs = (afiliado.documentos || []) as any[];

  const getDocLabel = (tipoKey: string) => {
    if (tipoKey.startsWith('curso_extra')) return 'Certificado de Curso Relevante';
    if (tipoKey.startsWith('otro_documento')) return 'Otro Documento';
    const found = availableTypes.find(t => t.key === tipoKey);
    return found?.label || tipoKey.replace(/_/g, ' ');
  };

  const isMultiInstance = (key: string) => key.startsWith('curso_extra') || key.startsWith('otro_documento');

  useEffect(() => {
    if (editingDoc) {
      setCustomTitle(editingDoc.nombre_archivo || getDocLabel(editingDoc.tipo_doc));
    } else if (activeUploadKey) {
      setCustomTitle(getDocLabel(activeUploadKey));
    } else {
      setCustomTitle('');
    }
  }, [activeUploadKey, editingDoc]);

  const handleSaveDoc = async (tipoKey: string, url: string, name?: string) => {
    if (!url) return;
    setIsSaving(true);
    try {
      let newDocsArray: any[];
      const finalDocName = customTitle.trim() || name || 'Documento.pdf';

      if (editingDoc) {
        newDocsArray = currentDocs.map(d => {
          const isTarget = editingDoc.id_documento 
            ? d.id_documento === editingDoc.id_documento 
            : d.tipo_doc === editingDoc.tipo_doc;
          return isTarget ? { ...d, url, nombre_archivo: finalDocName } : d;
        });
      } else {
        let finalTipoKey = tipoKey;
        if (isMultiInstance(tipoKey)) {
          finalTipoKey = `${tipoKey}_ts_${Date.now()}`;
        }
        const existingFiltered = currentDocs.filter(d => 
          isMultiInstance(tipoKey) ? false : d.tipo_doc === finalTipoKey
        );
        const newDoc = { tipo_doc: finalTipoKey, url, nombre_archivo: finalDocName };
        newDocsArray = [...existingFiltered, newDoc];
      }

      const res = await fetch(`${API_URL}/api/afiliados/${afiliado.id_afiliado}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ documentos: newDocsArray })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al guardar el documento');

      const updatedFromBackend = json.data?.documentos || newDocsArray;
      onUpdateDocs(updatedFromBackend);
      toast.success('Expediente actualizado con éxito');
      setActiveUploadKey(null);
      setEditingDoc(null);
      setCustomTitle('');
      setShowAddMenu(false);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar el documento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDoc = async (docObj: any) => {
    const labelName = getDocLabel(docObj.tipo_doc);

    const confirm = await Swal.fire({
      title: '¿Eliminar documento?',
      text: `Se eliminará "${labelName}" (${docObj.nombre_archivo || 'archivo'}) del expediente de este afiliado.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    setIsSaving(true);
    try {
      const remainingDocs = currentDocs.filter(d => {
        if (docObj.id_documento) return d.id_documento !== docObj.id_documento;
        return d.tipo_doc !== docObj.tipo_doc;
      });

      const payloadDocs = [
        ...remainingDocs, 
        { id_documento: docObj.id_documento, tipo_doc: docObj.tipo_doc, url: '', nombre_archivo: '' }
      ];

      const res = await fetch(`${API_URL}/api/afiliados/${afiliado.id_afiliado}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ documentos: payloadDocs })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al eliminar el documento');

      onUpdateDocs(remainingDocs);
      toast.success(`Documento "${labelName}" eliminado.`);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo eliminar el documento');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadedBaseKeys = new Set(currentDocs.map(d => d.tipo_doc.split('_ts_')[0]));
  const missingTypes = availableTypes.filter(t => !uploadedBaseKeys.has(t.key) || isMultiInstance(t.key));

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <FileText size={16} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Documentación y Expediente</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Soportes digitales del afiliado</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentDocs.length > 0 && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {currentDocs.length} {currentDocs.length === 1 ? 'Archivo' : 'Archivos'}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setShowAddMenu(!showAddMenu);
              setEditingDoc(null);
              if (activeUploadKey) setActiveUploadKey(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Upload size={14} />
            <span>+ Cargar Documento</span>
          </button>
        </div>
      </div>

      {(showAddMenu || activeUploadKey) && (
        <div className="p-4 bg-slate-50 border border-emerald-100 rounded-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
              {editingDoc
                ? `Reemplazar: ${getDocLabel(editingDoc.tipo_doc)}`
                : activeUploadKey
                  ? `Cargar: ${getDocLabel(activeUploadKey)}`
                  : 'Selecciona el Tipo de Documento a Cargar'}
            </p>
            <button
              type="button"
              onClick={() => { setActiveUploadKey(null); setEditingDoc(null); setShowAddMenu(false); }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200"
            >
              <X size={16} />
            </button>
          </div>

          {!activeUploadKey ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {availableTypes.map(t => {
                const isMulti = isMultiInstance(t.key);
                const countUploaded = currentDocs.filter(d => d.tipo_doc === t.key || d.tipo_doc.startsWith(`${t.key}_ts_`)).length;
                const isAlreadyUploaded = countUploaded > 0;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setEditingDoc(null); setActiveUploadKey(t.key); }}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-left border transition-all text-xs font-bold cursor-pointer ${
                      isMulti
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60'
                        : isAlreadyUploaded
                          ? 'bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-700'
                    }`}
                  >
                    <span className="truncate">{t.label} {isMulti && countUploaded > 0 ? `(${countUploaded})` : ''}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-extrabold shrink-0 ml-1">
                      {isMulti ? '+ Subir Nuevo' : (isAlreadyUploaded ? 'Reemplazar' : '+ Subir')}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="pt-2 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Nombre o Título del Documento:
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ej. Certificado de Tasación Inmobiliaria 2025"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-xs"
                />
              </div>

              <FileUpload
                label={customTitle || (editingDoc ? getDocLabel(editingDoc.tipo_doc) : getDocLabel(activeUploadKey))}
                accept=".pdf,image/*"
                folder={availableTypes.find(t => activeUploadKey.startsWith(t.key))?.folder || 'documentos'}
                maxSizeMB={10}
                onUploadSuccess={(url, name) => handleSaveDoc(activeUploadKey, url, customTitle.trim() || name)}
                onClear={() => { setActiveUploadKey(null); setEditingDoc(null); setCustomTitle(''); }}
              />
            </div>
          )}
        </div>
      )}

      {isSaving && (
        <div className="p-4 text-center border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/50 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
          <Loader2 size={16} className="animate-spin text-emerald-600" />
          Actualizando expediente...
        </div>
      )}

      {currentDocs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentDocs.map(doc => {
            const baseKey = doc.tipo_doc.split('_ts_')[0];
            const typeObj = availableTypes.find(t => t.key === baseKey);
            const labelText = getDocLabel(doc.tipo_doc);
            const IconComp = typeObj?.icon || FileText;

            return (
              <div
                key={doc.id_documento || doc.tipo_doc}
                className="group relative flex flex-col justify-between p-3.5 bg-slate-50/60 hover:bg-white border border-slate-100 hover:border-emerald-200 rounded-2xl transition-all shadow-xs hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/50 mt-0.5">
                    <IconComp size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{labelText}</h4>
                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{doc.nombre_archivo || 'Archivo cargado'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 mt-2 border-t border-slate-100">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors text-[10px] font-bold flex items-center gap-1"
                    title="Ver archivo"
                  >
                    <ExternalLink size={13} />
                    <span>Ver</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => { setEditingDoc(doc); setActiveUploadKey(doc.tipo_doc); setShowAddMenu(true); }}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300 transition-colors text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Reemplazar este archivo"
                  >
                    <Edit3 size={13} />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc)}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-colors text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Eliminar documento"
                  >
                    <Trash2 size={13} />
                    <span>Borrar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 space-y-2">
          <FileText size={28} className="mx-auto text-slate-300" />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sin documentos en el expediente</p>
          <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
            Este afiliado no tiene documentos cargados actualmente. Haz clic en <strong>+ Cargar Documento</strong> para añadir archivos a su expediente.
          </p>
        </div>
      )}

      {missingTypes.length > 0 && !showAddMenu && !activeUploadKey && (
        <div className="pt-2 border-t border-slate-50">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Añadir más documentos al expediente:</p>
          <div className="flex flex-wrap gap-1.5">
            {missingTypes.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setEditingDoc(null); setActiveUploadKey(t.key); setShowAddMenu(true); }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>+ {t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompanySearchField({
  companies,
  selectedIdEmpresa,
  onSelect,
  placeholder = "Buscar empresa...",
}: {
  companies: any[]
  selectedIdEmpresa: number | null | undefined
  onSelect: (id: number | null) => void
  placeholder?: string
}) {
  const [corpSearchField, setCorpSearchField] = React.useState<'nombre' | 'rif' | 'codigo'>('nombre')
  const [corpSearch, setCorpSearch] = React.useState('')
  const [showCorpDropdown, setShowCorpDropdown] = React.useState(false)
  const [showCorpResults, setShowCorpResults] = React.useState(false)

  const selectedCompany = companies.find(c => {
    return c.id_empresa === selectedIdEmpresa || c.id_afiliado === selectedIdEmpresa;
  })

  const [prevSelectedCompany, setPrevSelectedCompany] = React.useState(selectedCompany)
  if (prevSelectedCompany !== selectedCompany) {
    setPrevSelectedCompany(selectedCompany)
    if (selectedCompany) {
      setCorpSearch(selectedCompany.empresa_razon_social || selectedCompany.nombre_completo || '')
    } else {
      setCorpSearch('')
    }
  }

  const filteredCompanies = companies.filter((c) => {
    if (!corpSearch.trim()) return true
    const q = corpSearch.toLowerCase().trim()
    const qDigits = q.replace(/\D/g, '')
    const qClean = q.replace(/[^a-z0-9]/g, '')
    if (selectedCompany && (c.empresa_razon_social || c.nombre_completo || '') === corpSearch) return true;

    const razon = (c.empresa_razon_social || c.razon_social || '').toLowerCase();
    const nom = (c.nombre_completo || '').toLowerCase();
    const persona = `${c.nombres || ''} ${c.apellidos || ''}`.trim().toLowerCase();
    const rep = (c.representante_legal || c.representante_nombre || '').toLowerCase();

    const rifRaw = (c.empresa_rif_numero || c.rif_numero || c.cedula || '').toLowerCase();
    const rifTipo = (c.empresa_rif_tipo || c.rif_tipo || '').toLowerCase();
    const rifDigits = rifRaw.replace(/\D/g, '');
    const rifClean = `${rifTipo}${rifRaw}`.replace(/[^a-z0-9]/g, '');

    const cod = (c.codigo || c.empresa_codigo || '').toLowerCase();
    const codClean = cod.replace(/[^a-z0-9]/g, '');

    const matchNombre = razon.includes(q) || nom.includes(q) || persona.includes(q) || rep.includes(q);
    const matchCod = cod.includes(q) || (qClean !== '' && codClean.includes(qClean));
    const matchRif = rifRaw.includes(q) ||
                     rifClean.includes(qClean) ||
                     (qDigits.length >= 2 && rifDigits.includes(qDigits));

    if (corpSearchField === 'rif') return matchRif || matchNombre || matchCod;
    if (corpSearchField === 'codigo') return matchCod || matchNombre || matchRif;
    return matchNombre || matchRif || matchCod;
  })

  return (
    <div className="space-y-2 w-full">
      <div className="relative flex items-center bg-slate-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-colors h-10">
        <div className="relative shrink-0 border-r border-gray-200/80 h-full flex items-center">
          <button
            type="button"
            onClick={() => setShowCorpDropdown(!showCorpDropdown)}
            className="flex items-center gap-0.5 px-3 h-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
          >
            <span>
              {corpSearchField === 'nombre' && 'Nombre'}
              {corpSearchField === 'rif' && 'RIF'}
              {corpSearchField === 'codigo' && 'Código'}
            </span>
            <ChevronDown size={12} className={`text-slate-400 transition-transform ${showCorpDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showCorpDropdown && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowCorpDropdown(false)} />
              <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[110px] fade-in slide-in-from-top-1 duration-200">
                {([
                  { key: 'nombre' as const, label: 'Nombre' },
                  { key: 'rif' as const, label: 'RIF' },
                  { key: 'codigo' as const, label: 'Código' },
                ]).map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => { setCorpSearchField(option.key); setShowCorpDropdown(false); setCorpSearch(''); onSelect(null); }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${corpSearchField === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative flex-grow h-full flex items-center">
          <Search className="absolute left-3 text-slate-400" size={14} />
          <input
            type="text"
            value={corpSearch}
            onChange={(e) => { setCorpSearch(e.target.value); setShowCorpResults(true); }}
            onFocus={() => setShowCorpResults(true)}
            placeholder={placeholder}
            className="w-full h-full pl-9 pr-8 bg-transparent text-xs font-semibold placeholder-slate-400 outline-none text-slate-800"
          />
          {corpSearch && (
            <button
              type="button"
              onClick={() => { setCorpSearch(''); onSelect(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {selectedCompany && (
        <div className="flex items-center gap-3 px-3.5 py-2 bg-emerald-50/80 border border-emerald-100 rounded-xl">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-900 truncate">{selectedCompany.empresa_razon_social || selectedCompany.nombre_completo}</p>
            <p className="text-[10px] text-emerald-600 font-bold truncate">RIF: {selectedCompany.empresa_rif_numero || selectedCompany.cedula}{selectedCompany.codigo ? ` · Cód: ${selectedCompany.codigo}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); setCorpSearch(''); }}
            className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center hover:bg-emerald-300 transition-colors shrink-0"
          >
            <X size={10} />
          </button>
        </div>
      )}

      <div className={`transition-colors duration-500 ease-in-out ${
        showCorpResults && corpSearch.trim() && !selectedCompany
          ? 'max-h-48 opacity-100 mt-1.5 border border-gray-200 pointer-events-auto'
          : 'max-h-0 opacity-0 mt-0 border-transparent overflow-hidden pointer-events-none'
      } relative z-10 w-full bg-white rounded-xl shadow-inner overflow-y-auto py-1.5`}>
        {filteredCompanies.length === 0 ? (
          <p className="px-4 py-3 text-xs text-slate-400 font-bold text-center">Sin resultados</p>
        ) : (
          filteredCompanies.slice(0, 10).map((c) => (
            <button
              key={c.id_afiliado}
              type="button"
              onClick={() => {
                onSelect(c.id_empresa ?? c.id_afiliado ?? null)
                setCorpSearch(c.empresa_razon_social || c.nombre_completo || '')
                setShowCorpResults(false)
              }}
              className="w-full text-left px-4 py-2 hover:bg-emerald-50/50 transition-colors flex items-center gap-3 group"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                <Building2 size={13} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div className="min-w-0 flex-grow">
                <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 transition-colors truncate">{c.empresa_razon_social || c.nombre_completo}</p>
                <p className="text-[10px] text-slate-500 font-bold truncate">RIF: {c.empresa_rif_numero || c.cedula}{c.codigo ? ` · Cód: ${c.codigo}` : ''}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

