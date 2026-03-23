import { Card } from "@/components/ui/card";
import { formatCPF } from "@/utils/textTransform";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileSignature } from "lucide-react";

interface AssinaturaPreviewCardProps {
  nome: string;
  cargo?: string | null;
  cpf?: string | null;
  assinaturaUrl?: string | null; // signed URL pronta
  dataHora?: string | null;
  hash?: string | null;
  ip?: string | null;
}

function formatDataHora(value?: string | null): string {
  if (!value) return "-";
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return value;
  }
}

function truncateHash(hash?: string | null): string {
  if (!hash) return "-";
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

export default function AssinaturaPreviewCard({
  nome,
  cargo,
  cpf,
  assinaturaUrl,
  dataHora,
  hash,
  ip,
}: AssinaturaPreviewCardProps) {
  return (
    <Card className="max-w-[320px] w-full mx-auto bg-card border rounded-lg shadow-sm p-5">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase mb-3">
        Aprovado por
      </p>

      {/* Assinatura */}
      <div className="flex items-center justify-center min-h-[80px] mb-3 border-b border-dashed pb-3">
        {assinaturaUrl ? (
          <img
            src={assinaturaUrl}
            alt={`Assinatura de ${nome}`}
            className="max-h-24 max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <FileSignature className="h-8 w-8 opacity-40" />
            <span className="text-xs">Assinatura não disponível</span>
          </div>
        )}
      </div>

      {/* Identificação */}
      <p className="font-semibold text-sm text-foreground leading-tight">{nome}</p>
      {cargo && (
        <p className="text-sm text-muted-foreground leading-tight">{cargo}</p>
      )}
      {cpf && (
        <p className="text-sm text-muted-foreground leading-tight">
          CPF: {formatCPF(cpf)}
        </p>
      )}

      {/* Metadados */}
      <div className="mt-2 pt-2 border-t space-y-0.5">
        <p className="text-[11px] text-muted-foreground">
          Data: {formatDataHora(dataHora)}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono">
          Hash: {truncateHash(hash)}
        </p>
        {ip && (
          <p className="text-[11px] text-muted-foreground">IP: {ip}</p>
        )}
      </div>
    </Card>
  );
}
