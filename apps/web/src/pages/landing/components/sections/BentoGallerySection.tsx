import React, { useState, useEffect, useRef } from 'react';
import { Plus, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';

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
   MASONRY PROGRESSIVE GALLERY
   Uses CSS columns for a robust masonry layout.
   Includes infinite scroll for automatic loading.
───────────────────────────────────────────────────────────────────────────── */

function GalleryCell({ src }: { src: string }) {
  return (
    <div className="break-inside-avoid mb-4 rounded-2xl overflow-hidden shadow-lg group relative bg-[#022c22] border border-white/5 animate-in fade-in zoom-in duration-500">
      <img
        src={src}
        alt="CIE Bolívar"
        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute bottom-3 right-3 p-1.5 rounded-full bg-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-1 group-hover:translate-y-0">
        <Camera size={12} className="text-white" />
      </div>
    </div>
  );
}

export default function BentoGallerySection() {
  const [visibleCount, setVisibleCount] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const hasMore = visibleCount < ALL_IMAGES.length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, visibleCount]);

  const handleLoadMore = () => {
    setIsLoading(true);
    // Artificial delay for smooth transition
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 15, ALL_IMAGES.length));
      setIsLoading(false);
    }, 600);
  };

  if (ALL_IMAGES.length === 0) return null;

  const visibleImages = ALL_IMAGES.slice(0, visibleCount);

  return (
    <section className="py-20 bg-[#011a14] relative border-t border-white/5">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-20 mb-12 text-center relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <ImageIcon className="text-emerald-500" size={18} />
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[10px]">
            Momentos Cámara
          </p>
        </div>
        <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tighter uppercase mb-4">
          Comunidad <span className="text-emerald-500 italic">CIBIR</span>
        </h2>
        <div className="w-16 h-1 bg-emerald-500 mx-auto rounded-full" />
      </div>

      {/* Masonry Layout */}
      <div className="max-w-7xl mx-auto px-6 lg:px-20 relative z-10">
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
          {visibleImages.map((src, idx) => (
            <GalleryCell key={idx} src={src} />
          ))}
        </div>

        {/* Infinite Scroll Trigger / Loader */}
        {hasMore && (
          <div ref={loaderRef} className="mt-16 text-center py-10">
            <div className="inline-flex items-center gap-3 px-8 py-3 bg-white/5 border border-white/10 rounded-full text-white/40 text-[10px] font-bold uppercase tracking-widest">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin text-emerald-500" />
                  Cargando más momentos...
                </>
              ) : (
                <>
                  <Plus size={14} className="text-emerald-500" />
                  Desliza para ver más
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
