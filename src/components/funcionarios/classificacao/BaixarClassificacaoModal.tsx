// NOTA: Nome de arquivo/componente mantido (BaixarClassificacaoModal) para
// evitar diff grande. Visualmente, este modal agora é "Nova Classificação"
// (Fase 2A). Ele apenas cria solicitação em
// bd_funcionario_classificacao_solicitacoes e NÃO toca em
// bd_historico_funcional nem em bd_funcionarios.
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
import { Funcionario } from "@/types/funcionario";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmExameModal from "./ConfirmExameModal";
import { toast } from "sonner";
import { criarSolicitacaoClassificacao } from "@/services/rh/classificacaoSolicitacaoService";
import { Combobox } from "@/components/ui/combobox";
import { useNavigate } from "react-router-dom";
import { gerarPdfSolicitacaoClassificacao } from "@/utils/pdf/gerarPdfSolicitacaoClassificacao";

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

const BaixarClassificacaoModal: React.FC<Props> = ({
  open,
  onOpenChange,
  funcionario,
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [novoCargoId, setNovoCargoId] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("Promoção");
  const [dataEfetivacao, setDataEfetivacao] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: funcoes = [] } = useQuery({
    queryKey: ["bd_funcoes_classificacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_funcoes")
        .select("id, nome_funcao")
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
    }
  }, [open, funcionario]);

  const cargoSelecionado = useMemo(
    () => funcoes.find((f: any) => f.id === novoCargoId),
    [funcoes, novoCargoId]
  );

  const cargoOptions = useMemo(
    () => funcoes.map((f: any) => ({ value: f.id, label: f.nome_funcao })),
    [funcoes]
  );

  const cargoAtualNome = funcionario?.bd_funcoes?.nome_funcao || "-";

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
    if (!funcionario.centro_custo_id) {
      toast.error("Funcionário sem centro de custo vinculado.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await criarSolicitacaoClassificacao({
        funcionario_id: funcionario.id,
        centro_custo_id: funcionario.centro_custo_id,
        cargo_atual_id: (funcionario as any).funcao_id ?? null,
        cargo_atual_nome: funcionario.bd_funcoes?.nome_funcao ?? null,
        cargo_novo_id: cargoSelecionado.id,
        cargo_novo_nome: cargoSelecionado.nome_funcao,
        motivo,
        observacao: null,
        data_efetivacao_desejada: dataEfetivacao || null,
        precisa_exame: precisaExame,
      });

      if (!result.ok) {
        toast.error((result as { ok: false; message: string }).message);
        return;
      }

      // Solicitante (usuário logado)
      let solicitanteNome = "-";
      try {
        const { data: userData } = await supabase.auth.getUser();
        const u = userData?.user;
        solicitanteNome =
          (u?.user_metadata as any)?.nome ||
          (u?.user_metadata as any)?.full_name ||
          u?.email ||
          "-";
      } catch {
        /* ignore */
      }

      // PDF de protocolo (sem salário)
      try {
        gerarPdfSolicitacaoClassificacao({
          protocolo_id: result.id,
          nome: funcionario.nome_completo,
          matricula: (funcionario as any).matricula ?? null,
          centro_custo: funcionario.bd_centros_custo?.nome_centro_custo || "-",
          data_admissao: funcionario.data_admissao
            ? new Date(funcionario.data_admissao).toLocaleDateString("pt-BR")
            : "-",
          cargo_atual: cargoAtualNome,
          novo_cargo: cargoSelecionado.nome_funcao,
          motivo,
          data_efetivacao_desejada: dataEfetivacao
            ? new Date(dataEfetivacao).toLocaleDateString("pt-BR")
            : "-",
          precisa_exame: precisaExame,
          solicitante: solicitanteNome,
          data_solicitacao: new Date().toLocaleString("pt-BR"),
        });
      } catch (e) {
        console.error("Erro ao gerar PDF de solicitação:", e);
      }

      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      setConfirmOpen(false);
      onOpenChange(false);

      if (precisaExame) {
        toast.success("Solicitação registrada. Redirecionando para agendamento de exame...");
        const f: any = funcionario;
        navigate("/sso/agendamento-exames", {
          state: {
            origem: "classificacao",
            tipo_exame: "Mudança de Risco",
            funcionario_id: funcionario.id,
            funcao_nova_id: cargoSelecionado.id,
            motivo_mudanca_risco: motivo,
            classificacao_solicitacao_id: result.id,
            funcionario_payload: {
              id: funcionario.id,
              nome: funcionario.nome_completo,
              nome_completo: funcionario.nome_completo,
              cpf: f.cpf || "",
              rg: f.rg || "",
              data_nascimento: funcionario.data_nascimento || "",
              telefone: f.telefone || "",
              email: f.email || "",
              funcao: cargoAtualNome,
              empresa: f.bd_empresas?.nome_empresa || "",
              contrato: funcionario.bd_centros_custo?.nome_centro_custo || "",
              endereco_rua: f.endereco_rua || "",
              endereco_numero: f.endereco_numero || "",
              endereco_bairro: f.endereco_bairro || "",
              endereco_cidade: f.endereco_cidade || "",
              endereco_estado: f.endereco_estado || "",
              endereco_cep: f.endereco_cep || "",
            },
          },
        });
      } else {
        toast.success("Solicitação registrada. PDF gerado.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!funcionario) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova Classificação</DialogTitle>
            <DialogDescription>
              Solicitar promoção ou reclassificação do colaborador.
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
              <Label className="text-muted-foreground">Cargo Atual</Label>
              <p className="font-medium">{cargoAtualNome}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <Label>Novo Cargo *</Label>
              <Combobox
                options={cargoOptions}
                value={novoCargoId}
                onChange={setNovoCargoId}
                placeholder="Selecione o novo cargo"
                searchPlaceholder="Buscar cargo..."
                emptyText="Nenhum cargo encontrado."
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
              <Label>Data de Efetivação Desejada</Label>
              <Input
                type="date"
                value={dataEfetivacao}
                onChange={(e) => setDataEfetivacao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleContinuar} disabled={isSubmitting || !novoCargoId}>
              Salvar Solicitação
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
