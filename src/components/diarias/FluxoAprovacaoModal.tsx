import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useDocumentosFluxo, useDocumentosRelacionados } from '@/hooks/diarias/useFluxoAprovacao';
import type { DiariaSolicitacao, DocumentoFluxo } from '@/types/diarias';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FluxoAprovacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitacao: DiariaSolicitacao | null;
  etapa: 'gerente_adm' | 'diretor_operacional' | 'diretor_adm';
  onAprovar: () => void;
  onReprovar: (observacao?: string) => void;
  isLoading?: boolean;
}

function DocumentoFilhosLista({ documentoId }: { documentoId: string }) {
  const { data: relacoes, isLoading } = useDocumentosRelacionados(documentoId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!relacoes?.length) return <p className="text-sm text-muted-foreground">Nenhum documento vinculado</p>;

  return (
    <ul className="space-y-1 ml-4">
      {relacoes.map((r) => (
        <li key={r.id} className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>Documento {r.documento_filho_id.slice(0, 8)}...</span>
        </li>
      ))}
    </ul>
  );
}

function DocumentoCard({ doc }: { doc: DocumentoFluxo }) {
  const [expandido, setExpandido] = useState(false);
  const isCompilado = doc.tipo_documento === 'documento_compilado';

  return (
    <Card className={isCompilado ? 'border-primary/30 bg-primary/5' : ''}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {doc.tipo_documento.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            {doc.versao > 1 && <span className="text-xs text-muted-foreground">v{doc.versao}</span>}
          </CardTitle>
          {isCompilado && (
            <Button variant="ghost" size="xs" onClick={() => setExpandido(!expandido)}>
              {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="ml-1 text-xs">Ver detalhes</span>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Etapa {doc.etapa_origem || '-'} •{' '}
          {doc.criado_em ? format(new Date(doc.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
        </p>
      </CardHeader>
      {expandido && isCompilado && (
        <CardContent className="pt-0 pb-3 px-4">
          <DocumentoFilhosLista documentoId={doc.id} />
        </CardContent>
      )}
    </Card>
  );
}

export default function FluxoAprovacaoModal({
  open,
  onOpenChange,
  solicitacao,
  etapa,
  onAprovar,
  onReprovar,
  isLoading = false,
}: FluxoAprovacaoModalProps) {
  const [observacao, setObservacao] = useState('');
  const [modoReprovar, setModoReprovar] = useState(false);

  const { data: documentos, isLoading: loadingDocs } = useDocumentosFluxo(
    open ? solicitacao?.id : undefined
  );

  if (!solicitacao) return null;

  const etapaLabel = etapa === 'gerente_adm' ? 'Gerente ADM' : etapa === 'diretor_operacional' ? 'Diretor Operacional' : 'Diretor ADM';
  const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    solicitacao.valor_estimado_total || 0
  );

  const handleReprovar = () => {
    if (!modoReprovar) {
      setModoReprovar(true);
      return;
    }
    onReprovar(observacao || undefined);
    setModoReprovar(false);
    setObservacao('');
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setModoReprovar(false);
      setObservacao('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprovação — {etapaLabel}</DialogTitle>
          <DialogDescription>
            Solicitação #{solicitacao.numero_solicitacao}
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Centro de Custo:</span>
            <p className="font-medium">{solicitacao.bd_centros_custo?.nome_centro_custo || '-'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Valor Estimado:</span>
            <p className="font-medium">{valorFormatado}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Período:</span>
            <p className="font-medium">
              {format(new Date(solicitacao.data_inicio), 'dd/MM/yyyy')} —{' '}
              {format(new Date(solicitacao.data_fim), 'dd/MM/yyyy')}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Etapa Atual:</span>
            <p className="font-medium">{solicitacao.etapa_atual || '-'}</p>
          </div>
        </div>

        {/* Documentos */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Documentos</h4>
          {loadingDocs ? (
            <p className="text-sm text-muted-foreground">Carregando documentos...</p>
          ) : !documentos?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum documento encontrado</p>
          ) : (
            <div className="space-y-2">
              {documentos
                .sort((a, b) => (a.tipo_documento === 'documento_compilado' ? -1 : 1))
                .map((doc) => (
                  <DocumentoCard key={doc.id} doc={doc} />
                ))}
            </div>
          )}
        </div>

        {/* Campo de observação (reprovação) */}
        {modoReprovar && (
          <div>
            <label className="text-sm font-medium">Observação (opcional)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Motivo da reprovação..."
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={handleReprovar}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
            {modoReprovar ? 'Confirmar Reprovação' : 'Reprovar'}
          </Button>
          {!modoReprovar && (
            <Button onClick={onAprovar} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Aprovar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
