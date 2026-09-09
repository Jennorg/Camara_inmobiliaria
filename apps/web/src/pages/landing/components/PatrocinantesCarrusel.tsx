import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const globModules = import.meta.glob<string>('@/assets/carrusel/patrocinante*.jpeg', {
  eager: true,
  import: 'default',
});

const IMAGES = Object.entries(globModules)
  .sort(([pathA], [pathB]) => {
    const numA = parseInt(pathA.match(/patrocinante(\d+)/)?.[1] || '0', 10);
    const numB = parseInt(pathB.match(/patrocinante(\d+)/)?.[1] || '0', 10);
    return numA - numB;
  })
  .map(([_, url]) => url);

export default function PatrocinantesCarrusel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const total = IMAGES.length;

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-play timer
  useEffect(() => {
    if (isPaused || total === 0) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 3500);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide, total]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const distance = touchStartX.current - touchEndX.current;
      const minSwipeDistance = 40;
      if (distance > minSwipeDistance) {
        nextSlide();
      } else if (distance < -minSwipeDistance) {
        prevSlide();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
    setIsPaused(false);
  };

  const getSlideStyle = (index: number) => {
    let diff = index - currentIndex;

    if (diff < -Math.floor(total / 2)) diff += total;
    if (diff > Math.floor(total / 2)) diff -= total;

    if (diff === 0) {
      // CENTER: Large vertical portrait focus
      return {
        transform: 'translateX(0%) scale(1.15) translateZ(0px)',
        opacity: 1,
        zIndex: 30,
        filter: 'brightness(1) contrast(1.02)',
        pointerEvents: 'auto' as const,
      };
    } else if (diff === -1) {
      // LEFT: Smaller vertical card
      return {
        transform: 'translateX(-70%) scale(0.82) translateZ(-40px)',
        opacity: 0.65,
        zIndex: 10,
        filter: 'brightness(0.8) blur(0.4px)',
        pointerEvents: 'auto' as const,
      };
    } else if (diff === 1) {
      // RIGHT: Smaller vertical card
      return {
        transform: 'translateX(70%) scale(0.82) translateZ(-40px)',
        opacity: 0.65,
        zIndex: 10,
        filter: 'brightness(0.8) blur(0.4px)',
        pointerEvents: 'auto' as const,
      };
    } else {
      // HIDDEN
      const sign = diff > 0 ? 1 : -1;
      return {
        transform: `translateX(${sign * 140}%) scale(0.55) translateZ(-100px)`,
        opacity: 0,
        zIndex: 0,
        filter: 'brightness(0.4) blur(4px)',
        pointerEvents: 'none' as const,
      };
    }
  };

  if (total === 0) return null;

  return (
    <div className="w-full py-6 sm:py-10 overflow-hidden relative select-none">
      {/* 3D Motion Carousel Stage (Vertical Aspect) */}
      <div
        className="relative max-w-5xl mx-auto h-[380px] sm:h-[520px] md:h-[600px] lg:h-[660px] flex items-center justify-center px-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous Button */}
        <button
          onClick={prevSlide}
          type="button"
          aria-label="Foto anterior"
          className="absolute left-2 sm:left-6 z-40 p-3 sm:p-4 rounded-full bg-white/95 text-slate-800 border border-slate-200/80 shadow-xl backdrop-blur-md hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-300 active:scale-90 cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>

        {/* Next Button */}
        <button
          onClick={nextSlide}
          type="button"
          aria-label="Siguiente foto"
          className="absolute right-2 sm:right-6 z-40 p-3 sm:p-4 rounded-full bg-white/95 text-slate-800 border border-slate-200/80 shadow-xl backdrop-blur-md hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-300 active:scale-90 cursor-pointer"
        >
          <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>

        {/* Vertical Cards Stage */}
        <div className="relative w-full h-full flex items-center justify-center">
          {IMAGES.map((imgUrl, index) => {
            const style = getSlideStyle(index);
            const isCenter = (index - currentIndex + total) % total === 0;

            return (
              <div
                key={`patrocinante-${index}`}
                onClick={() => setCurrentIndex(index)}
                style={style}
                className={`absolute w-[220px] sm:w-[320px] md:w-[380px] lg:w-[420px] aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer group bg-slate-900 ${
                  isCenter
                    ? 'ring-4 ring-emerald-500/40 border-2 border-emerald-400 shadow-2xl shadow-emerald-950/40'
                    : 'border border-slate-200/60'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Indicators / Dots */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-6 sm:mt-10">
        {IMAGES.map((_, dotIdx) => (
          <button
            key={`dot-${dotIdx}`}
            onClick={() => setCurrentIndex(dotIdx)}
            type="button"
            aria-label={`Ir a foto ${dotIdx + 1}`}
            className={`h-2.5 rounded-full transition-all duration-500 cursor-pointer ${
              dotIdx === currentIndex
                ? 'w-7 sm:w-10 bg-emerald-600 shadow-md shadow-emerald-500/40'
                : 'w-2.5 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
