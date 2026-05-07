import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

const SEO: React.FC<SEOProps> = ({ 
  title, 
  description, 
  keywords, 
  image = '/assets/Logo2.png', 
  url,
  type = 'website'
}) => {
  const baseTitle = 'Cámara Inmobiliaria Bolívar (CIBIR)';
  const fullTitle = title ? `${title} | ${baseTitle}` : baseTitle;
  const defaultDescription = 'Página oficial de la Cámara Inmobiliaria del Estado Bolívar. Agremiamos a profesionales inmobiliarios, promovemos la ética y formación continua.';
  const defaultKeywords = 'cámara inmobiliaria bolívar, bienes raíces puerto ordaz, formación inmobiliaria, cibir, profesionales inmobiliarios venezuela';
  
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Cámara Inmobiliaria del Estado Bolívar",
    "alternateName": "CIBIR",
    "url": "https://camarainmobiliariadebolivar.com",
    "logo": "https://camarainmobiliariadebolivar.com/assets/Logo2.png",
    "sameAs": [
      "https://www.instagram.com/camarainmobiliariabolivar",
      "https://twitter.com/camarainmobiliariabolivar"
    ]
  };

  return (
    <Helmet>
      {/* Basic */}
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      <meta name="keywords" content={keywords || defaultKeywords} />
      <link rel="canonical" href={currentUrl} />

      {/* OpenGraph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Cámara Inmobiliaria de Bolívar" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
      <meta name="twitter:image" content={image} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

export default SEO;
