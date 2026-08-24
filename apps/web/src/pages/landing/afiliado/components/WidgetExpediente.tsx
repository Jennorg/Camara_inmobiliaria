import React, { useEffect, useState } from 'react';
import { FileText, Download, ExternalLink, FileCheck, FileImage, FileBox, Loader2, Calendar } from 'lucide-react';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import { apiFetch } from '@/lib/apiClient';

import WidgetSolicitudCambioEstado from './WidgetSolicitudCambioEstado';

interface Documento {
  id_documento: number;
  tipo_doc: string;
  url: string;
  nombre_archivo: string;
  creado_en: string;
}

const TIPO_LABELS: Record<string, string> = {
  cv: 'Currículum Vitae',
  titulo: 'Título Profesional',
  registro_mercantil: 'Registro Mercantil',
  titulo_representante: 'Título de Representante',
  especializacion: 'Especialización',
  curso_extra: 'Curso Adicional',
  diplomado: 'Diplomado',
  referencia_afiliado_1: 'Referencia Gremial 1',
  referencia_afiliado_2: 'Referencia Gremial 2',
  otro_documento: 'Otros Documentos',
};

const getFileIcon = (url: string) => {
  const ext = url.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return FileImage;
  if (ext === 'pdf') return FileCheck;
  return FileText;
};

const WidgetExpediente = () => {
  const { user, token, isLoading: authLoading } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!token || !user?.id_afiliado) {
      setDocumentos([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchDocs = async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted) {
          if (data.success && data.data) {
            setDocumentos(data.data.documentos || []);
          } else {
            setDocumentos([]);
          }
        }
      } catch (err) {
        console.error('Error fetching dossier documents:', err);
        if (isMounted) setDocumentos([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDocs();

    return () => {
      isMounted = false;
    };
  }, [user?.id_afiliado, token, authLoading]);

  return (
    <div className="space-y-6">
      {loading || authLoading ? (
        <DashboardCard title="Mi Expediente Digital" icon={FileText} description="Documentación cargada en el sistema">
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
          </div>
        </DashboardCard>
      ) : documentos.length === 0 ? (
        <DashboardCard title="Mi Expediente Digital" icon={FileText} description="Documentación cargada en el sistema">
          <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-white border border-gray-100 rounded-2xl">
            <FileBox size={48} className="text-gray-200 mb-4" />
            <p className="font-medium text-lg">No hay documentos cargados.</p>
            <p className="text-sm mt-1">Aquí aparecerán tus títulos, CV y otros requisitos una vez los subas en una inscripción.</p>
          </div>
        </DashboardCard>
      ) : (
        <DashboardCard title="Mi Expediente Digital" icon={FileText} description="Documentación académica y legal cargada">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documentos.map((doc) => {
              const Icon = getFileIcon(doc.url);
              const label = TIPO_LABELS[doc.tipo_doc] || doc.tipo_doc;
              const date = doc.creado_en 
                ? new Date(doc.creado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Fecha no registrada';

              return (
                <div 
                  key={doc.id_documento}
                  className="group relative flex items-center gap-4 p-4 bg-gray-50/50 hover:bg-white border border-gray-100 rounded-2xl transition-colors hover:shadow-md hover:border-emerald-100"
                >
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-xs border border-gray-100 group-hover:scale-110 transition-transform">
                    <Icon size={24} />
                  </div>

                  <div className="flex-grow min-w-0">
                    <h4 className="text-sm font-black text-gray-900 truncate uppercase tracking-tight">{label}</h4>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-gray-400">
                      <Calendar size={12} className="shrink-0" />
                      <span>Cargado el {date}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-xs transition-colors"
                      title="Ver documento"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <a 
                      href={doc.url} 
                      download
                      className="p-2.5 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-xs transition-colors"
                      title="Descargar"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCard>
      )}
      <WidgetSolicitudCambioEstado />
    </div>
  );
};

export default WidgetExpediente;
