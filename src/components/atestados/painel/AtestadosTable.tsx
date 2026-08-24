import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { primeiroNome } from "@/utils/primeiroNome";
import { cn } from "@/lib/utils";

interface Props {
  rows: AtestadoRow[];
  isLoading: boolean;
  canDownload: boolean;
  canMarcarLido?: boolean;
  onVer: (row: AtestadoRow) => void;
  onAbrirArquivo: (row: AtestadoRow) => void;
  onToggleLido?: (row: AtestadoRow, lido: boolean) => void;
  togglingId?: string | null;
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
  canMarcarLido = false,
  onVer,
  onAbrirArquivo,
  onToggleLido,
  togglingId,
}: Props) {
  return (
    <div className="border border-border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lido</TableHead>
            <TableHead>Protocolo</TableHead>
            <TableHead>Tipo</TableHead>
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
              <TableCell colSpan={14} className="text-center py-8">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                Nenhum documento encontrado.
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            rows.map((r) => (
              <TableRow
                key={r.id}
                className={cn(
                  r.lido
                    ? "bg-success/10 hover:bg-success/20"
                    : "bg-warning/10 hover:bg-warning/20",
                )}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {togglingId === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={r.lido}
                        disabled={!canMarcarLido || !onToggleLido}
                        onCheckedChange={(v) => onToggleLido?.(r, v)}
                        aria-label={
                          r.lido
                            ? `Marcar protocolo ${r.protocolo} como não lido`
                            : `Marcar protocolo ${r.protocolo} como lido`
                        }
                        className={cn(
                          r.lido
                            ? "data-[state=checked]:bg-success"
                            : "data-[state=unchecked]:bg-warning",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-xs font-medium",
                        r.lido ? "text-success" : "text-warning",
                      )}
                    >
                      {r.lido ? "Sim" : "Não"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.protocolo}</TableCell>
                <TableCell className="text-xs">
                  {r.tipo_documento_descricao ?? "Atestado Médico"}
                </TableCell>
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
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant="outline">{r.status}</Badge>
                    {r.lido && r.lido_por_nome && (
                      <span className="text-[11px] text-muted-foreground">
                        lido por: {primeiroNome(r.lido_por_nome)}
                      </span>
                    )}
                  </div>
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
