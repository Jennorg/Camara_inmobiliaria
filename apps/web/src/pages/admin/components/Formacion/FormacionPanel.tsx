import React, { useState } from 'react'
import CursosAdminPanel from './CursosAdminPanel'
import EdicionesCibirPanel from './EdicionesCibirPanel'
import { GraduationCap, Award } from 'lucide-react'

// ─── MAIN FORMACION PANEL ─────────────────────────────────────────────────────

const FormacionPanel = () => {
  const [activeTab, setActiveTab] = useState<'cursos' | 'cibir'>('cursos')

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full min-w-0 overflow-hidden">
      {/* Selector de subpestañas */}
      <div className="px-4 sm:px-6 pt-3 pb-1 bg-white border-b border-slate-200/80 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setActiveTab('cursos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'cursos'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <GraduationCap size={15} />
          Cursos y Talleres
        </button>

        <button
          onClick={() => setActiveTab('cibir')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'cibir'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Award size={15} />
          Ediciones CIBIR
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === 'cursos' ? <CursosAdminPanel /> : <EdicionesCibirPanel />}
      </div>
    </div>
  )
}

export default FormacionPanel
