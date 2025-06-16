
import React from "react";
import { Card } from "@/components/ui/card";
import MediaPorFuncaoChart from "./MediaPorFuncaoChart";

interface FolhaPagamentoResumoProps {
  folhaTotal: number;
  mediaSalarial: number;
  folhaPorFuncao: { nome_funcao: string; total: number; media: number }[];
  folhaTotalGeral?: number;
}

export const FolhaPagamentoResumo: React.FC<FolhaPagamentoResumoProps> = ({
  folhaTotal,
  mediaSalarial,
  folhaPorFuncao,
  folhaTotalGeral
}) => {
  const semDados = folhaTotal === 0 && (!folhaPorFuncao || folhaPorFuncao.length === 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
      <Card className="p-4 flex flex-col gap-1 items-center">
        <div className="text-xs text-muted-foreground mb-1">Folha Total {folhaTotalGeral && folhaTotal !== folhaTotalGeral && <span className="ml-1 text-[10px] text-muted-foreground">(de R$ {folhaTotalGeral?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>}</div>
        <span className="text-2xl font-bold">R$ {folhaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        {folhaTotal === 0 && (
          <span className="text-[10px] text-muted-foreground">Sem salários cadastrados</span>
        )}
      </Card>
      <Card className="p-4 flex flex-col gap-1 items-center">
        <div className="text-xs text-muted-foreground mb-1">Média Salarial</div>
        <span className="text-2xl font-bold">R$ {mediaSalarial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </Card>
      <Card className="p-4 flex flex-col gap-1 min-h-[64px]">
        <div className="text-xs text-muted-foreground mb-1">Média por Função</div>
        <MediaPorFuncaoChart data={folhaPorFuncao} />
      </Card>
    </div>
  );
};
