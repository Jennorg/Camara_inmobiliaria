import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
};

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-8 right-8 z-[60] p-4 rounded-2xl bg-emerald-500 text-[#022c22] shadow-2xl transition-colors transition-transform duration-500 hover:bg-emerald-400 hover:scale-110 active:scale-95 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'
      }`}
      aria-label="Volver arriba"
    >
      <ArrowUp size={24} strokeWidth={3} />
    </button>
  );
}
