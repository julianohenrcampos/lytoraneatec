import React, { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeyRound, MoreHorizontal, Pencil, Power } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  PontoDispositivoAdmin,
} from "@/services/pontoDispositivosService";

interface VinculoLite {
  dispositivo_id: string;
  centro_custo_id: string;
  centro_custo_nome: string;
}

interface Props {
  dispositivos: PontoDispositivoAdmin[];
  vinculos: VinculoLite[];
  onEdit: (d: PontoDispositivoAdmin) => void;
  onDefinirSenha: (d: PontoDispositivoAdmin) => void;
  onToggleAtivo: (d: PontoDispositivoAdmin) => void;
}

export function DispositivosTable({
  dispositivos,
  vinculos,
  onEdit,
  onDefinirSenha,
  onToggleAtivo,
}: Props) {
  const ccsByDisp = useMemo(() => {
    const map = new Map<string, string[]>();
    vinculos.forEach((v) => {
      const arr = map.get(v.dispositivo_id) ?? [];
      arr.push(v.centro_custo_nome);
      map.set(v.dispositivo_id, arr);
    });
    return map;
  }, [vinculos]);

  if (dispositivos.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Nenhum dispositivo cadastrado.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CCs</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispositivos.map((d) => {
              const ccs = ccsByDisp.get(d.id) ?? [];
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {d.codigo_dispositivo}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  <TableCell>
                    {ccs.length === 0 ? (
                      <Badge variant="secondary">Sem CC</Badge>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help">
                            {ccs.length} {ccs.length === 1 ? "CC" : "CCs"}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <ul className="space-y-1 text-xs">
                            {ccs.map((nome, i) => (
                              <li key={i}>• {nome}</li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.tem_senha ? (
                      <Badge variant="outline" className="text-xs">
                        Definida
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Não definida
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.ultimo_login_at
                      ? formatDistanceToNow(new Date(d.ultimo_login_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.ativo ? "default" : "secondary"}>
                      {d.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(d)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDefinirSenha(d)}>
                          <KeyRound className="mr-2 h-4 w-4" /> Definir senha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onToggleAtivo(d)}>
                          <Power className="mr-2 h-4 w-4" />
                          {d.ativo ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
