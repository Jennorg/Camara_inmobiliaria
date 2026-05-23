import React from 'react';
import { GraduationCap, Briefcase, User, Building2, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { AfiliadoData } from '../AfiliadoCard';
import { InfoCard } from './InfoCard';
import { formatRif } from '@/utils/formatters';

interface DataSectionsProps {
  afiliado: AfiliadoData;
  isCorporativo: boolean;
  isRepMode: boolean;
  ubicacionTexto: string;
  showEmpresaSection: boolean;
  showAfiliadoSection: boolean;
}

export const DataSections = ({ 
  afiliado, 
  isCorporativo, 
  isRepMode,
  ubicacionTexto, 
  showEmpresaSection, 
  showAfiliadoSection
}: DataSectionsProps) => {

  const renderDatosSections = () => (
    <div className="space-y-8 w-full">
      {showEmpresaSection && (
        <section className="bg-white dark:bg-[#04432f]/50 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-emerald-500/10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
              <Building2 size={14} className="text-emerald-500" />
            </div>
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Información de la Empresa</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
            {afiliado.empresa_rif_numero && (
              <InfoCard icon={Globe} label="RIF" variant="compact">
                {formatRif(afiliado.empresa_rif_tipo || 'J', afiliado.empresa_rif_numero)}
              </InfoCard>
            )}
            <InfoCard icon={User} label="Código de Afiliado" variant="compact">
              {afiliado.codigo_cibir || 'En proceso'}
            </InfoCard>
            {(afiliado.empresa_email || (isCorporativo && afiliado.email)) && (
              <InfoCard icon={Mail} label="Correo" variant="compact">
                <a href={`mailto:${afiliado.empresa_email || afiliado.email}`} className="hover:underline">
                  {afiliado.empresa_email || afiliado.email}
                </a>
              </InfoCard>
            )}
            {(afiliado.empresa_telefono || (isCorporativo && afiliado.telefono)) && (
              <InfoCard icon={Phone} label="Teléfono" variant="compact">
                <a href={`tel:${afiliado.empresa_telefono || afiliado.telefono}`} className="hover:underline">
                  {afiliado.empresa_telefono || afiliado.telefono}
                </a>
              </InfoCard>
            )}
            {afiliado.empresa_website && (
              <InfoCard icon={Globe} label="Sitio Web" variant="compact">
                <a href={afiliado.empresa_website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {afiliado.empresa_website}
                </a>
              </InfoCard>
            )}
            <InfoCard icon={MapPin} label="Ubicación" variant="compact">
              {ubicacionTexto}
            </InfoCard>
          </div>

          {isCorporativo && !isRepMode && (afiliado.email || afiliado.telefono || afiliado.cedula) && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-emerald-500/10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Representante Legal</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                {afiliado.cedula && (
                  <InfoCard icon={Globe} label="Cédula" variant="compact">
                    {afiliado.cedula}
                  </InfoCard>
                )}
                {afiliado.email && (
                  <InfoCard icon={Mail} label="Correo" variant="compact">
                    <a href={`mailto:${afiliado.email}`} className="hover:underline">
                      {afiliado.email}
                    </a>
                  </InfoCard>
                )}
                {afiliado.telefono && (
                  <InfoCard icon={Phone} label="Teléfono" variant="compact">
                    <a href={`tel:${afiliado.telefono}`} className="hover:underline">
                      {afiliado.telefono}
                    </a>
                  </InfoCard>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {showAfiliadoSection && (
        <section className="bg-white dark:bg-[#04432f]/50 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-emerald-500/10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
              <User size={14} className="text-emerald-500" />
            </div>
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">
              {isRepMode ? 'Datos del Representante' : 'Datos del Afiliado'}
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
            {afiliado.cedula && (
              <InfoCard icon={Globe} label="Cédula" variant="compact">
                {afiliado.cedula}
              </InfoCard>
            )}
            {!isCorporativo && (
              <InfoCard icon={User} label="Código" variant="compact">
                {afiliado.codigo_cibir || 'En proceso'}
              </InfoCard>
            )}
            {afiliado.email && (
              <InfoCard icon={Mail} label="Correo" variant="compact">
                <a href={`mailto:${afiliado.email}`} className="hover:underline">
                  {afiliado.email}
                </a>
              </InfoCard>
            )}
            {afiliado.telefono && (
              <InfoCard icon={Phone} label="Teléfono" variant="compact">
                <a href={`tel:${afiliado.telefono}`} className="hover:underline">
                  {afiliado.telefono}
                </a>
              </InfoCard>
            )}
            {afiliado.website && (
              <InfoCard icon={Globe} label="Sitio Web" variant="compact">
                <a href={afiliado.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {afiliado.website}
                </a>
              </InfoCard>
            )}
            {!isCorporativo && (
              <InfoCard icon={MapPin} label="Ubicación" variant="compact">
                {ubicacionTexto}
              </InfoCard>
            )}
          </div>
        </section>
      )}
    </div>
  );

  return renderDatosSections();
};


