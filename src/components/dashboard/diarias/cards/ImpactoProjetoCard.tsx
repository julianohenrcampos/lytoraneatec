import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Target } from "lucide-react";

const STORAGE_KEY = "lytotec.diarias.valorProjeto";

interface Props {
  valorExecutado: number;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatPct = (v: number) =>
  `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

export default function ImpactoProjetoCard({ valorExecutado }: Props) {
  const [valorMedicao, setValorMedicao] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setValorMedicao(saved);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
    setValorMedicao(v);
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const valorNum = parseFloat(valorMedicao) || 0;
  const isValid = valorNum > 0;
  const impacto = isValid ? (valorExecutado / valorNum) * 100 : 0;
  const saldo = isValid ? valorNum - valorExecutado : 0;
  const saldoNegativo = saldo < 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Impacto das Diárias no Projeto
        </CardTitle>
        <Target className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Valor da medição (R$)"
          value={valorMedicao}
          onChange={handleChange}
          className="h-8 text-sm"
          aria-label="Valor da medição do período"
        />
        {!valorMedicao ? (
          <p className="text-xs text-muted-foreground">
            Informe o valor da medição para calcular o impacto.
          </p>
        ) : !isValid ? (
          <p className="text-xs text-muted-foreground">Informe um valor válido.</p>
        ) : (
          <div className="space-y-0.5">
            <div className="text-2xl font-bold">{formatPct(impacto)}</div>
            <p className="text-xs text-muted-foreground">
              Executado {formatBRL(valorExecutado)} de {formatBRL(valorNum)}
            </p>
            <p
              className={`text-xs ${
                saldoNegativo ? "text-destructive font-medium" : "text-muted-foreground"
              }`}
            >
              Saldo após diárias: {saldoNegativo ? "-" : ""}
              {formatBRL(Math.abs(saldo))}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
