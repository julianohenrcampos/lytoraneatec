import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useVerAgir } from '@/hooks/ssoVerAgir';
import { getStatusColor, getStatusLabel } from '@/types/ssoVerAgir';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { Loader2, Image, ImageOff } from 'lucide-react';

interface VerAgirViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registroId: string;
}

export const VerAgirViewDialog: React.FC<VerAgirViewDialogProps> = ({
  open,
  onOpenChange,
  registroId
}) => {
  const { registro, isLoading, getSignedUrl } = useVerAgir(registroId);
  const [fotoAntesUrl, setFotoAntesUrl] = useState<string | null>(null);
  const [fotoDepoisUrl, setFotoDepoisUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadPhotos = async () => {
      if (registro) {
        if (registro.foto_antes_url) {
          const url = await getSignedUrl(registro.foto_antes_url);
          setFotoAntesUrl(url);
        }
        if (registro.foto_depois_url) {
          const url = await getSignedUrl(registro.foto_depois_url);
          setFotoDepoisUrl(url);
        }
      }
    };

    if (open && registro) {
      loadPhotos();
    }
  }, [open, registro, getSignedUrl]);

  useEffect(() => {
    if (!open) {
      setFotoAntesUrl(null);
      setFotoDepoisUrl(null);
    }
  }, [open]);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!registro) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Visualizar Registro - Ver e Agir</DialogTitle>
            <Badge className={getStatusColor(registro.status)}>
              {getStatusLabel(registro.status)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Identificação */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identificação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Téc. Seg. Trabalho:</span>
                  <p>{registro.tecnico_seguranca_nome}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Engenheiro(a):</span>
                  <p>{registro.engenheiro_nome}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Obra:</span>
                  <p>{registro.obra}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Local:</span>
                  <p>{registro.local}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Data:</span>
                  <p>{formatBrazilianDateForDisplay(registro.data_registro)}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Hora:</span>
                  <p>{registro.hora_registro?.slice(0, 5)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Descrição */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Descrição da Não Conformidade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{registro.descricao_nao_conformidade}</p>
            </CardContent>
          </Card>

          {/* Evidências */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Evidências Fotográficas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    ANTES
                  </p>
                  {fotoAntesUrl ? (
                    <img
                      src={fotoAntesUrl}
                      alt="Foto Antes"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-lg">
                      <ImageOff className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Sem foto</span>
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    DEPOIS
                  </p>
                  {fotoDepoisUrl ? (
                    <img
                      src={fotoDepoisUrl}
                      alt="Foto Depois"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-lg">
                      <ImageOff className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Sem foto</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Solução */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resultados Alcançados / Solução</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{registro.resultado_alcancado_solucao}</p>
            </CardContent>
          </Card>

          {/* Metadados */}
          <div className="text-xs text-muted-foreground">
            <p>Criado em: {format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            {registro.updated_at && (
              <p>Atualizado em: {format(new Date(registro.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
