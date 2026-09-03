import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, FileCheck, ShieldCheck } from "lucide-react";

interface Props {
  onIniciar: () => void;
}

export default function EtapaOrientacoes({ onIniciar }: Props) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Antes de enviar
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Leia com atenção as orientações abaixo. Este é o canal oficial para
            registro de atestados médicos.
          </p>
        </div>

        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <Clock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Envie o atestado em até <b>24 horas</b> após a emissão. Envios
              fora deste prazo são aceitos, mas ficam sinalizados.
            </span>
          </li>
          <li className="flex gap-3">
            <FileCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Arquivo em <b>PDF, JPG ou PNG</b>, legível, contendo as
              informações necessárias do atestado e assinatura/carimbo do
              profissional, quando aplicável.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              A via <b>original em papel</b> deve ser entregue ao RH em até 48
              horas. Este envio digital <b>não substitui</b> a entrega física.
            </span>
          </li>
          <li className="flex gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              O envio digital é apenas registro. A <b>validação médica</b>{" "}
              ocorre presencialmente pelo setor de SSO.
            </span>
          </li>
        </ul>

        <div className="pt-2">
          <Button onClick={onIniciar} className="w-full sm:w-auto">
            Iniciar validação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
