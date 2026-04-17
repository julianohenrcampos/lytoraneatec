import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (precisaExame: boolean) => void | Promise<void>;
  isSubmitting?: boolean;
}

const ConfirmExameModal: React.FC<Props> = ({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}) => {
  const [precisa, setPrecisa] = useState<"nao" | "sim">("nao");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendamento de exame</DialogTitle>
          <DialogDescription>
            Essa função precisa de agendamento de exame de mudança de risco?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={precisa}
          onValueChange={(v) => setPrecisa(v as "nao" | "sim")}
          className="gap-3 py-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nao" id="exame-nao" />
            <Label htmlFor="exame-nao">NÃO — efetivar agora</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sim" id="exame-sim" />
            <Label htmlFor="exame-sim">SIM — agendar exame</Label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(precisa === "sim")}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar e Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmExameModal;
