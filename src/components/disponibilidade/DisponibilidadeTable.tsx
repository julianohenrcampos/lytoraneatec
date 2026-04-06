import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil } from "lucide-react";
import { DisponibilidadeEquipamento } from "@/services/disponibilidadeEquipamentoService";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";

interface Props {
  data: DisponibilidadeEquipamento[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (item: DisponibilidadeEquipamento) => void;
}

const statusConfig: Record<string, { className: string; label: string }> = {
  DISPONIVEL: { className: "bg-green-100 text-green-800", label: "Disponível" },
  ALOCADO: { className: "bg-blue-100 text-blue-800", label: "Alocado" },
  MANUTENCAO: { className: "bg-yellow-100 text-yellow-800", label: "Manutenção" },
  INDISPONIVEL: { className: "bg-red-100 text-red-800", label: "Indisponível" },
};

const confiabilidadeConfig: Record<string, string> = {
  ALTA: "bg-green-100 text-green-800",
  MEDIA: "bg-yellow-100 text-yellow-800",
  BAIXA: "bg-red-100 text-red-800",
};

const DisponibilidadeTable: React.FC<Props> = ({ data, isLoading, isError, onEdit }) => {
  const pagination = usePagination(data, { pageSize: 10 });

  if (isError) return <div className="rounded-md border border-destructive p-8 text-center"><p className="text-destructive">Erro ao carregar dados.</p></div>;
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (data.length === 0) return <div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Nenhum registro encontrado.</p></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Previsão Liberação</TableHead>
              <TableHead>Confiabilidade</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((d) => {
              const st = statusConfig[d.status_operacional] || { className: "", label: d.status_operacional };
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.equipamento_codigo_frota || "-"}{d.equipamento_numero_frota ? `-${d.equipamento_numero_frota}` : ""}</TableCell>
                  <TableCell>{d.tipo_equipamento_descricao || "-"}</TableCell>
                  <TableCell>{d.empresa_nome || "-"}</TableCell>
                  <TableCell>{d.centro_custo_codigo ? `${d.centro_custo_codigo} - ${d.centro_custo_nome}` : d.centro_custo_nome || "-"}</TableCell>
                  <TableCell>{d.departamento_nome || "-"}</TableCell>
                  <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
                  <TableCell>{d.previsao_liberacao || "-"}</TableCell>
                  <TableCell>
                    {d.confiabilidade_previsao ? (
                      <Badge variant="outline" className={confiabilidadeConfig[d.confiabilidade_previsao] || ""}>{d.confiabilidade_previsao}</Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(d)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && <TablePagination pagination={pagination} />}
    </div>
  );
};

export default DisponibilidadeTable;
