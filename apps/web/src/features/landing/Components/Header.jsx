import bgBolivar from "../assets/Pzo.jpg";

export default function Header({ darkMode }) {
  return (
    <header
      id="inicio"
      className="relative overflow-hidden px-6 lg:px-20 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center min-h-[95vh]"
    >
      {/* CAPA 1: IMAGEN CON ZOOM */}
      <div 
        className="absolute inset-0 z-0 animate-bg-zoom"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.68), rgba(2, 44, 34, 0.68)), url(${bgBolivar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      />

      {/* CAPA 2: TELÓN VERDE (Baja desde arriba) */}
      <div 
        className="absolute inset-0 z-10 animate-curtain"
        style={{
          background: "linear-gradient(to bottom, rgba(4, 47, 36, 0.75), rgba(2, 44, 34, 0))",
        }}
      />

      {/* CAPA 3: CONTENIDO (Aparece después) */}
      <div 
        className="relative z-20 space-y-6 animate-text-reveal" 
        style={{ animationDelay: "0.8s", opacity: 0 }}
      >
        <h1
          className="text-white text-5xl lg:text-7xl font-bold leading-[1.1]"
        >
          Unidos por el{" "}
          <span className="text-emerald-500 italic">progreso</span>{" "}
          inmobiliario de Bolívar
        </h1>
        
        <p className="text-gray-300 text-lg max-w-md leading-relaxed">
          Representamos y fortalecemos a los profesionales del sector en el
          estado, impulsando la ética y el desarrollo sostenible.
        </p>

        <div className="pt-4">
          <button className="px-10 py-3 bg-emerald-600 text-white rounded-full font-bold uppercase text-xs tracking-widest hover:bg-emerald-500 transition-all shadow-lg">
            Unirse
          </button>
        </div>
      </div>
    </header>
  );
}