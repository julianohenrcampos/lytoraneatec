import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Target } from "lucide-react";

const STORAGE_KEY = "lytotec.diarias.valorProjeto";

interface Props {
  valorExecutado: number;
  isLoading?: boolean;
}

export default function ImpactoProjetoCard({ valorExecutado, isLoading }: Props) {
  const [valorProjeto, setValorProjeto] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setValorProjeto(saved);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
    setValorProjeto(v);
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const valorNum = parseFloat(valorProjeto) || 0;
  const impacto = valorNum > 0 ? (valorExecutado / valorNum) * 100 : 0;

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
          placeholder="Valor do projeto (R$)"
          value={valorProjeto}
          onChange={handleChange}
          className="h-8 text-sm"
        />
        {valorNum > 0 ? (
          <div>
            <div className="text-2xl font-bold">{impacto.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBRL(valorExecutado)} de {formatBRL(valorNum)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Informe o valor do projeto</p>
        )}
      </CardContent>
    </Card>
  );
}
