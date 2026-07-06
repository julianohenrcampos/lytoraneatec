import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEnviarAtestado } from "@/hooks/atestados/useEnviarAtestado";
import type { AtestadoSubmeterResponse } from "@/types/atestadoMedico";

interface Props {
  tokenValidacao: string;
  funcionarioNome: string;
  funcionarioMatricula: string;
  onEnviado: (resp: AtestadoSubmeterResponse) => void;
  onTokenInvalido: () => void;
}

const MAX_BYTES = 10 * 1024 * 1024;
const EXTS = ["pdf", "jpg", "jpeg", "png"];
const MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const hoje = () => new Date().toISOString().slice(0, 10);

const schema = z
  .object({
    data_emissao: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .refine((v) => v <= hoje(), "Data de emissão não pode ser futura"),
    data_inicio_afastamento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    dias_afastamento: z
      .number({ invalid_type_error: "Informe os dias" })
      .int("Somente números inteiros")
      .min(1, "Mínimo 1 dia")
      .max(365, "Máximo 365 dias"),
    declaracao_veracidade: z.literal(true, {
      errorMap: () => ({ message: "Obrigatório" }),
    }),
    declaracao_original_48h: z.literal(true, {
      errorMap: () => ({ message: "Obrigatório" }),
    }),
    declaracao_ciencia_nao_validacao: z.literal(true, {
      errorMap: () => ({ message: "Obrigatório" }),
    }),
  })
  .refine((v) => v.data_inicio_afastamento >= v.data_emissao, {
    path: ["data_inicio_afastamento"],
    message: "Deve ser igual ou posterior à data de emissão",
  });

export default function EtapaFormularioAtestado({
  tokenValidacao,
  funcionarioNome,
  funcionarioMatricula,
  onEnviado,
  onTokenInvalido,
}: Props) {
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dias, setDias] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [decV, setDecV] = useState(false);
  const [decO, setDecO] = useState(false);
  const [decC, setDecC] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const enviar = useEnviarAtestado();

  function validarArquivo(f: File | null): string | null {
    if (!f) return "Selecione o arquivo do atestado";
    if (f.size > MAX_BYTES) return "Arquivo maior que 10 MB";
    const ponto = f.name.lastIndexOf(".");
    const ext = ponto >= 0 ? f.name.slice(ponto + 1).toLowerCase() : "";
    if (!EXTS.includes(ext)) return "Somente PDF, JPG ou PNG";
    if (f.type && !MIMES.has(f.type)) return "Tipo de arquivo não suportado";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      data_emissao: dataEmissao,
      data_inicio_afastamento: dataInicio,
      dias_afastamento: Number(dias),
      declaracao_veracidade: decV,
      declaracao_original_48h: decO,
      declaracao_ciencia_nao_validacao: decC,
    });
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
    }
    const arquivoErr = validarArquivo(file);
    if (arquivoErr) errs.arquivo = arquivoErr;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      const resp = await enviar.mutateAsync({
        token_validacao: tokenValidacao,
        file: file!,
        data_emissao: dataEmissao,
        data_inicio_afastamento: dataInicio,
        dias_afastamento: Number(dias),
      });
      onEnviado(resp);
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "token_invalido" || code === "token_ja_utilizado") {
        toast.error("Sua sessão expirou. Refaça a validação.");
        onTokenInvalido();
      } else if (code === "invalid_input" || code === "declaracoes_obrigatorias") {
        toast.error("Verifique os campos e tente novamente.");
      } else if (code === "arquivo_extensao_invalida") {
        setErrors((prev) => ({ ...prev, arquivo: "Extensão não permitida" }));
      } else if (code === "upload_failed") {
        toast.error("Falha ao enviar o arquivo. Tente novamente.");
      } else {
        toast.error("Não foi possível enviar. Tente novamente.");
      }
    }
  }

  const mask = (s: string) =>
    s.length <= 3 ? s : `${s.slice(0, 2)}${"*".repeat(Math.max(0, s.length - 3))}${s.slice(-1)}`;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 p-3 rounded-md bg-muted/50 text-sm">
          <div className="font-medium text-foreground">{funcionarioNome}</div>
          <div className="text-muted-foreground">Matrícula: {mask(funcionarioMatricula)}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_emissao">Data de emissão</Label>
              <Input
                id="data_emissao"
                type="date"
                max={hoje()}
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                required
              />
              {errors.data_emissao && (
                <p className="text-xs text-destructive">{errors.data_emissao}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Início do afastamento</Label>
              <Input
                id="data_inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
              />
              {errors.data_inicio_afastamento && (
                <p className="text-xs text-destructive">
                  {errors.data_inicio_afastamento}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias">Dias de afastamento</Label>
            <Input
              id="dias"
              type="number"
              min={1}
              max={365}
              step={1}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              required
            />
            {errors.dias_afastamento && (
              <p className="text-xs text-destructive">{errors.dias_afastamento}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="arquivo">Arquivo do atestado (PDF, JPG ou PNG, até 10 MB)</Label>
            <Input
              id="arquivo"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            {errors.arquivo && (
              <p className="text-xs text-destructive">{errors.arquivo}</p>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium text-foreground pt-3">
              Declarações obrigatórias
            </p>
            <label className="flex gap-2 items-start text-sm cursor-pointer">
              <Checkbox
                checked={decV}
                onCheckedChange={(v) => setDecV(v === true)}
                aria-invalid={!!errors.declaracao_veracidade}
              />
              <span>
                Declaro que as informações e o arquivo são <b>verdadeiros</b> e
                pertencem a este atestado.
              </span>
            </label>
            <label className="flex gap-2 items-start text-sm cursor-pointer">
              <Checkbox
                checked={decO}
                onCheckedChange={(v) => setDecO(v === true)}
                aria-invalid={!!errors.declaracao_original_48h}
              />
              <span>
                Declaro que entregarei a <b>via original</b> ao RH em até{" "}
                <b>48 horas</b>.
              </span>
            </label>
            <label className="flex gap-2 items-start text-sm cursor-pointer">
              <Checkbox
                checked={decC}
                onCheckedChange={(v) => setDecC(v === true)}
                aria-invalid={!!errors.declaracao_ciencia_nao_validacao}
              />
              <span>
                Estou ciente de que este envio é apenas registro e{" "}
                <b>não substitui</b> a validação médica presencial pelo SSO.
              </span>
            </label>
            {(errors.declaracao_veracidade ||
              errors.declaracao_original_48h ||
              errors.declaracao_ciencia_nao_validacao) && (
              <p className="text-xs text-destructive">
                Todas as declarações são obrigatórias.
              </p>
            )}
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" disabled={enviar.isPending}>
              {enviar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar atestado
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
