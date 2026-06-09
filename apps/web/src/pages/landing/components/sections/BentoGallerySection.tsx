import React from 'react';

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
  // Use sin for a "random" distribution based on the filename hash
  return Math.sin(hash(a)) - Math.sin(hash(b));
});

/* ─────────────────────────────────────────────────────────────────────────────
   DYNAMIC BENTO GALLERY
   Shows ALL 89+ images in an infinite horizontal scroll.
   Uses object-contain to ensure images are shown ENTIRELY without cropping.
───────────────────────────────────────────────────────────────────────────── */

const PANEL_HEIGHT = 500;
const GAP = 12;

function GalleryCell({ src }: { src: string }) {
  return (
    <div className="h-full flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl group relative bg-black/40 border border-white/5">
      <img
        src={src}
        alt="CIE Bolívar"
        className="h-full w-auto object-contain transition-transform duration-700 group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-emerald-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}

export default function BentoGallerySection() {
  if (ALL_IMAGES.length === 0) return null;

  return (
    <section className="py-24 bg-[#011a14] overflow-hidden relative border-t border-white/5">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-20 mb-14 text-center">
        <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs mb-4">
          Vida Institucional
        </p>
        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase">
          Nuestra Comunidad{' '}
          <span className="text-emerald-500 italic">en Acción</span>
        </h2>
        <div className="w-20 h-1.5 bg-emerald-500 mx-auto rounded-full mt-6" />
      </div>

      {/* Infinite scroll strip */}
      <div className="relative">
        <div
          className="flex hover:[animation-play-state:paused]"
          style={{
            width: 'max-content',
            animation: 'bento-scroll 180s linear infinite', // Slower for more images
            gap: GAP,
            paddingInline: GAP,
            height: PANEL_HEIGHT,
          }}
        >
          {/* We duplicate the entire array for seamless looping */}
          {[...ALL_IMAGES, ...ALL_IMAGES].map((src, idx) => (
            <GalleryCell key={idx} src={src} />
          ))}
        </div>
      </div>

      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#011a14] via-[#011a14]/80 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#011a14] via-[#011a14]/80 to-transparent z-10" />

      {/* Keyframes */}
      <style>{`
        @keyframes bento-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
