import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Search, X, ChevronDown } from 'lucide-react';

export interface EmpresaSearchItem {
  id_empresa: number | string;
  razon_social?: string;
  empresa_razon_social?: string;
  nombre_completo?: string;
  rif_tipo?: string;
  empresa_rif_tipo?: string;
  rif_numero?: string;
  empresa_rif_numero?: string;
  representante_legal?: string;
  representante_nombre?: string;
  codigo?: string;
  empresa_codigo?: string;
}

interface Props {
  empresas: EmpresaSearchItem[];
  selectedId: string | number | null | undefined;
  onSelect: (id: string, company?: EmpresaSearchItem | null) => void;
  placeholder?: string;
  darkTheme?: boolean;
}

const removeAccents = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

export default function CompanySearchSelector({
  empresas,
  selectedId,
  onSelect,
  placeholder,
  darkTheme = false
}: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchField, setSearchField] = useState<'nombre' | 'rif' | 'codigo'>('nombre');
  const [isOpen, setIsOpen] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const selectedCompany = useMemo(() => {
    if (!selectedId) return null;
    return empresas.find(e => String(e.id_empresa) === String(selectedId)) || null;
  }, [empresas, selectedId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (selectedCompany) {
      setQuery(selectedCompany.razon_social || selectedCompany.empresa_razon_social || selectedCompany.nombre_completo || '');
    }
  }, [selectedCompany]);

  const normalizedEmpresas = useMemo(() => {
    return empresas.map((emp: EmpresaSearchItem) => {
      const nombre = removeAccents(emp.razon_social || emp.empresa_razon_social || emp.nombre_completo || '');
      const rep = removeAccents(emp.representante_legal || emp.representante_nombre || '');
      const rifTipo = removeAccents(emp.rif_tipo || emp.empresa_rif_tipo || '');
      const rifNum = removeAccents(emp.rif_numero || emp.empresa_rif_numero || '');
      const rifDigits = rifNum.replace(/\D/g, '');
      const rifClean = `${rifTipo}${rifNum}`.replace(/[^a-z0-9]/g, '');
      const cod = removeAccents(emp.codigo || emp.empresa_codigo || '');
      const codClean = cod.replace(/[^a-z0-9]/g, '');

      return {
        ...emp,
        _searchNombre: `${nombre} ${rep}`,
        _searchRif: `${rifTipo} ${rifNum} ${rifClean}`,
        _rifDigits: rifDigits,
        _searchCod: `${cod} ${codClean}`,
        _displayNombre: emp.razon_social || emp.empresa_razon_social || emp.nombre_completo || 'Empresa Sin Nombre',
        _displayRifTipo: emp.rif_tipo || emp.empresa_rif_tipo || 'J',
        _displayRifNum: emp.rif_numero || emp.empresa_rif_numero || '',
        _displayRep: emp.representante_legal || emp.representante_nombre || '',
        _displayCod: emp.codigo || emp.empresa_codigo || ''
      };
    });
  }, [empresas]);

  const filteredEmpresas = useMemo(() => {
    if (!debouncedQuery.trim()) return normalizedEmpresas;
    const q = removeAccents(debouncedQuery.trim());
    const qDigits = q.replace(/\D/g, '');
    const qClean = q.replace(/[^a-z0-9]/g, '');

    return normalizedEmpresas.filter((emp: any) => {
      if (selectedCompany && String(emp.id_empresa) === String(selectedCompany.id_empresa)) return true;

      const matchNombre = emp._searchNombre.includes(q);
      const matchCod = emp._searchCod.includes(q) || (qClean !== '' && emp._searchCod.includes(qClean));
      const matchRif = emp._searchRif.includes(q) ||
                       (qClean !== '' && emp._searchRif.includes(qClean)) ||
                       (qDigits.length >= 2 && emp._rifDigits.includes(qDigits));

      if (searchField === 'rif') {
        return matchRif || matchNombre || matchCod;
      }
      if (searchField === 'codigo') {
        return matchCod || matchNombre || matchRif;
      }
      return matchNombre || matchRif || matchCod;
    });
  }, [normalizedEmpresas, debouncedQuery, searchField, selectedCompany]);

  const defaultPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    if (searchField === 'nombre') return 'Buscar por empresa o representante legal...';
    if (searchField === 'rif') return 'Buscar por número de RIF (ej. J-30456789-0)...';
    return 'Buscar por código del representante legal...';
  }, [placeholder, searchField]);

  return (
    <div className="space-y-2.5 w-full">
      <div className={`relative flex items-center border rounded-2xl transition-colors h-12 ${
        darkTheme
          ? 'bg-slate-900/60 border-emerald-500/30 focus-within:ring-4 focus-within:ring-emerald-500/20 focus-within:border-emerald-400'
          : 'bg-slate-50 border-gray-200 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500'
      }`}>
        {/* Criterion Selector */}
        <div className={`relative shrink-0 border-r h-full flex items-center ${
          darkTheme ? 'border-emerald-500/20' : 'border-gray-200/80'
        }`}>
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex items-center gap-1 px-3.5 h-full text-[11px] font-black uppercase tracking-wider transition-colors ${
              darkTheme ? 'text-emerald-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>
              {searchField === 'nombre' && 'Nombre'}
              {searchField === 'rif' && 'RIF'}
              {searchField === 'codigo' && 'Código'}
            </span>
            <ChevronDown size={13} className={`text-slate-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowFilterDropdown(false)} />
              <div className={`absolute left-0 top-full mt-1 border rounded-xl shadow-xl py-1 z-50 min-w-[120px] animate-in fade-in slide-in-from-top-1 duration-200 ${
                darkTheme ? 'bg-[#022c22] border-emerald-500/40 text-white' : 'bg-white border-gray-100 text-slate-800'
              }`}>
                {([
                  { key: 'nombre' as const, label: 'Nombre' },
                  { key: 'rif' as const, label: 'RIF' },
                  { key: 'codigo' as const, label: 'Código' },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setSearchField(opt.key);
                      setShowFilterDropdown(false);
                      setQuery('');
                      onSelect('', null);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
                      searchField === opt.key
                        ? (darkTheme ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                        : (darkTheme ? 'text-slate-300 hover:bg-emerald-900/30' : 'text-slate-600 hover:bg-slate-50')
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Input */}
        <div className="relative flex-grow h-full flex items-center">
          <Search className={`absolute left-3.5 ${darkTheme ? 'text-emerald-400/60' : 'text-slate-400'}`} size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              if (selectedCompany && e.target.value !== (selectedCompany.razon_social || selectedCompany.empresa_razon_social)) {
                onSelect('', null);
              }
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={defaultPlaceholder}
            className={`w-full h-full pl-10 pr-9 bg-transparent text-xs font-semibold outline-none ${
              darkTheme ? 'text-white placeholder-emerald-100/40' : 'text-slate-800 placeholder-slate-400'
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onSelect('', null);
                setIsOpen(false);
              }}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                darkTheme ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Selected Card */}
      {selectedCompany && (
        <div className={`flex items-center justify-between gap-3 p-3.5 border rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-200 ${
          darkTheme
            ? 'bg-slate-800/90 border-emerald-500/40 text-white'
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              darkTheme 
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                : 'bg-emerald-50 border-emerald-200/60 text-emerald-600'
            }`}>
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-black uppercase tracking-tight truncate ${darkTheme ? 'text-white' : 'text-slate-900'}`}>
                {selectedCompany.razon_social || selectedCompany.empresa_razon_social || selectedCompany.nombre_completo}
              </p>
              <p className={`text-[10px] font-semibold truncate mt-0.5 ${darkTheme ? 'text-emerald-300/90' : 'text-slate-500'}`}>
                {(selectedCompany.representante_legal || selectedCompany.representante_nombre) ? `Rep: ${selectedCompany.representante_legal || selectedCompany.representante_nombre} · ` : ''}
                <span className="font-bold text-slate-700">RIF: {selectedCompany.rif_tipo || selectedCompany.empresa_rif_tipo || 'J'}-{selectedCompany.rif_numero || selectedCompany.empresa_rif_numero || '—'}</span>
                {(selectedCompany.codigo || selectedCompany.empresa_codigo) ? ` · Cód. Rep: ${selectedCompany.codigo || selectedCompany.empresa_codigo}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect('', null);
              setQuery('');
              setIsOpen(true);
            }}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 border ${
              darkTheme 
                ? 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-200 border-emerald-500/30' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && !selectedCompany && (
        <>
          <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setIsOpen(false)} />
          <div className={`relative z-40 w-full border rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto divide-y animate-in fade-in duration-150 ${
            darkTheme
              ? 'bg-[#022c22] border-emerald-500/30 divide-emerald-500/10 text-white'
              : 'bg-white border-slate-200 divide-slate-100 text-slate-800'
          }`}>
            {filteredEmpresas.length === 0 ? (
              <div className="p-4 text-center">
                <p className={`text-xs font-bold ${darkTheme ? 'text-emerald-100/40' : 'text-slate-400'}`}>No se encontraron empresas coincidentes</p>
                <p className={`text-[10px] mt-1 ${darkTheme ? 'text-emerald-100/30' : 'text-slate-400'}`}>
                  {searchField === 'nombre'
                    ? 'Prueba buscando por empresa o representante legal'
                    : searchField === 'codigo'
                    ? 'Prueba buscando por código del representante legal'
                    : `Prueba buscando por ${searchField}`}
                </p>
              </div>
            ) : (
              filteredEmpresas.slice(0, 15).map(emp => (
                <button
                  key={emp.id_empresa}
                  type="button"
                  onClick={() => {
                    onSelect(String(emp.id_empresa), emp);
                    setQuery(emp._displayNombre);
                    setIsOpen(false);
                  }}
                  className={`w-full p-3 text-left transition-colors flex items-center gap-3 group ${
                    darkTheme ? 'hover:bg-emerald-900/40' : 'hover:bg-emerald-50/60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    darkTheme
                      ? 'bg-emerald-900/40 group-hover:bg-emerald-500/30 text-emerald-400'
                      : 'bg-slate-100 group-hover:bg-emerald-100 text-slate-400 group-hover:text-emerald-700'
                  }`}>
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h6 className={`text-xs font-black uppercase tracking-tight truncate transition-colors ${
                      darkTheme ? 'text-white group-hover:text-emerald-300' : 'text-slate-800 group-hover:text-emerald-950'
                    }`}>
                      {emp._displayNombre}
                    </h6>
                    <p className={`text-[10px] font-bold truncate mt-0.5 transition-colors ${
                      darkTheme ? 'text-emerald-100/50 group-hover:text-emerald-200' : 'text-slate-400 group-hover:text-emerald-700'
                    }`}>
                      {emp._displayRep ? `Rep: ${emp._displayRep} · ` : ''}RIF: {emp._displayRifTipo}-{emp._displayRifNum}
                      {emp._displayCod ? ` · Cód. Rep: ${emp._displayCod}` : ''}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
