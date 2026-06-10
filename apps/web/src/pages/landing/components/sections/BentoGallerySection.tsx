import React, { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

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
   BENTO HORIZONTAL GALLERY
   Infinite scrolling marquee with progressive loading (batches of 10).
   Maintains original branding and visual style.
───────────────────────────────────────────────────────────────────────────── */

const ROW_HEIGHT = 380;
const GAP = 16;

function GalleryCell({ src, isNew }: { src: string; isNew: boolean }) {
  return (
    <div 
      className={`h-full flex-shrink-0 rounded-2xl overflow-hidden shadow-xl group relative bg-black/40 border border-white/5 ${
        isNew ? 'animate-reveal opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src={src}
        alt="Comunidad Cámara"
        className="h-full w-auto object-cover transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-emerald-950/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

export default function BentoGallerySection() {
  const [visibleCount, setVisibleCount] = useState(10);
  const [prevCount, setPrevCount] = useState(0);
  
  // Automatic progressive loading: adds 10 images every 3.5 seconds
  useEffect(() => {
    if (visibleCount < ALL_IMAGES.length) {
      const timer = setTimeout(() => {
        setPrevCount(visibleCount);
        setVisibleCount(prev => Math.min(prev + 10, ALL_IMAGES.length));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [visibleCount]);

  if (ALL_IMAGES.length === 0) return null;

  const visibleImages = ALL_IMAGES.slice(0, visibleCount);

  // High velocity speed calculation
  const marqueeDuration = Math.max(6, visibleCount * 0.4);

  return (
    <section className="py-24 bg-[#011a14] overflow-hidden relative border-t border-white/5">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-20 mb-16 text-center relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <ImageIcon className="text-emerald-500" size={20} />
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs">
            Vida Institucional
          </p>
        </div>
        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase mb-6">
          Nuestra Comunidad <span className="text-emerald-500 italic">en Acción</span>
        </h2>
        <div className="w-20 h-1.5 bg-emerald-500 mx-auto rounded-full" />
      </div>

      {/* Marquee Rows */}
      <div className="space-y-6 relative">
        {/* Row 1: Right-to-Left */}
        <div className="flex relative overflow-hidden group">
          <div 
            className="flex gap-4 animate-marquee hover:[animation-play-state:paused] will-change-transform"
            style={{ 
              height: ROW_HEIGHT,
              animationDuration: `${marqueeDuration}s`
            }}
          >
            {[...visibleImages, ...visibleImages].map((src, idx) => {
              const realIdx = idx % visibleCount;
              const isNew = realIdx >= prevCount;
              return <GalleryCell key={`row1-${idx}-${visibleCount}`} src={src} isNew={isNew} />;
            })}
          </div>
        </div>

        {/* Row 2: Left-to-Right */}
        <div className="flex relative overflow-hidden group">
          <div 
            className="flex gap-4 animate-marquee-reverse hover:[animation-play-state:paused] will-change-transform"
            style={{ 
              height: ROW_HEIGHT,
              animationDuration: `${marqueeDuration}s`
            }}
          >
            {[...visibleImages, ...visibleImages].reverse().map((src, idx) => {
              const realIdx = (visibleCount - 1) - (idx % visibleCount);
              const isNew = realIdx >= prevCount;
              return <GalleryCell key={`row2-${idx}-${visibleCount}`} src={src} isNew={isNew} />;
            })}
          </div>
        </div>
      </div>

      {/* Progress Indicator (Subtle) */}
      <div className="mt-12 flex flex-col items-center gap-3 opacity-30">
        <div className="h-1 w-48 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-1000"
            style={{ width: `${(visibleCount / ALL_IMAGES.length) * 100}%` }}
          />
        </div>
        <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white">
          {visibleCount} / {ALL_IMAGES.length} Momentos cargados
        </p>
      </div>

      {/* Edge Fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#011a14] via-[#011a14]/80 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#011a14] via-[#011a14]/80 to-transparent z-10" />

      {/* Inline Styles for Animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes reveal {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-marquee {
          animation: marquee linear infinite;
          width: max-content;
        }
        .animate-marquee-reverse {
          animation: marquee-reverse linear infinite;
          width: max-content;
        }
        .animate-reveal {
          animation: reveal 3s ease-out forwards;
        }
      `}</style>
    </section>
  );
}
