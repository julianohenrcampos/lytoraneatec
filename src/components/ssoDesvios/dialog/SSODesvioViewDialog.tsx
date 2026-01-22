import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SSODesvio, getClassificacaoColor, getStatusColor } from '@/types/ssoDesvios';
import { useSSODesvio } from '@/hooks/ssoDesvios/useSSODesvio';
import { ssoDesvioStorageService } from '@/services/ssoDesvios';
import { Loader2, Building2, User, Calendar, FileText, AlertTriangle, CheckCircle, Camera } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface SSODesvioViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desvioId: string;
}

export const SSODesvioViewDialog: React.FC<SSODesvioViewDialogProps> = ({
  open,
  onOpenChange,
  desvioId
}) => {
  const { desvio, isLoading } = useSSODesvio(desvioId);

  // Carregar URLs das fotos
  const { data: fotosComUrl = [] } = useQuery({
    queryKey: ['desvio-fotos', desvioId],
    queryFn: async () => {
      if (!desvio?.bd_registro_desvios_fotos) return [];
      
      const fotos = await Promise.all(
        desvio.bd_registro_desvios_fotos.map(async (foto) => {
          const url = await ssoDesvioStorageService.getSignedUrl(foto.path);
          return { ...foto, url };
        })
      );
      return fotos;
    },
    enabled: !!desvio?.bd_registro_desvios_fotos?.length
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!desvio) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Registro de Desvio</span>
            <Badge variant="outline" className="font-mono">
              {desvio.numero_relatorio}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Badges de Status */}
            <div className="flex flex-wrap gap-2">
              <Badge className={getClassificacaoColor(desvio.classificacao_desvio)}>
                {desvio.classificacao_desvio}
              </Badge>
              <Badge className={getStatusColor(desvio.status_acao)}>
                {desvio.status_acao}
              </Badge>
              {desvio.reincidencia && (
                <Badge variant="destructive">Reincidente</Badge>
              )}
            </div>

            {/* Identificação */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Obra:</span>
                  <p className="font-medium">{desvio.bd_centros_custo?.nome_centro_custo || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data do Registro:</span>
                  <p className="font-medium">{formatDate(desvio.data_registro)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Gerência Regional:</span>
                  <p className="font-medium">{desvio.gerente_regional}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Engenheiro da Obra:</span>
                  <p className="font-medium">{desvio.engenheiro_obra}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Técnico de Segurança:</span>
                  <p className="font-medium">{desvio.tecnico_seguranca}</p>
                </div>
                {desvio.encarregado_mestre && (
                  <div>
                    <span className="text-muted-foreground">Encarregado/Mestre:</span>
                    <p className="font-medium">{desvio.encarregado_mestre}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Tipos de Desvio */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Tipos de Desvio
              </h3>
              <div className="space-y-2">
                {desvio.tipos_desvio?.map((tipo, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{tipo}</span>
                  </div>
                ))}
                {desvio.tipo_outros && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <span className="text-muted-foreground">Outros: </span>
                    {desvio.tipo_outros}
                  </div>
                )}
              </div>
            </Card>

            {/* Análise Técnica */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Análise Técnica
              </h3>
              <p className="text-sm whitespace-pre-wrap">{desvio.analise_tecnica}</p>
            </Card>

            {/* Ações Corretivas */}
            {(desvio.adequacao_imediata || desvio.responsavel_acao || desvio.prazo_correcao) && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Ações Corretivas
                </h3>
                <div className="space-y-3 text-sm">
                  {desvio.adequacao_imediata && (
                    <div>
                      <span className="text-muted-foreground">Adequação Imediata:</span>
                      <p className="font-medium">{desvio.adequacao_imediata}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {desvio.responsavel_acao && (
                      <div>
                        <span className="text-muted-foreground">Responsável:</span>
                        <p className="font-medium">{desvio.responsavel_acao}</p>
                      </div>
                    )}
                    {desvio.prazo_correcao && (
                      <div>
                        <span className="text-muted-foreground">Prazo:</span>
                        <p className="font-medium">{formatDate(desvio.prazo_correcao)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Fotos */}
            {fotosComUrl.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Registro Fotográfico
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {fotosComUrl.map((foto, index) => (
                    <div key={index} className="space-y-1">
                      <img
                        src={foto.url || ''}
                        alt={foto.legenda || `Foto ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => foto.url && window.open(foto.url, '_blank')}
                      />
                      {foto.legenda && (
                        <p className="text-xs text-muted-foreground">{foto.legenda}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
