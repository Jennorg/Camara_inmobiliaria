import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, ChevronDown, Users, Loader2 } from 'lucide-react';
import SEO from '@/components/SEO';
import { AfiliadoCard, AfiliadoData } from './components/AfiliadoCard';
import Navbar from '@/pages/landing/components/navbar/Navbar';
import Footer from '@/pages/landing/components/Footer';
import { API_URL } from '@/config/env';

const PAGE_SIZE = 20;

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/** Debounce hook: returns debounced value after `delay` ms of inactivity */
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
  const [afiliados, setAfiliados] = useState<AfiliadoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [filterType, setFilterType] = useState<'Todos' | 'Natural' | 'Corporativo' | 'Agente'>('Todos');
  const [visibleCount, setVisibleCount] = useState(20);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const debouncedSearch = useDebounce(searchQuery, 350);

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
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // ── Fetch all afiliados from the API on mount ───────────────────
  const fetchAllAfiliados = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/public/afiliados/buscar?limit=1000&con_foto=true`);
      const json = await res.json();
      if (json.success) {
        setAfiliados(json.data);
      }
    } catch (error) {
      console.error('Error cargando el directorio:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllAfiliados();
  }, [fetchAllAfiliados]);

  // Reset local pagination when query or filter changes
  useEffect(() => {
    setVisibleCount(20);
  }, [debouncedSearch, filterType]);

  const cleanString = (str: string): string => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  const resultados = useMemo(() => {
    const query = cleanString(searchQuery);

    const filtered = afiliados.filter(item => {
      // 1. Filtrar por tipo (filterType)
      if (filterType !== 'Todos') {
        const itemType = (item.tipo_afiliado || 'Natural').toLowerCase().trim();
        const targetType = filterType.toLowerCase().trim();
        if (targetType === 'agente') {
          if (itemType !== 'agente corporativo' && itemType !== 'agente') {
            return false;
          }
        } else if (itemType !== targetType) {
          return false;
        }
      }

      // 2. Filtrar por búsqueda
      if (query) {
        const nom = cleanString(item.nombre_completo || '');
        const rep = cleanString(item.representante_nombre || '');
        const emp = cleanString(item.empresa_razon_social || '');
        return nom.includes(query) || rep.includes(query) || emp.includes(query);
      }

      return true;
    });

    // Ordenar por código (codigo) de forma numérica. Items sin código van al final.
    return [...filtered].sort((a, b) => {
      const codeA = a.codigo ? parseInt(a.codigo, 10) : Infinity;
      const codeB = b.codigo ? parseInt(b.codigo, 10) : Infinity;
      if (isNaN(codeA) && isNaN(codeB)) return 0;
      if (isNaN(codeA)) return 1;
      if (isNaN(codeB)) return -1;
      return codeA - codeB;
    });
  }, [afiliados, searchQuery, filterType]);

  // ── Infinite scroll: load next page ───────────────────────────────
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < resultados.length) {
        setVisibleCount(prev => prev + 20);
      }
    }, { rootMargin: '400px' });

    if (node) observer.current.observe(node);
  }, [loading, visibleCount, resultados.length]);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${darkMode ? 'dark bg-[#022c22] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <SEO
        title="Directorio de Miembros"
        description="Encuentra a los profesionales inmobiliarios certificados en el Estado Bolívar. Consulta nuestro directorio de agentes y corporativos."
      />
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <main className="flex-grow pt-24 pb-20">

        {/* Cabecera Estructurada */}
        <section className="bg-emerald-50/50 dark:bg-[#011a14] pt-12 pb-24 px-6 relative border-b border-emerald-100 dark:border-emerald-500/10">
          <div className="max-w-4xl mx-auto relative z-10 text-center space-y-5">

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#022c22] dark:text-white">
              Nuestros Miembros
            </h1>
            <p className="text-lg text-emerald-800/70 dark:text-emerald-100/70 max-w-2xl mx-auto font-medium">
              Verifica y contacta a los profesionales inmobiliarios certificados que forman parte de nuestra cámara.
            </p>

            {/* Buscador y Filtros */}
            <div className="relative w-full max-w-4xl px-6 space-y-6 mx-auto mt-8">
              <div className="flex items-center rounded-[2rem] bg-white dark:bg-[#04432f] shadow-xl shadow-slate-200/50 dark:shadow-2xl border-2 border-transparent focus-within:border-emerald-500 transition-all text-lg h-[68px] relative z-30">
                <div className="relative flex-grow h-full flex items-center">
                  <div className="absolute left-6 pointer-events-none text-slate-400 dark:text-emerald-100/40">
                    <Search size={22} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre completo o empresa..."
                    className="w-full h-full pl-16 pr-24 bg-transparent text-slate-800 dark:text-emerald-50 font-bold placeholder-slate-400 outline-none text-lg"
                  />
                  
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
                    { id: 'Todos', label: 'Todos' },
                    { id: 'Natural', label: 'Agentes Independientes' },
                    { id: 'Corporativo', label: 'Corporativos' },
                    { id: 'Agente', label: 'Agentes Corporativos' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilterType(f.id as any)}
                      className={`flex-shrink-0 px-4 md:px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center text-center ${filterType === f.id
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-105'
                          : 'bg-white dark:bg-[#04432f] text-slate-500 dark:text-emerald-100/50 border border-slate-200 dark:border-emerald-500/10 hover:border-emerald-500/30'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Results Section */}
        <section className="max-w-[1600px] mx-auto px-6 pt-10 pb-16">
          {loading ? (
            /* Skeleton grid while first page loads */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : resultados.length > 0 ? (
            <>
              <div className={`grid grid-cols-1 ${
                resultados.length === 1 ? 'max-w-sm mx-auto' :
                resultados.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' :
                resultados.length === 3 ? 'sm:grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto' :
                resultados.length === 4 ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-6xl mx-auto' :
                'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 w-full'
              } gap-4 md:gap-6 justify-center`}>
                {resultados.slice(0, visibleCount).map((afiliado) => (
                  <AfiliadoCard key={afiliado.id_afiliado} afiliado={afiliado} />
                ))}
              </div>
              {visibleCount < resultados.length && (
                <div ref={lastElementRef} className="h-20 flex items-center justify-center mt-12 w-full col-span-full">
                  <Loader2 size={32} className="animate-spin text-emerald-600" />
                </div>
              )}
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
