import React from 'react';
import { User, Users } from 'lucide-react';
import { AfiliadoCard, AfiliadoData } from '../AfiliadoCard';

interface OrganigramViewProps {
  leaderNode: AfiliadoData;
  childrenNodes: AfiliadoData[];
  currentAfiliadoId: string;
}

const CARD_WIDTH = 'w-[220px] sm:w-[240px]';

const CardSlot = ({
  afiliado,
  highlighted,
  forceRepMode,
}: {
  afiliado: AfiliadoData;
  highlighted?: boolean;
  forceRepMode?: boolean;
}) => (
  <div className={`${CARD_WIDTH} shrink-0`}>
    <AfiliadoCard
      afiliado={afiliado}
      forceRepMode={forceRepMode}
      highlighted={highlighted}
    />
  </div>
);

export const OrganigramView = ({
  leaderNode,
  childrenNodes,
  currentAfiliadoId,
}: OrganigramViewProps) => {
  const totalMembers = childrenNodes.length + 1;
  const isLeaderCurrent = String(leaderNode.id_afiliado) === String(currentAfiliadoId);
  const leaderIsCorporativo = leaderNode.tipo_afiliado === 'Corporativo';

  return (
    <section className="w-full bg-white dark:bg-[#04432f] rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-200 dark:border-emerald-500/10">
      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center">
          <Users size={12} className="text-emerald-500" />
        </div>
        Organigrama de Trabajo ({totalMembers})
      </h3>

      <div className="flex flex-col items-center w-full">
        {/* Nodo líder */}
        <div className="flex flex-col items-center w-full">
          <p className="text-[10px] font-black text-slate-400 dark:text-emerald-400/60 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <User size={10} className="text-emerald-600 dark:text-emerald-400" />
            {leaderIsCorporativo ? 'Representante Legal' : 'Liderazgo'}
          </p>
          <CardSlot
            afiliado={leaderNode}
            highlighted={isLeaderCurrent}
          />
        </div>

        {/* Conector vertical líder → equipo */}
        {childrenNodes.length > 0 && (
          <div className="w-0.5 h-8 bg-slate-200 dark:bg-emerald-500/20 shrink-0" />
        )}

        {/* Fila de equipo con líneas de jerarquía */}
        {childrenNodes.length > 0 && (
          <div className="flex justify-center items-start gap-4 md:gap-6 lg:gap-8 pt-2 w-full overflow-x-auto pb-2 px-2">
            {childrenNodes.map((child, index) => {
              const isFirst = index === 0;
              const isLast = index === childrenNodes.length - 1;
              const isOnly = childrenNodes.length === 1;
              const isCurrent = String(child.id_afiliado) === String(currentAfiliadoId);

              return (
                <div
                  key={child.id_afiliado}
                  className={`relative flex flex-col items-center shrink-0 ${CARD_WIDTH}`}
                >
                  {/* Línea horizontal entre hermanos */}
                  {!isOnly && (
                    <div
                      className={`absolute top-0 h-0.5 bg-slate-200 dark:bg-emerald-500/20 ${
                        isFirst
                          ? 'left-1/2 right-0'
                          : isLast
                            ? 'left-0 right-1/2'
                            : 'left-0 right-0'
                      }`}
                    />
                  )}

                  {/* Línea vertical hacia la card */}
                  <div className="w-0.5 h-6 bg-slate-200 dark:bg-emerald-500/20 shrink-0" />

                  <CardSlot afiliado={child} highlighted={isCurrent} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
