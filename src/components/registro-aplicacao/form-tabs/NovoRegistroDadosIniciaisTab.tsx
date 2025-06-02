
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Thermometer, Calendar, Truck, Users, Building, Eye } from "lucide-react";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { UseFormReturn } from "react-hook-form";

interface NovoRegistroDadosIniciaisTabProps {
  form: UseFormReturn<any>;
  entrega: ListaProgramacaoEntrega;
  registroCarga: RegistroCarga | null;
  onNext: () => void;
  isReadOnly?: boolean;
}

const NovoRegistroDadosIniciaisTab: React.FC<NovoRegistroDadosIniciaisTabProps> = ({
  form,
  entrega,
  registroCarga,
  onNext,
  isReadOnly = false
}) => {
  const {
    register,
    formState: { errors },
    watch
  } = form;

  // Watch form values for validation
  const dataAplicacao = watch("data_aplicacao");
  const horaChegadaLocal = watch("hora_chegada_local");

  const isFormValid = dataAplicacao && horaChegadaLocal;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isReadOnly && <Eye className="h-5 w-5" />}
            <Calendar className="h-5 w-5" />
            {isReadOnly ? "Informações da Entrega (Visualização)" : "Informações da Entrega"}
          </CardTitle>
          {isReadOnly && (
            <p className="text-sm text-muted-foreground">
              Esta entrega está finalizada e os dados são somente para visualização.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Caminhão:</span>
              </div>
              <Badge variant="outline" className="text-sm">
                {entrega.caminhao?.placa || "Não informado"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Equipe:</span>
              </div>
              <Badge variant="outline" className="text-sm">
                {entrega.equipe?.nome_equipe || "Não informada"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Usina:</span>
              </div>
              <Badge variant="outline" className="text-sm">
                {entrega.usina?.nome_usina || "Não informada"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Logradouro:</span>
              </div>
              <Badge variant="outline" className="text-sm">
                {entrega.logradouro}
              </Badge>
            </div>
          </div>

          {registroCarga && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Informações da Carga</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Massa Programada:</span>
                  <span className="ml-2 font-medium">{entrega.quantidade_massa}t</span>
                </div>
                <div>
                  <span className="text-blue-600">Massa Real:</span>
                  <span className="ml-2 font-medium">{registroCarga.tonelada_real?.toFixed(2)}t</span>
                </div>
                <div>
                  <span className="text-blue-600">Data Saída:</span>
                  <span className="ml-2 font-medium">{registroCarga.data_saida}</span>
                </div>
                <div>
                  <span className="text-blue-600">Temperatura Saída:</span>
                  <span className="ml-2 font-medium">{registroCarga.temperatura_saida || "N/A"}°C</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {isReadOnly ? "Dados de Chegada (Visualização)" : "Dados de Chegada no Local"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_aplicacao" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data da Aplicação *
              </Label>
              <Input
                id="data_aplicacao"
                type="date"
                {...register("data_aplicacao")}
                required
                disabled={isReadOnly}
                className={isReadOnly ? "bg-muted" : ""}
              />
              {errors.data_aplicacao && (
                <span className="text-sm text-red-500">
                  {String(errors.data_aplicacao.message)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_chegada_local" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora de Chegada * (Manual)
              </Label>
              <Input
                id="hora_chegada_local"
                type="time"
                {...register("hora_chegada_local")}
                required
                disabled={isReadOnly}
                className={isReadOnly ? "bg-muted" : ""}
                placeholder="HH:MM"
              />
              <div className="text-xs text-gray-500">
                Informe a hora real de chegada do caminhão no local
              </div>
              {errors.hora_chegada_local && (
                <span className="text-sm text-red-500">
                  {String(errors.hora_chegada_local.message)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperatura_chegada" className="flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Temperatura de Chegada (°C)
              </Label>
              <Input
                id="temperatura_chegada"
                type="number"
                step="0.1"
                placeholder="Ex: 150.5"
                {...register("temperatura_chegada", {
                  valueAsNumber: true
                })}
                disabled={isReadOnly}
                className={isReadOnly ? "bg-muted" : ""}
              />
              {errors.temperatura_chegada && (
                <span className="text-sm text-red-500">
                  {String(errors.temperatura_chegada.message)}
                </span>
              )}
            </div>
          </div>

          {!isFormValid && !isReadOnly && (
            <Alert>
              <AlertDescription>
                Preencha todos os campos obrigatórios (*) antes de prosseguir.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={onNext} 
          disabled={!isFormValid || isReadOnly}
          className="bg-blue-500 hover:bg-blue-600"
        >
          {isReadOnly ? "Visualizar Aplicações" : "Próximo: Dados Técnicos"}
        </Button>
      </div>
    </div>
  );
};

export default NovoRegistroDadosIniciaisTab;
