import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Funcionario } from "@/types/funcionario";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ConfirmExameModal from "./ConfirmExameModal";
import { useBaixarClassificacao } from "@/hooks/useBaixarClassificacao";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: Funcionario | null;
}

const MOTIVOS = [
  "Promoção",
  "Mudança de Setor",
  "Reclassificação",
  "Ajuste Salarial",
];

const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const BaixarClassificacaoModal: React.FC<Props> = ({
  open,
  onOpenChange,
  funcionario,
}) => {
  const { salvar, isSubmitting, fetchUltimaClassificacao } =
    useBaixarClassificacao();
  const [novoCargoId, setNovoCargoId] = useState<string>("");
  const [openCargo, setOpenCargo] = useState(false);
  const [motivo, setMotivo] = useState<string>("Promoção");
  const [dataEfetivacao, setDataEfetivacao] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ultimaClassificacao, setUltimaClassificacao] = useState<string>("-");

  const { data: funcoes = [] } = useQuery({
    queryKey: ["bd_funcoes_classificacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_funcoes")
        .select("id, nome_funcao, salario_base")
        .order("nome_funcao");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (open && funcionario) {
      setNovoCargoId("");
      setMotivo("Promoção");
      setDataEfetivacao(new Date().toISOString().slice(0, 10));
      fetchUltimaClassificacao(funcionario.id).then((u) =>
        setUltimaClassificacao(u || "-")
      );
    }
  }, [open, funcionario, fetchUltimaClassificacao]);

  const cargoSelecionado = useMemo(
    () => funcoes.find((f: any) => f.id === novoCargoId),
    [funcoes, novoCargoId]
  );

  const salarioAtual = Number(funcionario?.salario_base ?? 0);
  const novoSalario = Number(cargoSelecionado?.salario_base ?? 0);
  const diferencaValor = novoSalario - salarioAtual;
  const diferencaPct =
    salarioAtual > 0
      ? ((novoSalario - salarioAtual) / salarioAtual) * 100
      : 0;

  const handleContinuar = () => {
    if (!cargoSelecionado) {
      toast.error("Selecione o novo cargo");
      return;
    }
    if (!motivo) {
      toast.error("Selecione o motivo");
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async (precisaExame: boolean) => {
    if (!funcionario || !cargoSelecionado) return;
    const res = await salvar(
      {
        funcionario,
        novo_cargo_id: cargoSelecionado.id,
        novo_cargo_nome: cargoSelecionado.nome_funcao,
        novo_salario: Number(cargoSelecionado.salario_base ?? 0),
        motivo,
        data_efetivacao: dataEfetivacao,
      },
      precisaExame
    );
    if (res.ok) {
      setConfirmOpen(false);
      onOpenChange(false);
    }
  };

  if (!funcionario) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Baixar Classificação</DialogTitle>
            <DialogDescription>
              Registrar promoção / reclassificação do colaborador.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-muted-foreground">Nome</Label>
              <p className="font-medium">{funcionario.nome_completo}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Centro de Custo</Label>
              <p className="font-medium">
                {funcionario.bd_centros_custo?.nome_centro_custo || "-"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Data de Admissão</Label>
              <p className="font-medium">
                {funcionario.data_admissao
                  ? new Date(funcionario.data_admissao).toLocaleDateString(
                      "pt-BR"
                    )
                  : "-"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">
                Última Classificação
              </Label>
              <p className="font-medium">{ultimaClassificacao}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Cargo Atual</Label>
              <p className="font-medium">
                {funcionario.bd_funcoes?.nome_funcao || "-"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Salário Atual</Label>
              <p className="font-medium">{fmtBRL(salarioAtual)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <Label>Novo Cargo *</Label>
              <Popover open={openCargo} onOpenChange={setOpenCargo}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCargo}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {cargoSelecionado?.nome_funcao ?? "Selecione o novo cargo"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[60] p-0 w-[--radix-popover-trigger-width] pointer-events-auto"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar cargo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cargo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {funcoes.map((f: any) => (
                          <CommandItem
                            key={f.id}
                            value={f.id}
                            onSelect={(val) => {
                              setNovoCargoId(val);
                              setOpenCargo(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                novoCargoId === f.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {f.nome_funcao}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Novo Salário</Label>
              <Input
                value={fmtBRL(novoSalario)}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label>Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Efetivação</Label>
              <Input
                type="date"
                value={dataEfetivacao}
                onChange={(e) => setDataEfetivacao(e.target.value)}
              />
            </div>
          </div>

          {cargoSelecionado && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>Diferença:</span>
                <span
                  className={
                    diferencaValor >= 0 ? "text-primary font-semibold" : "text-destructive font-semibold"
                  }
                >
                  {fmtBRL(diferencaValor)} ({diferencaPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleContinuar} disabled={isSubmitting || !novoCargoId}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmExameModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
      />
    </>
  );
};

export default BaixarClassificacaoModal;
