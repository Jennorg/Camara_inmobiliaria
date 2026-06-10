import React, { useState, useEffect } from 'react';
import { Plus, Camera, Image as ImageIcon } from 'lucide-react';

// Vite-specific way to import all images in a folder
const imagesGlob = import.meta.glob('@/assets/Photos_2026/*.jpeg', { eager: true, import: 'default' });

// Deterministic shuffle to keep it "defined" but random-looking
const ALL_IMAGES = (Object.values(imagesGlob) as string[]).sort((a, b) => {
  const hash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };
  return Math.sin(hash(a)) - Math.sin(hash(b));
});

/* ─────────────────────────────────────────────────────────────────────────────
   PROGRESSIVE GRID GALLERY
   Loads images in batches of 10.
   Positions itself as the last element to load for performance.
───────────────────────────────────────────────────────────────────────────── */

function GalleryCell({ src, isTall }: { src: string, isTall?: boolean }) {
  return (
    <div className={`rounded-3xl overflow-hidden shadow-xl group relative bg-[#022c22] border border-white/5 animate-in fade-in zoom-in duration-700 ${isTall ? 'row-span-2 h-full' : 'aspect-[4/3]'}`}>
      <img
        src={src}
        alt="CIE Bolívar"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-4 right-4 p-2 rounded-full bg-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
        <Camera size={14} className="text-white" />
      </div>
    </div>
  );
}

export default function BentoGallerySection() {
  const [visibleCount, setVisibleCount] = useState(10);
  const [shouldRender, setShouldRender] = useState(false);

  // Efecto para que sea el ÚLTIMO elemento en cargar (delay intencional)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!shouldRender || ALL_IMAGES.length === 0) return (
    <div className="h-40 flex items-center justify-center bg-[#011a14]">
       <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  const visibleImages = ALL_IMAGES.slice(0, visibleCount);
  const hasMore = visibleCount < ALL_IMAGES.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  return (
    <section className="py-24 bg-[#011a14] relative border-t border-white/5">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-20 mb-16 text-center relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <ImageIcon className="text-emerald-500" size={20} />
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs">
            Galería Fotográfica
          </p>
        </div>
        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase mb-6">
          Vida Institucional <span className="text-emerald-500 italic block sm:inline">2026</span>
        </h2>
        <div className="w-20 h-1.5 bg-emerald-500 mx-auto rounded-full" />
      </div>

      {/* Grid Gallery - BENTO STYLE */}
      <div className="max-w-7xl mx-auto px-6 lg:px-20 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 lg:grid-flow-dense">
          {visibleImages.map((src, idx) => {
            // Cada 10 fotos, las 3 primeras son "ALTAS" (consecutivas)
            const relativeIdx = idx % 10;
            const isTall = relativeIdx >= 0 && relativeIdx <= 2;
            
            return (
              <GalleryCell 
                key={idx} 
                src={src} 
                isTall={isTall} 
              />
            );
          })}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-16 text-center">
            <button
              onClick={handleLoadMore}
              className="group relative inline-flex items-center gap-3 px-10 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-900/20 transition-all hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={16} className="transition-transform group-hover:rotate-90" />
              Cargar más fotos
              <span className="opacity-50 text-[8px] ml-1">({ALL_IMAGES.length - visibleCount} restantes)</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
