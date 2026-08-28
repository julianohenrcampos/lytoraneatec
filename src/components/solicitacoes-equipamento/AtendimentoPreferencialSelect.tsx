import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDepartamentosFornecedoresEquipamento } from "@/services/atendimentoPreferencialService";

/** Valor sentinela: escolha explícita por "Avaliar disponibilidade" (persiste NULL). */
export const ATENDIMENTO_AVALIAR = "AVALIAR";

/** Converte o valor do formulário no UUID persistido (NULL = avaliar disponibilidade). */
export function resolveDepartamentoPreferencialId(valor: string): string | null {
  if (!valor || valor === ATENDIMENTO_AVALIAR) return null;
  return valor;
}

interface Props {
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}

/**
 * Seletor único e compartilhado de Atendimento Preferencial.
 * Obrigatório na UX (o usuário precisa escolher), mas "Avaliar disponibilidade"
 * é uma escolha válida que persiste NULL no banco.
 */
const AtendimentoPreferencialSelect: React.FC<Props> = ({ value, onChange, disabled }) => {
  const { data: departamentos = [], isLoading } = useQuery({
    queryKey: ["departamentos-fornecedores-equipamento"],
    queryFn: getDepartamentosFornecedoresEquipamento,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Carregando departamentos…" : "Selecione o atendimento preferencial"} />
        </SelectTrigger>
        <SelectContent>
          {departamentos.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.nome}
            </SelectItem>
          ))}
          <SelectItem value={ATENDIMENTO_AVALIAR}>Avaliar disponibilidade</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Se a origem do atendimento já foi definida operacionalmente, selecione o departamento. Caso
        contrário, permita que o planejamento avalie a melhor disponibilidade.
      </p>
    </div>
  );
};

export default AtendimentoPreferencialSelect;
