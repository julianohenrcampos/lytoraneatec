
import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Veiculo } from "@/types/veiculo";
import VeiculoImage from "@/components/veiculos/table/VeiculoImage";
import VeiculoStatusBadge from "@/components/veiculos/table/VeiculoStatusBadge";
import VeiculoActions from "@/components/veiculos/table/VeiculoActions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { formatIdentificadorFromVeiculo } from "@/utils/formatIdentificadorAtivo";


interface UseVeiculoColumnsProps {
  onView: (veiculo: Veiculo) => void;
  onEdit: (veiculo: Veiculo) => void;
  onDelete: (veiculo: Veiculo) => void;
}

export const useVeiculoColumns = ({
  onView,
  onEdit,
  onDelete
}: UseVeiculoColumnsProps): ColumnDef<Veiculo>[] => {
  return [
    {
      id: "imagem",
      header: "Imagem",
      cell: ({ row }) => {
        const veiculo = row.original;
        return (
          <VeiculoImage 
            imageUrl={veiculo.imagem_url} 
            alt={veiculo.placa || 'Veículo'} 
          />
        );
      },
    },
    {
      id: "identificador",
      header: "Identificador",
      cell: ({ row }) => {
        const veiculo = row.original;
        const principal = formatIdentificadorFromVeiculo(veiculo);
        const placa = veiculo.placa && veiculo.placa.trim();
        if (principal !== "Sem identificador" && placa && !principal.includes(placa)) {
          return `${principal} — ${placa}`;
        }
        return principal;
      },
    },

    {
      id: "categoria",
      header: "Categoria",
      cell: ({ row }) => {
        const veiculo = row.original;
        return veiculo.nome_categoria || "Não classificado";
      },
    },
    {
      id: "subcategoria",
      header: "Subcategoria",
      cell: ({ row }) => row.original.nome_subcategoria || "-",
    },
    {
      accessorKey: "nome_departamento",
      header: "Departamento",
    },
    {
      id: "centro_custo",
      header: "Centro de Custo Atual",
      cell: ({ row }) => {
        const v = row.original;
        const nome = v.centro_custo_atual_nome || v.nome_centro_custo;
        const codigo = v.centro_custo_atual_codigo;
        const origem = v.centro_custo_origem ?? 'SEM_ALOCACAO';
        if (!nome) {
          return <span className="text-muted-foreground italic">Sem alocação</span>;
        }
        const origemLabel =
          origem === 'APONTAMENTO_CE' ? 'Último apontamento C&E'
          : origem === 'DISPONIBILIDADE' ? 'Última disponibilidade operacional'
          : 'Sem alocação';
        const origemTone =
          origem === 'APONTAMENTO_CE' ? 'default'
          : origem === 'DISPONIBILIDADE' ? 'secondary'
          : 'outline';
        return (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[220px]">{codigo ? `${codigo} — ${nome}` : nome}</span>
                  <Badge variant={origemTone as any} className="text-[10px] uppercase tracking-wide">
                    {origem === 'APONTAMENTO_CE' ? 'C&E' : origem === 'DISPONIBILIDADE' ? 'Disp.' : '—'}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="text-xs">
                  <div className="font-medium">Fonte: {origemLabel}</div>
                  {v.centro_custo_atualizado_em && (
                    <div className="text-muted-foreground">
                      Atualizado em {new Date(v.centro_custo_atualizado_em).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "situacao",
      header: "Situação",
      cell: ({ row }) => {
        const situacao = row.original.situacao;
        return <VeiculoStatusBadge situacao={situacao} />;
      },
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const veiculo = row.original;
        return (
          <VeiculoActions 
            veiculo={veiculo}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        );
      },
    },
  ];
};
