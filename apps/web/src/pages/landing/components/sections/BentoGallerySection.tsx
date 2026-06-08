import React from 'react';

import img2  from '@/assets/Photos_2026/gallery_02.jpeg';
import img3  from '@/assets/Photos_2026/gallery_03.jpeg';
import img4  from '@/assets/Photos_2026/gallery_04.jpeg';
import img5  from '@/assets/Photos_2026/gallery_05.jpeg';
import img6  from '@/assets/Photos_2026/gallery_06.jpeg';
import img7  from '@/assets/Photos_2026/gallery_07.jpeg';
import img8  from '@/assets/Photos_2026/gallery_08.jpeg';
import img9  from '@/assets/Photos_2026/gallery_09.jpeg';
import img10 from '@/assets/Photos_2026/gallery_10.jpeg';
import img11 from '@/assets/Photos_2026/gallery_11.jpeg';
import img12 from '@/assets/Photos_2026/gallery_12.jpeg';
import img13 from '@/assets/Photos_2026/gallery_13.jpeg';

/* ─────────────────────────────────────────────────────────────────────────────
   LAYOUT DESIGN  (2 repeating panels, each 990 px wide × 480 px tall)

   Each panel = 2-row CSS grid (235 + 10 + 235 = 480 px)
   Columns alternate: [portrait col | landscape stack | portrait col | landscape stack]
                        180 px         300 px            180 px         300 px

   Portrait columns span BOTH rows → full 480 px height → no vertical cropping
   Landscape stacks sit in ONE row  → 235 px height    → cropped portrait shows faces

   Panel A                   Panel B
   ┌────┬──────┬────┬──────┐  ┌────┬──────┬────┬──────┐
   │ P1 │ L1   │ P2 │ L3   │  │ P3 │ L5   │ P4 │ L7   │
   │    ├──────┤    ├──────┤  │    ├──────┤    ├──────┤
   │    │ L2   │    │ L4   │  │    │ L6   │    │ L8   │
   └────┴──────┴────┴──────┘  └────┴──────┴────┴──────┘
   P1=img7  L1=img2  P2=img3  L3=img9   L4=img10
   P3=img8  L5=img6  P4=img4  L7=img12  L8=img13
                     L2=img5             L6=img11
───────────────────────────────────────────────────────────────────────────── */

const W_P = 180;   // portrait column width
const W_L = 300;   // landscape column width
const H   = 480;   // total panel height
const ROW = 235;   // single row height  (ROW*2 + gap = H)
const GAP = 10;    // uniform gap

type Pos = string;

function Cell({
  src,
  pos = 'object-center',
  gridColumn,
  gridRow,
}: {
  src: string;
  pos?: Pos;
  gridColumn?: string;
  gridRow?: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl group relative bg-emerald-900/20"
      style={{ gridColumn, gridRow }}
    >
      <img
        src={src}
        alt="Galería CIE Bolívar"
        className={`w-full h-full object-cover ${pos} transition-transform duration-700 group-hover:scale-105`}
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

// Reusable 2-panel grid
function PanelA() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${W_P}px ${W_L}px ${W_P}px ${W_L}px`,
        gridTemplateRows: `${ROW}px ${ROW}px`,
        gap: GAP,
        width: W_P + GAP + W_L + GAP + W_P + GAP + W_L,
        height: H,
        flexShrink: 0,
      }}
    >
      {/* Portrait 1 — spans both rows */}
      <Cell src={img7}  pos="object-top"          gridColumn="1" gridRow="1 / 3" />
      {/* Landscape stack — col 2 */}
      <Cell src={img2}  pos="object-[50%_25%]"    gridColumn="2" gridRow="1" />
      <Cell src={img5}  pos="object-[50%_25%]"    gridColumn="2" gridRow="2" />
      {/* Portrait 2 — spans both rows */}
      <Cell src={img3}  pos="object-top"          gridColumn="3" gridRow="1 / 3" />
      {/* Landscape stack — col 4 */}
      <Cell src={img9}  pos="object-top"            gridColumn="4" gridRow="1" />
      <Cell src={img10} pos="object-[50%_30%]"    gridColumn="4" gridRow="2" />
    </div>
  );
}

function PanelB() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${W_P}px ${W_L}px ${W_P}px ${W_L}px`,
        gridTemplateRows: `${ROW}px ${ROW}px`,
        gap: GAP,
        width: W_P + GAP + W_L + GAP + W_P + GAP + W_L,
        height: H,
        flexShrink: 0,
      }}
    >
      {/* Portrait 3 — spans both rows */}
      <Cell src={img8}  pos="object-top"          gridColumn="1" gridRow="1 / 3" />
      {/* Landscape stack — col 2 */}
      <Cell src={img6}  pos="object-[50%_25%]"    gridColumn="2" gridRow="1" />
      <Cell src={img11} pos="object-[50%_30%]"    gridColumn="2" gridRow="2" />
      {/* Portrait 4 — spans both rows */}
      <Cell src={img4}  pos="object-top"          gridColumn="3" gridRow="1 / 3" />
      {/* Landscape stack — col 4 */}
      <Cell src={img12} pos="object-[50%_25%]"    gridColumn="4" gridRow="1" />
      <Cell src={img13} pos="object-[50%_25%]"    gridColumn="4" gridRow="2" />
    </div>
  );
}

export default function BentoGallerySection() {
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
      <div
        className="flex hover:[animation-play-state:paused]"
        style={{
          width: 'max-content',
          animation: 'bento-scroll 55s linear infinite',
          gap: GAP,
          paddingInline: GAP,
        }}
      >
        {/* Duplicate the two panels twice for a seamless infinite loop */}
        {[0, 1].map((dup) => (
          <React.Fragment key={dup}>
            <PanelA />
            <PanelB />
          </React.Fragment>
        ))}
      </div>

      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#011a14] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#011a14] to-transparent" />

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