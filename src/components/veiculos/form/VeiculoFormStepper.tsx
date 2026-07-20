import React, { useState } from "react";
import { Form } from "@/components/ui/form";
import { UseFormReturn, type FieldErrors } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, Puzzle, CreditCard, Settings, BarChart3, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Step1Classificacao from "./steps/Step1Classificacao";
import Step2Identificacao from "./steps/Step2Identificacao";
import Step3DadosTecnicos from "./steps/Step3DadosTecnicos";
import Step4Operacao from "./steps/Step4Operacao";

interface VeiculoFormStepperProps {
  form: UseFormReturn<any>;
  onSubmit: (values: any) => Promise<void>;
  onInvalid?: (errors: FieldErrors) => void;
  isSubmitting: boolean;
  onClose: () => void;
  currentImage?: string | null;
  onImageChange: (file: File) => void;
  onImageRemove?: () => void;
  departamentos: { id: string; nome_departamento: string }[];
  empresas: { id: string; nome_empresa: string }[];
  categorias: { id: string; nome_categoria: string }[];
  mode: 'create' | 'edit';
  centrosCustoAtivos?: { id: string; nome_centro_custo: string; codigo_centro_custo: string }[];
  centroCustoAtual?: {
    nome: string | null;
    codigo: string | null;
    origem:
      | 'CADASTRO'
      | 'APONTAMENTO_CE'
      | 'DISPONIBILIDADE'
      | 'CENTRAL_TRANSPORTE'
      | 'SEM_ALOCACAO'
      | null;
    atualizadoEm: string | null;
  } | null;
}

const steps = [
  { label: "Classificação", icon: Puzzle },
  { label: "Identificação", icon: CreditCard },
  { label: "Dados Técnicos", icon: Settings },
  { label: "Operação", icon: BarChart3 },
];

// Mapa: campo do formulário → índice da etapa.
const FIELD_TO_STEP: Record<string, number> = {
  categoria_ativo_id: 0,
  subcategoria_ativo_id: 0,
  linha_operacional_id: 0,
  frota_id: 1,
  numero_frota: 1,
  proprietario_key: 1,
  placa: 1,
  chassi: 1,
  numero_serie: 1,
  empresa_id: 1,
  empresa_locadora_id: 1,
  fabricante_id: 2,
  modelo_id: 2,
  ano_fabricacao: 2,
  cor: 2,
  motor: 2,
  tipo_combustivel: 2,
  situacao: 3,
  status_ipva: 3,
  departamento_id: 3,
  capacidade: 3,
  capacidade_valor: 3,
  capacidade_unidade: 3,
  aluguel: 3,
  observacoes: 3,
};

const VeiculoFormStepper: React.FC<VeiculoFormStepperProps> = ({
  form, onSubmit, onInvalid, isSubmitting, onClose, currentImage, onImageChange, onImageRemove,
  departamentos, empresas, categorias, mode, centrosCustoAtivos, centroCustoAtual,
}) => {
  const [step, setStep] = useState(0);
  const [stepsComErro, setStepsComErro] = useState<Set<number>>(new Set());

  const handleInvalid = (errors: FieldErrors) => {
    const stepsErr = new Set<number>();
    let firstStep = step;
    let found = false;
    for (const key of Object.keys(errors)) {
      const s = FIELD_TO_STEP[key];
      if (typeof s === "number") {
        stepsErr.add(s);
        if (!found) { firstStep = s; found = true; }
      }
    }
    setStepsComErro(stepsErr);
    if (found) setStep(firstStep);
    onInvalid?.(errors);
  };

  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)} className="space-y-6">
        <div className="flex items-center justify-between px-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            const hasError = stepsComErro.has(i);
            return (
              <React.Fragment key={i}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-colors",
                    hasError ? "text-destructive" :
                    isActive ? "text-primary" : isDone ? "text-primary/60" : "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors",
                    hasError ? "border-destructive bg-destructive/10 text-destructive" :
                    isActive ? "border-primary bg-primary text-primary-foreground" :
                    isDone ? "border-primary/60 bg-primary/10 text-primary" :
                    "border-muted-foreground/30 bg-muted"
                  )}>
                    {hasError ? <AlertCircle className="h-4 w-4" /> : isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-[10px] font-medium whitespace-nowrap">{s.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={cn("flex-1 h-0.5 mx-1 rounded", i < step ? "bg-primary/60" : "bg-muted")} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="min-h-[300px]">
          {step === 0 && <Step1Classificacao form={form} categorias={categorias} currentImage={currentImage} onImageChange={onImageChange} onImageRemove={onImageRemove} />}
          {step === 1 && <Step2Identificacao form={form} />}
          {step === 2 && <Step3DadosTecnicos form={form} />}
          {step === 3 && <Step4Operacao form={form} departamentos={departamentos} empresas={empresas} mode={mode} centrosCustoAtivos={centrosCustoAtivos} centroCustoAtual={centroCustoAtual} />}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={handleBack} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={handleNext} className="gap-2">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
};

export default VeiculoFormStepper;
