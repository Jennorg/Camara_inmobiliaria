import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import imageRatios from './image-ratios.json';

// Vite-specific way to import all images in a folder
const imagesGlob = import.meta.glob('@/assets/photos/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

const ALL_IMAGES = Object.entries(imagesGlob).map(([key, value]) => {
  const filename = key.substring(key.lastIndexOf('/') + 1);
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const jpegFilename = `${baseName}.jpeg`;
  const webpFilename = `${baseName}.webp`;
  const ratio = (imageRatios as Record<string, number>)[webpFilename] || (imageRatios as Record<string, number>)[jpegFilename] || (imageRatios as Record<string, number>)[filename] || 1.5;
  return {
    src: value,
    ratio
  };
}).sort((a, b) => {
  const hash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };
  return Math.sin(hash(a.src)) - Math.sin(hash(b.src));
});

/* ─────────────────────────────────────────────────────────────────────────────
   BENTO HORIZONTAL GALLERY
   Infinite scrolling marquee using native lazy loading and pre-calculated aspect ratios.
   Prevents layout shifts and provides a perfectly smooth, bug-free animation.
 ───────────────────────────────────────────────────────────────────────────── */

function GalleryCell({ src, ratio }: { src: string; ratio: number }) {
  return (
    <div
      className="h-full flex-shrink-0 rounded-2xl overflow-hidden shadow-xl group relative bg-black/40 border border-white/5"
      style={{ aspectRatio: ratio }}
    >
      <img
        src={src}
        alt="Comunidad Cámara"
        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-emerald-950/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

export default function BentoGallerySection() {
  if (ALL_IMAGES.length === 0) return null;

  // Stable animation duration: ~3.2 seconds per image
  const marqueeDuration = ALL_IMAGES.length * 3.2;

  return (
    <section className="py-24 bg-[#011a14] overflow-hidden relative border-t border-white/5">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-20 mb-16 text-center relative z-10">
        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase mb-2">
          Nuestra Comunidad <span className="text-emerald-500 italic">en Acción</span>
        </h2>
        <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-xs sm:text-sm mb-6">
          2da Edición
        </p>
        <div className="w-20 h-1.5 bg-emerald-500 mx-auto rounded-full" />
      </div>

      {/* Marquee Rows */}
      <div className="space-y-6 relative">
        {/* Row 1: Right-to-Left */}
        <div className="flex relative overflow-hidden group">
          <div
            className="flex gap-4 animate-marquee hover:[animation-play-state:paused] will-change-transform h-[240px] md:h-[380px]"
            style={{
              animationDuration: `${marqueeDuration}s`
            }}
          >
            {[...ALL_IMAGES, ...ALL_IMAGES].map(({ src, ratio }, idx) => (
              <GalleryCell key={`row1-${idx}`} src={src} ratio={ratio} />
            ))}
          </div>
        </div>

        {/* Row 2: Left-to-Right */}
        <div className="flex relative overflow-hidden group">
          <div
            className="flex gap-4 animate-marquee-reverse hover:[animation-play-state:paused] will-change-transform h-[240px] md:h-[380px]"
            style={{
              animationDuration: `${marqueeDuration}s`
            }}
          >
            {[...ALL_IMAGES, ...ALL_IMAGES].reverse().map(({ src, ratio }, idx) => (
              <GalleryCell key={`row2-${idx}`} src={src} ratio={ratio} />
            ))}
          </div>
        </div>
      </div>

      {/* Total count Indicator */}
      <div className="mt-12 flex flex-col items-center gap-2 opacity-35">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white">
          {ALL_IMAGES.length} Momentos compartidos
        </p>
      </div>

      {/* Edge Fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-[#011a14] via-[#011a14]/80 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-[#011a14] via-[#011a14]/80 to-transparent z-10" />

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
        .animate-marquee {
          animation: marquee linear infinite;
          width: max-content;
        }
        .animate-marquee-reverse {
          animation: marquee-reverse linear infinite;
          width: max-content;
        }
      `}</style>
    </section>
  );
}
