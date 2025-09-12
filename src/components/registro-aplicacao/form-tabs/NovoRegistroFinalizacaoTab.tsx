import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, FileText, CheckCircle, AlertTriangle, Eye, Save, Calculator, Database, Scale, TrendingDown, BarChart3, PieChart } from "lucide-react";
import { TooltipHelper } from "../TooltipHelper";
import { safeToast } from "@/utils/safeToast";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { UseFormReturn } from "react-hook-form";
import { CargaComAplicacoes } from "@/hooks/registro-aplicacao/useMultipleApplications";
import { useEspessuraMedia } from "@/hooks/registro-aplicacao/useEspessuraMedia";
import { formatPesoParaToneladas, formatMassaFromDatabase } from "@/utils/massaConversionUtils";
import EspessuraMediaCard from "../EspessuraMediaCard";
interface NovoRegistroFinalizacaoTabProps {
  form: UseFormReturn<any>;
  entrega: ListaProgramacaoEntrega;
  registroCarga: RegistroCarga | null;
  onPrevious: () => void;
  onClose: () => void;
  onSubmit: (data: any, options?: {
    onSuccess?: () => void;
  }) => void;
  isLoading: boolean;
  isReadOnly?: boolean;
  cargaInfo?: CargaComAplicacoes | null;
  registroExistente?: any;
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
  cargaInfo,
  registroExistente
}) => {
  const navigate = useNavigate();
  const {
    register,
    formState: {
      errors
    },
    watch,
    getValues,
    setValue
  } = form;

  // Watch dos campos necessários para validação
  const horaSaidaCaminhao = watch("hora_saida_caminhao");
  const horaChegadaLocal = watch("hora_chegada_local");
  const temperaturaChegada = watch("temperatura_chegada");
  const anotacoesApontador = watch("anotacoes_apontador");
  const dataAplicacao = watch("data_aplicacao");
  const toneladaAplicada = watch("tonelada_aplicada");

  // CORREÇÃO: Garantir que tonelada_aplicada seja sempre preenchida
  React.useEffect(() => {
    const toneladaAtual = toneladaAplicada || 0;
    // CORREÇÃO: tonelada_real está em KG, converter para toneladas
    const massaCarga = registroCarga?.tonelada_real ? formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real') : 0;
    if (toneladaAtual <= 0 && massaCarga > 0) {
      console.log("🔄 [FINALIZACAO] Auto-preenchendo tonelada_aplicada:", massaCarga);
      setValue("tonelada_aplicada", massaCarga);
    }
  }, [toneladaAplicada, registroCarga?.tonelada_real, setValue]);

  // Verificar se temos dados salvos no banco (registro existente + valores preenchidos)
  const hasDataInDatabase = Boolean(registroExistente);
  const hasFormData = Boolean(horaChegadaLocal || temperaturaChegada || anotacoesApontador);
  const hasExistingData = hasDataInDatabase || hasFormData;

  // CORREÇÃO: Validação mais rigorosa
  const isFormValid = React.useMemo(() => {
    const toneladaFinal = toneladaAplicada || (registroCarga?.tonelada_real ? formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real') : 0);
    const hasRequiredData = Boolean(dataAplicacao?.trim() && horaChegadaLocal?.trim() && toneladaFinal > 0);
    console.log("🔍 [FINALIZACAO] Validação:", {
      dataAplicacao: dataAplicacao?.trim(),
      horaChegadaLocal: horaChegadaLocal?.trim(),
      toneladaAplicada,
      toneladaFinal,
      hasRequiredData
    });
    return hasRequiredData;
  }, [dataAplicacao, horaChegadaLocal, toneladaAplicada, registroCarga?.tonelada_real]);

  // Hook para calcular espessura média das aplicações da carga
  const espessuraInfo = useEspessuraMedia(cargaInfo?.detalhesAplicacoes || []);

  // Calcular massa remanescente
  const massaRemanescente = React.useMemo(() => {
    if (!registroCarga?.tonelada_real) return 0;

    // CORREÇÃO: Converter tonelada_real de kg para toneladas
    const massaTotal = formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real');
    const toneladaAtual = toneladaAplicada || massaTotal;
    const remanescente = massaTotal - toneladaAtual;
    return Math.max(0, remanescente);
  }, [registroCarga, toneladaAplicada]);

  // Verificar se já existe registro de retorno no banco
  const [temRetornoRegistrado, setTemRetornoRegistrado] = React.useState(false);
  React.useEffect(() => {
    // Verificar se há peso de retorno registrado no registro de carga
    if (registroCarga?.tonelada_retorno && registroCarga.tonelada_retorno > 0) {
      setTemRetornoRegistrado(true);
    }
  }, [registroCarga]);

  // Mostrar botão de retorno de massa apenas se:
  // 1. Há massa remanescente significativa (> 0.001t)
  // 2. Ainda não foi registrado retorno
  // 3. Não está em modo somente leitura
  const mostrarBotaoRetorno = massaRemanescente > 0.001 && !temRetornoRegistrado && !isReadOnly;

  // Handler para navegação para o registro de cargas
  const handleRetornoMassa = () => {
    if (!entrega?.id) {
      safeToast.error("ID da entrega não encontrado");
      return;
    }
    safeToast.info(`Redirecionando para pesagem de retorno: ${massaRemanescente.toFixed(2)}t`);

    // Fechar modal atual
    onClose();

    // Navegar para registro de cargas com parâmetro de retorno
    navigate(`/requisicoes/registro-cargas?retorno=${entrega.id}&massa=${massaRemanescente.toFixed(3)}`);
  };

  // CORREÇÃO: Handler com callback direto para fechar modal
  const handleSaveClick = async () => {
    console.log("=== CLIQUE NO BOTÃO SALVAR - INÍCIO ===");
    if (!isFormValid) {
      console.error("❌ [FINALIZACAO] Validação falhou");
      safeToast.error("Preencha todos os campos obrigatórios");
      return;
    }
    console.log("✅ [FINALIZACAO] Validações OK - preparando dados");
    try {
      // Obter dados do formulário
      const formData = getValues();

      // CORREÇÃO: Garantir que tonelada_aplicada seja preenchida
      const toneladaFinal = formData.tonelada_aplicada || registroCarga?.tonelada_real || 0;
      if (toneladaFinal <= 0) {
        console.error("❌ [FINALIZACAO] Tonelada aplicada inválida:", toneladaFinal);
        safeToast.error("Tonelada aplicada deve ser maior que zero");
        return;
      }

      // Preparar dados finais
      const dadosFinais = {
        ...formData,
        tonelada_aplicada: toneladaFinal,
        lista_entrega_id: formData.lista_entrega_id || entrega.id,
        registro_carga_id: formData.registro_carga_id || registroCarga?.id
      };
      console.log("🚀 [FINALIZACAO] Dados finais preparados:", dadosFinais);
      console.log("🎯 [FINALIZACAO] Chamando onSubmit COM CALLBACK");

      // CORREÇÃO: Chamar onSubmit com callback para fechar modal
      await onSubmit(dadosFinais, {
        onSuccess: () => {
          console.log("✅ [FINALIZACAO] Callback de sucesso executado - fechando modal");
          onClose();
        }
      });
      console.log("✅ [FINALIZACAO] onSubmit executado com sucesso");
    } catch (error) {
      console.error("❌ [FINALIZACAO] Erro no handleSaveClick:", error);
      safeToast.error("Erro ao salvar registro");
    }
    console.log("=== CLIQUE NO BOTÃO SALVAR - FIM ===");
  };
  return <div className="space-y-6">
      {/* Resumo Aprimorado da Carga */}
      {cargaInfo && <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Resumo da Carga - Progresso Completo
            <TooltipHelper content="Visualização completa do progresso da aplicação desta carga, incluindo massa total, aplicada e remanescente." />
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white/70 p-4 rounded-md text-center">
              <div className="text-2xl font-bold text-blue-600">
                {registroCarga?.tonelada_real ? formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real').toFixed(1) : '0.0'}t
              </div>
              <div className="text-xs text-gray-600">Massa Total</div>
            </div>
            <div className="bg-white/70 p-4 rounded-md text-center">
              <div className="text-2xl font-bold text-green-600">{cargaInfo.totalAplicado.toFixed(1)}t</div>
              <div className="text-xs text-gray-600">Aplicado</div>
            </div>
            <div className="bg-white/70 p-4 rounded-md text-center">
              <div className="text-2xl font-bold text-orange-600">{cargaInfo.massaRemanescente.toFixed(1)}t</div>
              <div className="text-xs text-gray-600">Remanescente</div>
            </div>
            <div className="bg-white/70 p-4 rounded-md text-center">
              <div className="text-2xl font-bold text-purple-600">{cargaInfo.aplicacoes?.length || 0}</div>
              <div className="text-xs text-gray-600">Aplicações</div>
            </div>
          </div>
          
          {/* Barra de Progresso Visual */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Progresso da Aplicação</span>
              <span>{cargaInfo.percentualAplicado.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-700 flex items-center justify-end pr-2" style={{
            width: `${Math.min(cargaInfo.percentualAplicado, 100)}%`
          }}>
                {cargaInfo.percentualAplicado > 20 && <span className="text-xs font-medium text-white">
                    {cargaInfo.percentualAplicado.toFixed(0)}%
                  </span>}
              </div>
            </div>
          </div>
        </div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isReadOnly && <Eye className="h-5 w-5" />}
            {hasDataInDatabase && !isReadOnly && <Database className="h-5 w-5 text-blue-500" />}
            <FileText className="h-5 w-5" />
            {isReadOnly ? "Finalização do Registro (Visualização)" : hasDataInDatabase ? "Finalização do Registro (Dados Salvos)" : "Finalização do Registro"}
          </CardTitle>
          {isReadOnly && <p className="text-sm text-muted-foreground">
              Esta entrega está finalizada e os dados são somente para visualização.
            </p>}
          {hasDataInDatabase && !isReadOnly && <p className="text-sm text-blue-600">
              Dados encontrados no banco de dados. Você pode modificar e salvar as alterações.
            </p>}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status de dados existentes */}
          {hasDataInDatabase && <Alert className="bg-blue-50 border-blue-200">
              <Database className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="space-y-1">
                  <div className="font-medium">Dados salvos encontrados no sistema:</div>
                  <ul className="text-sm space-y-1 ml-4">
                    {registroExistente?.hora_chegada_local && <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        Hora de chegada: {registroExistente.hora_chegada_local}
                      </li>}
                    {registroExistente?.temperatura_chegada && <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        Temperatura: {registroExistente.temperatura_chegada}°C
                      </li>}
                    {registroExistente?.hora_saida_caminhao && <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        Hora de saída: {registroExistente.hora_saida_caminhao}
                      </li>}
                    {registroExistente?.anotacoes_apontador && <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        Com observações salvas
                      </li>}
                    <li className="flex items-center gap-2">
                      <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                       Tonelada aplicada: {(toneladaAplicada || (registroCarga?.tonelada_real ? formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real') : 0)).toFixed(1)}t
                    </li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>}

          {/* Validação */}
          {!isFormValid && !isReadOnly && <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div>Complete os campos obrigatórios para finalizar:</div>
                  <ul className="text-sm space-y-1 ml-4">
                    {!dataAplicacao?.trim() && <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        Data da aplicação
                      </li>}
                    {!horaChegadaLocal?.trim() && <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        Hora de chegada no local
                      </li>}
                    {(!toneladaAplicada || toneladaAplicada <= 0) && <li className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        Tonelada aplicada deve ser maior que zero
                      </li>}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="hora_chegada_local" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora de Chegada *
                {horaChegadaLocal && <Badge variant="secondary" className="ml-2 text-xs">
                    {hasDataInDatabase ? "Salvo" : "Atual"}: {horaChegadaLocal}
                  </Badge>}
              </Label>
              <Input id="hora_chegada_local" type="time" {...register("hora_chegada_local", {
              required: "Hora de chegada é obrigatória"
            })} disabled={isReadOnly} className={isReadOnly ? "bg-muted" : horaChegadaLocal ? "border-blue-300 bg-blue-50" : ""} placeholder="HH:MM" />
              {errors.hora_chegada_local && <span className="text-sm text-red-500">
                  {String(errors.hora_chegada_local.message)}
                </span>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_saida_caminhao" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora de Saída do Caminhão
                {horaSaidaCaminhao && <Badge variant="secondary" className="ml-2 text-xs">
                    {hasDataInDatabase ? "Salvo" : "Atual"}: {horaSaidaCaminhao}
                  </Badge>}
              </Label>
              <Input id="hora_saida_caminhao" type="time" {...register("hora_saida_caminhao")} disabled={isReadOnly} className={isReadOnly ? "bg-muted" : horaSaidaCaminhao ? "border-blue-300 bg-blue-50" : ""} placeholder="HH:MM" />
              <p className="text-xs text-muted-foreground">
                Preencha para finalizar a aplicação e atualizar o status
              </p>
            </div>
          </div>

          {/* Status visual melhorado */}
          <div className="flex items-center gap-2">
            <CheckCircle className={`h-5 w-5 ${isFormValid ? 'text-green-500' : 'text-red-500'}`} />
            <Badge variant="secondary" className={isFormValid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
              {isFormValid ? "Pronto para Salvar" : "Dados Incompletos"}
            </Badge>
            {hasDataInDatabase && <Badge variant="outline" className="bg-blue-100 text-blue-800">
                Dados no Banco de Dados
              </Badge>}
            <Badge variant="outline" className="bg-purple-100 text-purple-800">
                       Massa: {(toneladaAplicada || (registroCarga?.tonelada_real ? formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real') : 0)).toFixed(1)}t
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperatura_chegada">
              Temperatura de Chegada (°C)
              {temperaturaChegada && <Badge variant="secondary" className="ml-2 text-xs">
                  {hasDataInDatabase ? "Salvo" : "Atual"}: {temperaturaChegada}°C
                </Badge>}
            </Label>
            <Input id="temperatura_chegada" type="number" step="0.1" {...register("temperatura_chegada", {
            valueAsNumber: true
          })} disabled={isReadOnly} className={isReadOnly ? "bg-muted" : temperaturaChegada ? "border-blue-300 bg-blue-50" : ""} placeholder="Ex: 150" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="anotacoes_apontador">
              Observações Gerais do Apontamento
              {anotacoesApontador && <Badge variant="secondary" className="ml-2 text-xs">
                  Com observações {hasDataInDatabase ? "salvas" : ""}
                </Badge>}
            </Label>
            <Textarea id="anotacoes_apontador" placeholder="Observações gerais sobre todo o apontamento..." {...register("anotacoes_apontador")} rows={3} disabled={isReadOnly} className={isReadOnly ? "bg-muted" : anotacoesApontador ? "border-blue-300 bg-blue-50" : ""} />
          </div>

          {/* Informações da carga */}
          {registroCarga && <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-3">Resumo da Carga</h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-blue-600">Massa total da carga:</span>
                  <span className="font-medium">
                    {registroCarga.tonelada_real ? formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real').toFixed(1) : '0.0'}t
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">Massa aplicada atual:</span>
                  <span className="font-medium text-green-600">
                    {(toneladaAplicada || (registroCarga.tonelada_real ? formatMassaFromDatabase(registroCarga.tonelada_real, 'bd_registro_cargas', 'tonelada_real') : 0)).toFixed(1)}t
                  </span>
                </div>
                
              </div>

              {/* Botão de Retorno de Massa */}
              {mostrarBotaoRetorno}

              {/* Indicador de retorno já registrado */}
              {temRetornoRegistrado && <div className="mt-4 pt-3 border-t border-blue-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Retorno já registrado: {formatPesoParaToneladas(registroCarga.tonelada_retorno)}
                    </span>
                  </div>
                </div>}
            </div>}

          {/* Card de Espessura Média - só mostra se há aplicações */}
          {cargaInfo && cargaInfo.detalhesAplicacoes && cargaInfo.detalhesAplicacoes.length > 0 && <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Resumo Técnico da Carga
              </h4>
              <EspessuraMediaCard espessuraInfo={espessuraInfo} isReadOnly={isReadOnly} />
            </div>}

          {/* Debug info em desenvolvimento */}
          {process.env.NODE_ENV === 'development'}
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
          {!isReadOnly && <Button onClick={handleSaveClick} disabled={isLoading || !isFormValid} className="bg-green-500 hover:bg-green-600">
              {isLoading ? <>
                  <span className="animate-spin mr-2">⏳</span>
                  Salvando...
                </> : hasDataInDatabase ? <>
                  <Save className="h-4 w-4 mr-2" />
                  Atualizar Aplicação
                </> : "Salvar Aplicação"}
            </Button>}
        </div>
      </div>
    </div>;
};
export default NovoRegistroFinalizacaoTab;