import React, { useState } from 'react'
import CursosAdminPanel from './CursosAdminPanel'
import AprobarCursosPanel from './AprobarCursosPanel'

// ─── MAIN FORMACION PANEL ─────────────────────────────────────────────────────
type SubTab = 'cursos' | 'aprobar'

const FormacionPanel = () => {
  const [activeTab, setActiveTab] = useState<SubTab>('cursos')

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'cursos', label: 'Cursos & Talleres' },
    { id: 'aprobar', label: 'Inscritos & Evaluaciones' },
  ]


  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-1 px-4 sm:px-5 pt-4 pb-0 bg-white border-b border-gray-100 flex-shrink-0 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === tab.id
                ? 'text-[#00B870] border-[#00D084] bg-[#E9FAF4]'
                : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden">
        {activeTab === 'cursos' && <CursosAdminPanel />}
        {activeTab === 'aprobar' && <AprobarCursosPanel />}
      </div>
    </div>
  )
}

export default FormacionPanel
