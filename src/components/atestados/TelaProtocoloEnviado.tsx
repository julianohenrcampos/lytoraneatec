import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Printer,
} from "lucide-react";
import type { AtestadoAlerta } from "@/types/atestadoMedico";

interface Props {
  protocolo: string;
  alertas: AtestadoAlerta[];
  sistemaDescricao?: string | null;
  enviadoEm?: string; // ISO
  onNovo: () => void;
}

interface AlertaTexto {
  tone: "ok" | "warn" | "attention";
  titulo: string;
  mensagem: string;
}

function textoAlerta(codigo: string): AlertaTexto | null {
  switch (codigo) {
    case "prazo_ok":
      return {
        tone: "ok",
        titulo: "Atestado entregue dentro do prazo (até 24 horas)",
        mensagem:
          "Atestado recebido com sucesso. Seu atestado foi recebido dentro do prazo estabelecido pela empresa e foi encaminhado para análise da Medicina do Trabalho. Após a conclusão da análise, o resultado será disponibilizado conforme o fluxo interno da empresa. Caso seja necessária alguma informação complementar, você será comunicado.",
      };
    case "prazo_fora":
      return {
        tone: "warn",
        titulo: "Atestado entregue fora do prazo (após 24 horas)",
        mensagem:
          "Atestado recebido fora do prazo. Seu atestado foi recebido, porém foi enviado após o prazo de 24 horas contadas da data de sua emissão, conforme procedimento interno da empresa. O documento será registrado para ciência e encaminhado à Medicina do Trabalho. Em razão da entrega fora do prazo, o atestado seguirá o fluxo previsto na política da empresa para análise, podendo não ser considerado para fins de abono, conforme as normas internas aplicáveis. Em caso de dúvidas, entre em contato com a Administração da Obra ou com o setor de Medicina do Trabalho.",
      };
    case "afastamento_5_dias":
      return {
        tone: "attention",
        titulo: "Atestado com afastamento igual ou superior a 5 dias",
        mensagem:
          "Atenção. Seu atestado informa um afastamento de 5 dias ou mais. Entre em contato com a Administração da Obra e compareça à Medicina do Trabalho na sede da empresa para avaliação e orientações antes do retorno às suas atividades, conforme os procedimentos internos.",
      };
    case "recorrencia_mes":
    case "acompanhamento_60d":
      return {
        tone: "attention",
        titulo: "Atenção",
        mensagem:
          "Foi identificado que você atingiu o quantitativo de atestados previsto para acompanhamento no período de 60 dias. Entre em contato com a Administração da Obra com urgência e compareça à Medicina do Trabalho na sede da empresa para avaliação e orientações. O não comparecimento poderá comprometer o acompanhamento do seu caso e os procedimentos administrativos relacionados aos seus afastamentos.",
      };
    default:
      return null;
  }
}

function iconePorTone(tone: AlertaTexto["tone"]) {
  if (tone === "ok") return <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />;
  if (tone === "warn")
    return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />;
  return <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />;
}

function classePorTone(tone: AlertaTexto["tone"]) {
  if (tone === "ok") return "border-primary/40 bg-primary/5";
  return "border-amber-500/40 bg-amber-500/10";
}

function fmtBRT(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

export default function TelaProtocoloEnviado({
  protocolo,
  alertas,
  sistemaDescricao,
  enviadoEm,
  onNovo,
}: Props) {
  // Deduplica recorrencia_mes / acompanhamento_60d (mesma mensagem).
  const alertasRender = useMemo(() => {
    const vistos = new Set<string>();
    const out: AlertaTexto[] = [];
    for (const a of alertas ?? []) {
      const t = textoAlerta(a.codigo);
      if (!t) continue;
      const chave = t.titulo;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(t);
    }
    return out;
  }, [alertas]);

  const enviadoFmt = fmtBRT(enviadoEm || new Date().toISOString());

  function imprimir() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #comprovante-print, #comprovante-print * { visibility: visible !important; }
          #comprovante-print {
            position: absolute !important;
            left: 0; top: 0; width: 100%;
            padding: 24px !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div id="comprovante-print" className="space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Atestado registrado
                </h2>
                <p className="text-sm text-muted-foreground">
                  Comprovante de envio — LYTOTEC
                </p>
              </div>
            </div>

            <div className="p-4 rounded-md bg-muted/50 border border-border">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">
                Protocolo
              </p>
              <p className="text-lg font-mono font-semibold text-foreground break-all">
                {protocolo}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Guarde este número. Ele poderá ser solicitado pelo RH ou SSO.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Enviado em
                </div>
                <div className="text-foreground">{enviadoFmt}</div>
              </div>
              {sistemaDescricao && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sistema afetado
                  </div>
                  <div className="text-foreground">{sistemaDescricao}</div>
                </div>
              )}
            </div>

            {alertasRender.map((a, i) => (
              <div
                key={i}
                className={`p-4 rounded-md border flex gap-3 items-start ${classePorTone(
                  a.tone
                )}`}
              >
                {iconePorTone(a.tone)}
                <div className="text-sm">
                  <p className="font-medium text-foreground">{a.titulo}</p>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {a.mensagem}
                  </p>
                </div>
              </div>
            ))}

            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Entregue a <b>via original</b> ao RH em até 48 horas.</li>
              <li>• A validação médica final é presencial, feita pelo SSO.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 no-print">
            <Button onClick={imprimir} className="w-full sm:w-auto">
              <Printer className="w-4 h-4 mr-2" />
              Baixar comprovante
            </Button>
            <Button variant="outline" onClick={onNovo} className="w-full sm:w-auto">
              Enviar outro atestado
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
