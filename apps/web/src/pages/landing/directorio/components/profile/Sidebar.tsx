import React from 'react';
import { AfiliadoData } from '../components/AfiliadoCard';
import { DataSections } from './DataSections';

interface SidebarProps {
  afiliado: AfiliadoData;
  isCorporativo: boolean;
  ubicacionTexto: string;
  showEmpresaSection: boolean;
  showAfiliadoSection: boolean;
  isRepMode: boolean;
}

export const Sidebar = ({ 
  afiliado, 
  isCorporativo, 
  ubicacionTexto, 
  showEmpresaSection, 
  showAfiliadoSection,
  isRepMode
}: SidebarProps) => {
  return (
    <aside className="lg:col-span-5 w-full">
      <DataSections 
        afiliado={afiliado}
        isCorporativo={isCorporativo}
        isRepMode={isRepMode}
        ubicacionTexto={ubicacionTexto}
        showEmpresaSection={showEmpresaSection}
        showAfiliadoSection={showAfiliadoSection}
      />
    </aside>
  );
};
