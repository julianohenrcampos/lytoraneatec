
import React from "react";
import { Badge } from "@/components/ui/badge";
import { FuncionarioAnalise } from "@/hooks/dashboard/useRhDashboardData";

interface TopFuncionariosCardsProps {
  funcionarios: FuncionarioAnalise[];
}

function getAvaliacaoCor(media: number | null | undefined) {
  if (media == null) return "text-muted-foreground";
  if (media >= 4.5) return "text-green-600";
  if (media >= 3.5) return "text-yellow-500";
  return "text-red-600";
}
function getAvaliacaoEmoji(media: number | null | undefined) {
  if (media == null) return "⚪";
  if (media >= 4.5) return "⭐";
  if (media >= 3.5) return "▲";
  return "⚠️";
}
function formatMeses(n: number) {
  if (!n || Number.isNaN(n)) return "-";
  if (n < 12) return `${n} mês${n === 1 ? "" : "es"}`;
  const anos = Math.floor(n / 12);
  const meses = n % 12;
  if (meses === 0) return `${anos} ano${anos === 1 ? "" : "s"}`;
  return `${anos}a ${meses}m`;
}

const TopFuncionariosCards: React.FC<TopFuncionariosCardsProps> = ({ funcionarios }) => {
  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 animate-fade-in">
      {funcionarios.map(f => {
        const admDate = f.data_admissao ? new Date(f.data_admissao) : null;
        const now = new Date();
        const meses = admDate
          ? (now.getFullYear() - admDate.getFullYear()) * 12 + (now.getMonth() - admDate.getMonth())
          : null;
        return (
          <div
            key={f.id}
            className="flex flex-col items-center bg-card rounded-xl shadow p-4 group transition hover:scale-105 border"
          >
            <div className="mb-3">
              {f.imagem ? (
                <img
                  src={f.imagem}
                  alt={f.nome_completo}
                  className="h-16 w-16 rounded-full object-cover border-4 border-muted shadow"
                />
              ) : (
                <span className="block h-16 w-16 rounded-full bg-muted" />
              )}
            </div>
            <div className="font-semibold text-center text-md">{f.nome_completo}</div>
            <div className="text-xs text-muted-foreground mb-2">{f.bd_funcoes?.nome_funcao ?? "--"}</div>
            <div className="flex items-center gap-1 mb-1">
              <span className={getAvaliacaoCor(f.mediaAvaliacao) + " text-lg font-bold drop-shadow"}>
                {f.mediaAvaliacao != null ? Number(f.mediaAvaliacao).toFixed(1) : "--"}
              </span>
              <span className="text-lg">{getAvaliacaoEmoji(f.mediaAvaliacao)}</span>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              {meses !== null ? formatMeses(meses) : "--"}
            </div>
            <div>
              <Badge variant={f.status === "Ativo" ? "outline" : "destructive"}>{f.status}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TopFuncionariosCards;
