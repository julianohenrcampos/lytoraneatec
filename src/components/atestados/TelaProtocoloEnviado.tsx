import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  protocolo: string;
  dentroPrazo24h: boolean;
  onNovo: () => void;
}

export default function TelaProtocoloEnviado({
  protocolo,
  dentroPrazo24h,
  onNovo,
}: Props) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Atestado registrado
            </h2>
            <p className="text-sm text-muted-foreground">
              Seu envio foi recebido pelo sistema.
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

        {!dentroPrazo24h && (
          <div className="p-4 rounded-md border border-amber-500/40 bg-amber-500/10 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Envio fora do prazo de 24 horas
              </p>
              <p className="text-muted-foreground">
                O registro foi feito, mas o SSO poderá solicitar justificativa.
              </p>
            </div>
          </div>
        )}

        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• Entregue a <b>via original</b> ao RH em até 48 horas.</li>
          <li>• A validação médica final é presencial, feita pelo SSO.</li>
        </ul>

        <Button variant="outline" onClick={onNovo} className="w-full sm:w-auto">
          Enviar outro atestado
        </Button>
      </CardContent>
    </Card>
  );
}
