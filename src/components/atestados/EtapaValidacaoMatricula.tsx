import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useValidarMatricula } from "@/hooks/atestados/useValidarMatricula";
import type { AtestadoValidarResponse } from "@/types/atestadoMedico";
import { toast } from "sonner";

interface Props {
  onValidado: (resp: AtestadoValidarResponse) => void;
  onVoltar: () => void;
}

function formatarEspera(segundos: number) {
  if (segundos >= 60) {
    const min = Math.ceil(segundos / 60);
    return `${min} minuto${min > 1 ? "s" : ""}`;
  }
  return `${segundos} segundos`;
}

export default function EtapaValidacaoMatricula({ onValidado, onVoltar }: Props) {
  const [matricula, setMatricula] = useState("");
  const [cpf4, setCpf4] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const validar = useValidarMatricula();

  useEffect(() => {
    if (espera <= 0) return;
    const t = setInterval(() => setEspera((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [espera]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (espera > 0) return;
    setErro(null);
    const m = matricula.trim();
    const c = cpf4.trim();
    if (!m || !/^[A-Za-z0-9._-]{1,32}$/.test(m)) {
      setErro("Verifique os dados informados.");
      return;
    }
    if (!/^\d{4}$/.test(c)) {
      setErro("Verifique os dados informados.");
      return;
    }
    try {
      const resp = await validar.mutateAsync({ matricula: m, cpf_ultimos_4: c });
      onValidado(resp);
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "rate_limited") {
        const segundos = Number(e?.retry_after_segundos) || 600;
        setEspera(segundos);
        const msg = `Muitas tentativas. Tente novamente em ${formatarEspera(segundos)}.`;
        setErro(msg);
        toast.error(msg);
      } else if (code === "timeout" || code === "network_error") {
        setErro("A conexão demorou demais. Verifique sua internet e tente novamente.");
      } else if (code === "identidade_ambigua") {
        setErro(
          "Encontramos mais de um cadastro com esta matrícula. Procure o RH para regularizar.",
        );
      } else {
        setErro("Não foi possível validar. Verifique os dados.");
      }

    }
  }


  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-foreground">
            Confirme sua identidade
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Informe sua matrícula e os 4 últimos dígitos do seu CPF.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="matricula">Matrícula</Label>
            <Input
              id="matricula"
              inputMode="text"
              autoComplete="off"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              maxLength={32}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf4">4 últimos dígitos do CPF</Label>
            <Input
              id="cpf4"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={cpf4}
              onChange={(e) =>
                setCpf4(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              maxLength={4}
              required
            />
          </div>

          {erro && (
            <div className="text-sm text-destructive" role="alert">
              {erro}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="submit"
              disabled={validar.isPending || espera > 0}
              className="sm:flex-1"
            >
              {validar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {espera > 0 ? `Aguarde ${formatarEspera(espera)}` : "Validar"}
            </Button>
            <Button type="button" variant="outline" onClick={onVoltar}>
              Voltar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
