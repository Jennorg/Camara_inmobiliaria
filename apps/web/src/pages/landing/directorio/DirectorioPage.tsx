import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Users, Loader2, ChevronDown, X } from 'lucide-react';
import SEO from '@/components/SEO';
import { AfiliadoCard, AfiliadoData } from './components/AfiliadoCard';
import Navbar from '@/pages/landing/components/navbar/Navbar';
import Footer from '@/pages/landing/components/Footer';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const PAGE_SIZE = 50;

/** Debounce hook */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Skeleton card placeholder shown during loading */
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#04432f] rounded-[1.25rem] overflow-hidden border border-slate-200 dark:border-emerald-500/20 shadow-sm animate-pulse">
      <div className="w-full h-96 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-[#04432f] dark:via-[#033d28] dark:to-[#04432f]" />
      <div className="p-4 pt-5 pb-5 space-y-3">
        <div className="h-5 bg-slate-200 dark:bg-emerald-900/40 rounded-lg w-3/4 mx-auto" />
        <div className="h-3 bg-slate-100 dark:bg-emerald-900/20 rounded-lg w-1/2 mx-auto" />
        <div className="h-3 bg-slate-100 dark:bg-emerald-900/20 rounded-lg w-1/3 mx-auto" />
      </div>
    </div>
  );
}

const DirectorioPage = () => {
  const { user } = useAuth();
  const [afiliados, setAfiliados] = useState<AfiliadoData[]>([]);
  // true only on first page load (shows full skeleton grid)
  const [loadingFirst, setLoadingFirst] = useState(true);
  // true when fetching subsequent pages (shows bottom spinner)
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'nombre' | 'id' | 'codigo'>('nombre');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [filterType, setFilterType] = useState<'Todos' | 'Natural' | 'Corporativo' | 'Agente'>('Todos');
  const [counts, setCounts] = useState<{ total: number; natural: number; corporativo: number; agente: number }>({
    total: 0,
    natural: 0,
    corporativo: 0,
    agente: 0,
  });

  const debouncedSearch = useDebounce(searchQuery, 400);

  // Horizontal scroll drag for filter pills
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeft - (x - startX) * 2;
  };

  // ── Build query string from current filters ─────────────────────────
  const buildQueryString = useCallback((targetPage: number) => {
    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('limit', String(PAGE_SIZE));
    params.set('con_foto', 'true');
    if (debouncedSearch.trim()) {
      params.set('search', debouncedSearch.trim());
      params.set('search_field', searchField);
    }
    if (filterType !== 'Todos') params.set('tipo_afiliado', filterType);
    return params.toString();
  }, [debouncedSearch, searchField, filterType]);

  // ── Fetch a single page and append to list ──────────────────────────
  const fetchPage = useCallback(async (targetPage: number, reset: boolean) => {
    if (reset) {
      setLoadingFirst(true);
      setAfiliados([]);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const qs = buildQueryString(targetPage);
      const res = await fetch(`${API_URL}/api/public/afiliados/buscar?${qs}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();

      if (json.success) {
        setAfiliados(prev => reset ? json.data : [...prev, ...json.data]);
        setHasMore(json.pagination?.hasMore ?? false);
        setPage(targetPage);
        if (json.counts) {
          setCounts(json.counts);
        }
      }
    } catch (error) {
      console.error('Error cargando el directorio:', error);
    } finally {
      setLoadingFirst(false);
      setLoadingMore(false);
    }
  }, [buildQueryString]);

  // ── Reset and reload when search/filter changes ──────────────────────
  useEffect(() => {
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterType]);



  // ── Infinite scroll: observe sentinel element ────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingFirst) {
          fetchPage(page + 1, false);
        }
      },
      { rootMargin: '400px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loadingFirst, page, fetchPage]);

  const gridCols = 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 w-full';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${darkMode ? 'dark bg-[#022c22] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <SEO
        title="Directorio de Miembros"
        description="Encuentra a los profesionales inmobiliarios certificados en el Estado Bolívar. Consulta nuestro directorio de agentes y corporativos."
      />
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <main className="flex-grow pt-24 pb-20">

        {/* Cabecera */}
        <section className="bg-emerald-50/50 dark:bg-[#011a14] pt-12 pb-24 px-6 relative border-b border-emerald-100 dark:border-emerald-500/10">
          <div className="max-w-4xl mx-auto relative z-10 text-center space-y-5">

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#022c22] dark:text-white">
              Nuestros Miembros
            </h1>
            <p className="text-lg text-emerald-800/70 dark:text-emerald-100/70 max-w-2xl mx-auto font-medium">
              Verifica y contacta a los profesionales inmobiliarios certificados que forman parte de nuestra cámara.
            </p>



            {/* Buscador */}
            <div className="relative w-full max-w-4xl px-6 space-y-6 mx-auto mt-8">
              <div className="flex items-center rounded-[2rem] bg-white dark:bg-[#04432f] shadow-xl shadow-slate-200/50 dark:shadow-2xl border-2 border-transparent focus-within:border-emerald-500 transition-colors text-lg h-[68px] relative z-30">
                {/* Dropdown de criterio de búsqueda */}
                <div className="relative shrink-0 border-r border-slate-200 dark:border-emerald-500/20 h-full flex items-center z-20 pl-6 pr-3">
                  <button
                    type="button"
                    onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-emerald-200 hover:text-emerald-600 dark:hover:text-white transition-colors"
                  >
                    <span>
                      {searchField === 'nombre' && 'Nombre'}
                      {searchField === 'id' && 'Cédula / RIF'}
                      {searchField === 'codigo' && 'Código'}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showSearchDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showSearchDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
                      <div className="transition-opacity transition-transform absolute left-6 top-full mt-2 bg-white dark:bg-[#04432f] border border-slate-200 dark:border-emerald-500/20 rounded-xl shadow-xl py-2 z-50 min-w-[140px] fade-in slide-in-from-top-1 duration-150">
                        {([
                          { key: 'nombre', label: 'Nombre' },
                          { key: 'id', label: 'Cédula / RIF' },
                          { key: 'codigo', label: 'Código' },
                        ] as const).map(option => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                              setSearchField(option.key);
                              setShowSearchDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${searchField === option.key
                                ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-600 dark:text-emerald-100/70 hover:bg-slate-50 dark:hover:bg-emerald-900/20'
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
                  <div className="absolute left-6 pointer-events-none text-slate-400 dark:text-emerald-100/40 hidden sm:block">
                    <Search size={22} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      searchField === 'nombre'
                        ? 'Buscar por nombre completo o empresa...'
                        : searchField === 'id'
                          ? 'Buscar por cédula o RIF (ej. 12345678)...'
                          : 'Buscar por código de miembro...'
                    }
                    className="w-full h-full pl-4 sm:pl-16 pr-24 bg-transparent text-slate-800 dark:text-emerald-50 font-bold placeholder-slate-400 outline-none text-base md:text-lg"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-16 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 dark:bg-emerald-900/50 text-slate-600 dark:text-emerald-200 flex items-center justify-center hover:bg-slate-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <div className="absolute right-6 flex items-center gap-2">
                    {filterType !== 'Todos' && (
                      <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-tighter bg-emerald-500 text-white px-2.5 py-1 rounded-md">
                        {filterType === 'Natural' ? 'Agentes Independientes' : filterType === 'Agente' ? 'Agentes Corporativos' : 'Corporativos'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Filtros de Tipo */}
              <div className="flex flex-col items-center gap-3 w-full">
                <div
                  ref={scrollRef}
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  className="flex flex-row items-center justify-start sm:justify-center gap-2 md:gap-3 w-full overflow-x-auto pb-2 px-2 scrollbar-hide cursor-grab active:cursor-grabbing"
                >
                  {[
                    { id: 'Todos', label: 'Todos', count: counts.total },
                    { id: 'Natural', label: 'Agentes Independientes', count: counts.natural },
                    { id: 'Corporativo', label: 'Corporativos', count: counts.corporativo },
                    { id: 'Agente', label: 'Agentes Corporativos', count: counts.agente },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilterType(f.id as any)}
                      className={`flex-shrink-0 px-4 md:px-5 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-colors duration-300 flex items-center justify-center text-center gap-1.5 ${filterType === f.id
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-105'
                          : 'bg-white dark:bg-[#04432f] text-slate-500 dark:text-emerald-100/50 border border-slate-200 dark:border-emerald-500/10 hover:border-emerald-500/30'
                        }`}
                    >
                      <span>{f.label}</span>
                      {f.count > 0 && (
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold transition-colors ${filterType === f.id
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-emerald-900/60 text-slate-600 dark:text-emerald-200'
                          }`}>
                          {f.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Results Section */}
        <section className="max-w-[1600px] mx-auto px-6 pt-10 pb-16">
          {loadingFirst ? (
            /* Skeleton grid while first page loads */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {Array.from({ length: 10 }).map((_, skelIdx) => (
                <SkeletonCard key={`dir-skel-${skelIdx}`} />
              ))}
            </div>
          ) : afiliados.length > 0 ? (
            <>
              {(debouncedSearch.trim() || filterType !== 'Todos') ? (
                <div className="flex flex-wrap justify-center gap-4 md:gap-6">
                  {afiliados.map((afiliado) => (
                    <div key={afiliado.id_afiliado} style={{ width: '280px', minWidth: '240px', maxWidth: '320px', flexShrink: 0 }}>
                      <AfiliadoCard afiliado={afiliado} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`grid grid-cols-1 ${gridCols} gap-4 md:gap-6`}>
                  {afiliados.map((afiliado) => (
                    <AfiliadoCard key={afiliado.id_afiliado} afiliado={afiliado} />
                  ))}
                </div>
              )}

              {/* Sentinel + bottom loader */}
              <div ref={sentinelRef} className="h-20 flex items-center justify-center mt-12 w-full">
                {loadingMore && (
                  <Loader2 size={32} className="animate-spin text-emerald-600" />
                )}
                {!hasMore && afiliados.length > 0 && (
                  <p className="text-sm text-slate-400 dark:text-emerald-100/30 font-medium">
                    — {afiliados.length} miembro{afiliados.length !== 1 ? 's' : ''} en total —
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-[#04432f] rounded-[2rem] border border-slate-200 dark:border-emerald-500/20 shadow-sm max-w-2xl mx-auto transition-colors mt-8">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-[#022c22] rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 dark:border-emerald-500/10">
                <Users size={32} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-emerald-50 mb-2">
                {searchQuery.trim()
                  ? 'No se encontraron resultados'
                  : filterType !== 'Todos'
                    ? `Sin miembros ${filterType === 'Natural' ? 'Agentes Independientes' : filterType === 'Agente' ? 'Agentes Corporativos' : 'Corporativos'}`
                    : 'Directorio vacío'}
              </h3>
              <p className="text-slate-500 dark:text-emerald-100/70 font-medium max-w-md mx-auto">
                {searchQuery.trim()
                  ? <>No pudimos encontrar coincidencias para "<strong>{searchQuery}</strong>". Revisa la ortografía o intenta buscar por Código o Cédula/RIF.</>
                  : filterType !== 'Todos'
                    ? `Actualmente no hay miembros de tipo ${filterType === 'Natural' ? 'Agente Independiente' : filterType === 'Agente' ? 'Agente Corporativo' : 'Corporativo'} registrados con estatus de Afiliación.`
                    : 'Actualmente no hay profesionales certificados registrados en esta lista pública.'}
              </p>
              {filterType !== 'Todos' && (
                <button
                  onClick={() => {
                    setFilterType('Todos');
                    setSearchQuery('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="mt-6 text-emerald-600 font-bold text-sm hover:underline"
                >
                  Ver todos los miembros
                </button>
              )}
            </div>
          )}
        </section>

      </main>

      <Footer />

    </div>
  );
};

export default DirectorioPage;
