import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { Search, MapPin, Building2, Filter, ChevronRight, User, Star, ShieldCheck, Users, Loader2 } from 'lucide-react';
import SEO from '@/components/SEO';
import { AfiliadoCard, AfiliadoData } from './components/AfiliadoCard';
import Navbar from '@/pages/landing/components/navbar/Navbar';
import Footer from '@/pages/landing/components/Footer';
import { Link } from 'react-router-dom';
import { API_URL } from '@/config/env';

const DirectorioPage = () => {
  const [afiliados, setAfiliados] = useState<AfiliadoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  const [filterType, setFilterType] = useState<'Todos' | 'Natural' | 'Corporativo' | 'Agente'>('Todos');
  const [visibleCount, setVisibleCount] = useState(30);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, filterType]);

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

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 30);
      }
    }, { rootMargin: '300px' });

    if (node) observer.current.observe(node);
  }, [loading]);

  useEffect(() => {
    const fetchAfiliados = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/afiliados/buscar`);
        const json = await res.json();
        if (json.success) {
          setAfiliados(json.data);
        }
      } catch (error) {
        console.error('Error cargando el directorio:', error);
      } finally {
        setLoading(false);
        // Force scroll to top after loading finishes and page grows
        window.scrollTo(0, 0);
      }
    };
    fetchAfiliados();
  }, []);

  const fuse = useMemo(() => new Fuse(afiliados, {
    keys: ['nombre_completo', 'codigo_cibir', 'cedula', 'empresa_rif_numero'],
    threshold: 0.25, // Un poco más estricto para evitar ruido en códigos numéricos
    ignoreLocation: true,
    minMatchCharLength: 1
  }), [afiliados]);

  const resultados = useMemo(() => {
    const query = searchQuery.trim();
    let base = query ? fuse.search(query).map(result => result.item) : afiliados;

    if (filterType !== 'Todos') {
      base = base.filter(a => {
        // Normalización extrema
        const itemType = String(a.tipo_afiliado || 'Natural').toLowerCase().trim();
        const targetType = String(filterType).toLowerCase().trim();
        if (targetType === 'agente') {
          return itemType === 'agente corporativo' || itemType === 'agente';
        }
        return itemType === targetType;
      });
    }

    // Ordenar por código (codigo_cibir) de forma numérica. Items sin código van al final.
    return [...base].sort((a, b) => {
      const codeA = a.codigo_cibir ? parseInt(a.codigo_cibir, 10) : Infinity;
      const codeB = b.codigo_cibir ? parseInt(b.codigo_cibir, 10) : Infinity;
      if (isNaN(codeA) && isNaN(codeB)) return 0;
      if (isNaN(codeA)) return 1;
      if (isNaN(codeB)) return -1;
      return codeA - codeB;
    });
  }, [searchQuery, afiliados, fuse, filterType]);

  // Depuración: contar tipos reales en la data
  const stats = useMemo(() => {
    const counts: Record<string, number> = { Natural: 0, Corporativo: 0, Agente: 0, Otros: 0 };
    afiliados.forEach(a => {
      const t = a.tipo_afiliado;
      if (t === 'Natural') counts.Natural++;
      else if (t === 'Corporativo') counts.Corporativo++;
      else if (t === 'Agente Corporativo' || t === 'Agente') counts.Agente++;
      else counts.Otros++;
    });
    return counts;
  }, [afiliados]);

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
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-10">
                  <Search className="text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={24} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-16 pr-16 sm:pr-24 py-5 rounded-[2rem] bg-white dark:bg-[#04432f] shadow-xl shadow-slate-200/50 dark:shadow-2xl text-slate-800 dark:text-emerald-50 font-bold placeholder-slate-400 outline-none border-2 border-transparent focus:border-emerald-500 transition-all text-lg relative z-0"
                />
                <div className="absolute inset-y-0 right-4 flex items-center z-10">
                  <div className="flex items-center gap-2">
                    {filterType !== 'Todos' && (
                      <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-tighter bg-emerald-500 text-white px-2 py-1 rounded-md">
                        {filterType === 'Natural' ? 'Agentes Independientes' : filterType === 'Agente' ? 'Agentes Corporativos' : 'Corporativos'}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-500 dark:text-emerald-200 bg-slate-50 dark:bg-[#022c22] px-3 py-1.5 rounded-full border border-slate-200 dark:border-emerald-500/20">
                      {resultados.length}
                    </span>
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

                {/* Debug Info (Visible en desarrollo) */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[9px] font-bold text-slate-400 dark:text-emerald-500/40 uppercase tracking-tighter">
                  <span>Ind: {stats.Natural}</span>
                  <span>Corp: {stats.Corporativo}</span>
                  <span>Agentes Corp: {stats.Agente}</span>
                  {stats.Otros > 0 && <span className="text-amber-500">Sin tipo: {stats.Otros}</span>}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Results Section */}
        <section className="max-w-[1600px] mx-auto px-6 pt-10 pb-16">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
              <p className="font-bold text-lg text-slate-500">Cargando directorio seguro...</p>
            </div>
          ) : resultados.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
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
