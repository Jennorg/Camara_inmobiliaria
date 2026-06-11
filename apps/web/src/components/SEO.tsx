import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  imageAlt?: string;
  url?: string;
  type?: 'website' | 'article';
  index?: boolean;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  image = '/assets/Logo2.png',
  imageAlt = 'Logo Cámara Inmobiliaria de Bolívar',
  url,
  type = 'website',
  index = true
}) => {
  const baseTitle = 'Cámara Inmobiliaria de Bolívar';
  const fullTitle = title ? `${title}` : baseTitle;
  const defaultDescription = 'Gremio líder de profesionales inmobiliarios en el Estado Bolívar, Venezuela. Encuentra agentes certificados, inmobiliarias de confianza y formación especializada.';
  const defaultKeywords = 'inmobiliarias en bolivar, bienes raices puerto ordaz, corredores inmobiliarios venezuela, cibir bolivar, agentes inmobiliarios certificados, venta de casas puerto ordaz, apartamentos ciudad bolivar';

  const currentUrl = url || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      "name": "Cámara Inmobiliaria del Estado Bolívar",
      "alternateName": "CIBIR",
      "url": "https://camarainmobiliariadebolivar.com",
      "logo": "https://camarainmobiliariadebolivar.com/assets/Logo2.png",
      "image": "https://camarainmobiliariadebolivar.com/assets/Logo2.png",
      "description": defaultDescription,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Puerto Ordaz",
        "addressRegion": "Bolívar",
        "addressCountry": "VE"
      },
      "sameAs": [
        "https://www.instagram.com/camarainmobiliariabolivar",
        "https://twitter.com/camarainmobiliariabolivar"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Cámara Inmobiliaria del Estado Bolívar",
      "url": "https://camarainmobiliariadebolivar.com"
    }
  ];

  return (
    <Helmet>
      {/* Basic */}
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      <meta name="keywords" content={keywords || defaultKeywords} />
      <meta name="robots" content={index ? "index, follow" : "noindex, nofollow"} />
      <link rel="canonical" href={currentUrl} />

      {/* OpenGraph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="es_ES" />
      <meta property="og:site_name" content="Cámara Inmobiliaria de Bolívar" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

export default SEO;
