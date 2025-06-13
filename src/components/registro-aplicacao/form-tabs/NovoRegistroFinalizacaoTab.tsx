
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, FileText, CheckCircle, AlertTriangle, Eye, Save, Calculator } from "lucide-react";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { UseFormReturn } from "react-hook-form";
import { CargaComAplicacoes } from "@/hooks/registro-aplicacao/useMultipleApplications";
import { useEspessuraMedia } from "@/hooks/registro-aplicacao/useEspessuraMedia";
import EspessuraMediaCard from "../EspessuraMediaCard";

interface NovoRegistroFinalizacaoTabProps {
  form: UseFormReturn<any>;
  entrega: ListaProgramacaoEntrega;
  registroCarga: RegistroCarga | null;
  onPrevious: () => void;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  isReadOnly?: boolean;
  cargaInfo?: CargaComAplicacoes | null;
}

const NovoRegistroFinalizacaoTab: React.FC<NovoRegistroFinalizacaoTabProps> = ({
  form,
  entrega,
  registroCarga,
  onPrevious,
  onClose,
  onSubmit,
  isLoading,
  isReadOnly = false,
  cargaInfo
}) => {
  const {
    register,
    formState: { errors },
    watch,
    getValues
  } = form;

  // Watch dos campos necessários para validação
  const horaSaidaCaminhao = watch("hora_saida_caminhao");
  const horaChegadaLocal = watch("hora_chegada_local");
  const temperaturaChegada = watch("temperatura_chegada");
  const anotacoesApontador = watch("anotacoes_apontador");
  const dataAplicacao = watch("data_aplicacao");

  // Validação simplificada: apenas campos obrigatórios
  const isFormValid = Boolean(
    dataAplicacao?.trim() && 
    horaSaidaCaminhao?.trim() && 
    horaChegadaLocal?.trim()
  );

  // Verificar se há dados existentes
  const hasExistingData = Boolean(
    horaChegadaLocal || 
    temperaturaChegada || 
    anotacoesApontador
  );

  // Hook para calcular espessura média das aplicações da carga
  const espessuraInfo = useEspessuraMedia(cargaInfo?.detalhesAplicacoes || []);

  // Handler para o submit com validação simplificada
  const handleSaveClick = () => {
    console.log("=== CLIQUE NO BOTÃO SALVAR ===");
    console.log("Form data atual:", {
      dataAplicacao,
      horaChegadaLocal,
      horaSaidaCaminhao,
      temperaturaChegada,
      isFormValid
    });

    if (!isFormValid) {
      console.error("❌ Campos obrigatórios não preenchidos");
      return;
    }

    console.log("✅ Validações passaram - chamando onSubmit");
    
    // Obter todos os dados do formulário
    const formData = getValues();
    console.log("Dados completos do formulário:", formData);
    
    // Chamar o onSubmit diretamente
    onSubmit(formData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isReadOnly && <Eye className="h-5 w-5" />}
            {hasExistingData && !isReadOnly && <Save className="h-5 w-5 text-blue-500" />}
            <FileText className="h-5 w-5" />
            {isReadOnly ? "Finalização do Registro (Visualização)" : 
             hasExistingData ? "Finalização do Registro (Editando)" : "Finalização do Registro"}
          </CardTitle>
          {isReadOnly && (
            <p className="text-sm text-muted-foreground">
              Esta entrega está finalizada e os dados são somente para visualização.
            </p>
          )}
          {hasExistingData && !isReadOnly && (
            <p className="text-sm text-blue-600">
              Dados existentes carregados. Você pode modificar e salvar as alterações.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Validação do formulário */}
          {!isFormValid && !isReadOnly && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div>Complete os campos obrigatórios para finalizar:</div>
                  <ul className="text-sm space-y-1 ml-4">
                    {!dataAplicacao?.trim() && (
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        Data da aplicação
                      </li>
                    )}
                    {!horaChegadaLocal?.trim() && (
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        Hora de chegada no local
                      </li>
                    )}
                    {!horaSaidaCaminhao?.trim() && (
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        Hora de saída do caminhão
                      </li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Indicador de dados existentes */}
          {hasExistingData && (
            <Alert className="bg-blue-50 border-blue-200">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Dados previamente salvos carregados automaticamente. 
                {horaChegadaLocal && ` Chegada: ${horaChegadaLocal}`}
                {temperaturaChegada && ` | Temperatura: ${temperaturaChegada}°C`}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="hora_chegada_local" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora de Chegada *
                {horaChegadaLocal && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Atual: {horaChegadaLocal}
                  </Badge>
                )}
              </Label>
              <Input
                id="hora_chegada_local"
                type="time"
                {...register("hora_chegada_local", { required: "Hora de chegada é obrigatória" })}
                disabled={isReadOnly}
                className={isReadOnly ? "bg-muted" : horaChegadaLocal ? "border-blue-300 bg-blue-50" : ""}
                placeholder="HH:MM"
              />
              {errors.hora_chegada_local && (
                <span className="text-sm text-red-500">
                  {String(errors.hora_chegada_local.message)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_saida_caminhao" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora de Saída do Caminhão *
                {horaSaidaCaminhao && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Atual: {horaSaidaCaminhao}
                  </Badge>
                )}
              </Label>
              <Input
                id="hora_saida_caminhao"
                type="time"
                {...register("hora_saida_caminhao", { required: "Hora de saída é obrigatória" })}
                disabled={isReadOnly}
                className={isReadOnly ? "bg-muted" : horaSaidaCaminhao ? "border-blue-300 bg-blue-50" : ""}
                placeholder="HH:MM"
              />
              {errors.hora_saida_caminhao && (
                <span className="text-sm text-red-500">
                  {String(errors.hora_saida_caminhao.message)}
                </span>
              )}
            </div>
          </div>

          {/* Status visual */}
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <Badge variant="secondary" className={isFormValid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
              {isFormValid ? "Pronto para Salvar" : "Dados Incompletos"}
            </Badge>
            {hasExistingData && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                Dados Existentes Carregados
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperatura_chegada">
              Temperatura de Chegada (°C)
              {temperaturaChegada && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Atual: {temperaturaChegada}°C
                </Badge>
              )}
            </Label>
            <Input
              id="temperatura_chegada"
              type="number"
              step="0.1"
              {...register("temperatura_chegada", { valueAsNumber: true })}
              disabled={isReadOnly}
              className={isReadOnly ? "bg-muted" : temperaturaChegada ? "border-blue-300 bg-blue-50" : ""}
              placeholder="Ex: 150"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="anotacoes_apontador">
              Observações Gerais do Apontamento
              {anotacoesApontador && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Com observações
                </Badge>
              )}
            </Label>
            <Textarea
              id="anotacoes_apontador"
              placeholder="Observações gerais sobre todo o apontamento..."
              {...register("anotacoes_apontador")}
              rows={3}
              disabled={isReadOnly}
              className={isReadOnly ? "bg-muted" : anotacoesApontador ? "border-blue-300 bg-blue-50" : ""}
            />
          </div>

          {/* Informações da carga */}
          {registroCarga && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Informações da Carga</h4>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-blue-600">Massa total da carga:</span>
                  <span className="ml-2 font-medium">{registroCarga.tonelada_real?.toFixed(2)}t</span>
                </div>
                {cargaInfo && (
                  <>
                    <div>
                      <span className="text-blue-600">Aplicações registradas:</span>
                      <span className="ml-2 font-medium">{cargaInfo.aplicacoes?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Total aplicado:</span>
                      <span className="ml-2 font-medium">{cargaInfo.totalAplicado?.toFixed(2) || '0.00'}t</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Card de Espessura Média - só mostra se há aplicações */}
          {cargaInfo && cargaInfo.detalhesAplicacoes && cargaInfo.detalhesAplicacoes.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Resumo Técnico da Carga
              </h4>
              <EspessuraMediaCard 
                espessuraInfo={espessuraInfo}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {/* Debug info em desenvolvimento */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-100 p-3 rounded text-xs">
              <details>
                <summary className="cursor-pointer font-medium">Debug Info</summary>
                <div className="mt-2 space-y-1">
                  <div>isFormValid: {String(isFormValid)}</div>
                  <div>hasExistingData: {String(hasExistingData)}</div>
                  <div>isLoading: {String(isLoading)}</div>
                  <div>Data aplicação: {dataAplicacao || 'vazio'}</div>
                  <div>Hora chegada: {horaChegadaLocal || 'vazio'}</div>
                  <div>Hora saída: {horaSaidaCaminhao || 'vazio'}</div>
                  <div>Aplicações na carga: {cargaInfo?.detalhesAplicacoes?.length || 0}</div>
                  <div>Espessura média: {espessuraInfo.espessuraMedia} cm</div>
                </div>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious} disabled={isReadOnly || isLoading}>
          Anterior
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {isReadOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!isReadOnly && (
            <Button
              onClick={handleSaveClick}
              disabled={isLoading || !isFormValid}
              className="bg-green-500 hover:bg-green-600"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Salvando...
                </>
              ) : hasExistingData ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Atualizar Aplicação
                </>
              ) : (
                "Salvar Aplicação"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovoRegistroFinalizacaoTab;
