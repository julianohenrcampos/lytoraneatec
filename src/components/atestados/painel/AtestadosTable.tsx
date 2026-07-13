import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, FileText, Loader2 } from "lucide-react";
import type { AtestadoRow } from "@/types/atestadoMedico";

interface Props {
  rows: AtestadoRow[];
  isLoading: boolean;
  canDownload: boolean;
  onVer: (row: AtestadoRow) => void;
  onAbrirArquivo: (row: AtestadoRow) => void;
}

function mask(m: string) {
  if (!m) return "";
  if (m.length <= 3) return m;
  return `${m.slice(0, 2)}${"*".repeat(Math.max(0, m.length - 3))}${m.slice(-1)}`;
}

function fmtBRT(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function AtestadosTable({
  rows,
  isLoading,
  canDownload,
  onVer,
  onAbrirArquivo,
}: Props) {
  return (
    <div className="border border-border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Protocolo</TableHead>
            <TableHead>Enviado em</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>Matrícula</TableHead>
            <TableHead>Centro de custo</TableHead>
            <TableHead>Emissão</TableHead>
            <TableHead>Início afast.</TableHead>
            <TableHead className="text-right">Dias</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-8">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                Nenhum atestado encontrado.
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.protocolo}</TableCell>
                <TableCell className="text-xs">{fmtBRT(r.enviado_em)}</TableCell>
                <TableCell>{r.nome_snapshot}</TableCell>
                <TableCell className="font-mono text-xs">
                  {mask(r.matricula_snapshot)}
                </TableCell>
                <TableCell className="text-xs">
                  {r.centro_custo_snapshot ?? "—"}
                </TableCell>
                <TableCell className="text-xs">{fmtDate(r.data_emissao)}</TableCell>
                <TableCell className="text-xs">
                  {fmtDate(r.data_inicio_afastamento)}
                </TableCell>
                <TableCell className="text-right">{r.dias_afastamento}</TableCell>
                <TableCell>
                  {r.dentro_prazo_24h ? (
                    <Badge variant="secondary">Dentro 24h</Badge>
                  ) : (
                    <Badge variant="destructive">Fora</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.notificacao_email_status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onVer(r)}
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canDownload && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAbrirArquivo(r)}
                        title="Ver arquivo"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
