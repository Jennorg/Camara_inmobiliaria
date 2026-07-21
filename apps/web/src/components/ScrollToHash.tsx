import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToHash = () => {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (hash) {
      const id = hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      timer = setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTo(0, 0);
        document.body.scrollTo(0, 0);
      }, 50);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [pathname, hash, key]);

  return null;
};

export default ScrollToHash;
