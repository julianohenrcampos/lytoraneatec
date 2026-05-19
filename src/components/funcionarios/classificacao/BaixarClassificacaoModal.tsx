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
import { CurrencyInput } from "@/components/ui/currency-input";
import { useNavigate } from "react-router-dom";
import { gerarPdfSolicitacaoClassificacao } from "@/utils/pdf/gerarPdfSolicitacaoClassificacao";
import { getNomeSolicitanteClassificacao } from "@/services/rh/getNomeSolicitanteClassificacao";

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
  const [salarioAtual, setSalarioAtual] = useState<number>(0);
  const [novoSalarioInput, setNovoSalarioInput] = useState<number>(0);

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
      setSalarioAtual(Number((funcionario as any).salario_base ?? 0));
      setNovoSalarioInput(0);
      // Rehidrata salário atual a partir de bd_funcionarios (caso a listagem venha reduzida)
      (async () => {
        try {
          const { data: alvo } = await supabase
            .from("bd_funcionarios")
            .select("salario_base")
            .eq("id", funcionario.id)
            .maybeSingle();
          if (alvo && (alvo as any).salario_base != null) {
            setSalarioAtual(Number((alvo as any).salario_base));
          }
        } catch {
          /* ignore */
        }
      })();
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

  // Preenche automaticamente o Novo Salário ao escolher cargo; permanece editável.
  useEffect(() => {
    if (cargoSelecionado) {
      setNovoSalarioInput(Number((cargoSelecionado as any).salario_base ?? 0));
    }
  }, [cargoSelecionado]);

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
    if (!novoSalarioInput || novoSalarioInput <= 0) {
      toast.error("Informe o Novo Salário");
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

      // Solicitante (usuário logado) — fonte canônica: profiles.funcionario_id → bd_funcionarios
      let solicitanteNome = "-";
      let solicitanteEmail: string | null = null;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          const info = await getNomeSolicitanteClassificacao(uid, { usarMetadataDoAuth: true });
          solicitanteNome = info.nome;
          solicitanteEmail = info.email;
        }
      } catch {
        /* ignore */
      }

      // Rehidratação do alvo (garante nome/CC/admissão/cargo mesmo se a listagem veio reduzida).
      // Salário Atual e Novo Salário usam exatamente os valores exibidos no modal
      // (state `salarioAtual` + memo `novoSalario`), garantindo identidade tela⇄PDF.
      let alvoNome = funcionario.nome_completo;
      let alvoMatricula: string | null = (funcionario as any).matricula ?? null;
      let alvoDataAdmissao: string | null = funcionario.data_admissao ?? null;
      let alvoCC = funcionario.bd_centros_custo?.nome_centro_custo ?? null;
      let alvoCargoAtual = cargoAtualNome;
      try {
        const { data: alvo } = await supabase
          .from("bd_funcionarios")
          .select(
            "nome_completo, matricula, data_admissao, bd_centros_custo(nome_centro_custo), bd_funcoes(nome_funcao)"
          )
          .eq("id", funcionario.id)
          .maybeSingle();
        if (alvo) {
          alvoNome = (alvo as any).nome_completo || alvoNome;
          alvoMatricula = (alvo as any).matricula ?? alvoMatricula;
          alvoDataAdmissao = (alvo as any).data_admissao ?? alvoDataAdmissao;
          alvoCC = (alvo as any).bd_centros_custo?.nome_centro_custo ?? alvoCC;
          alvoCargoAtual =
            (alvo as any).bd_funcoes?.nome_funcao || alvoCargoAtual;
        }
      } catch (e) {
        console.warn("[NOVA_CLASSIFICACAO][PDF_DADOS_INCOMPLETOS]", {
          funcionario_id: funcionario.id,
          erro: (e as any)?.message,
        });
      }

      const faltando = {
        nome: !alvoNome,
        centro_custo: !alvoCC,
        data_admissao: !alvoDataAdmissao,
      };
      if (faltando.nome || faltando.centro_custo || faltando.data_admissao) {
        console.warn("[NOVA_CLASSIFICACAO][PDF_DADOS_INCOMPLETOS]", {
          funcionario_id: funcionario.id,
          faltando,
        });
      }

      // Última classificação efetivada (RPC SECURITY DEFINER read-only).
      // Retorna apenas a date de RECLASSIFICACAO/PROMOCAO_EFETIVADA mais recente.
      let ultimaClassificacao: string | null = null;
      try {
        const { data: ultData, error: ultErr } = await supabase
          .rpc("fn_ultima_classificacao_data" as any, {
            p_funcionario_id: funcionario.id,
          });
        if (ultErr) throw ultErr;
        ultimaClassificacao = (ultData as any) ?? null;
        console.log("[CLASSIFICACAO][ULTIMA_DEBUG]", {
          funcionario_id: funcionario.id,
          ultimaClassificacao,
        });
      } catch (e) {
        console.warn("[CLASSIFICACAO][ULTIMA_ERRO]", e);
      }

      // PDF de protocolo no layout antigo (com salário, Total Geral, assinaturas).
      // salario_atual / novo_salario refletem exatamente os campos exibidos no modal.
      try {
        gerarPdfSolicitacaoClassificacao({
          protocolo_id: result.id,
          nome: alvoNome || "-",
          matricula: alvoMatricula,
          centro_custo: alvoCC || "-",
          data_admissao: alvoDataAdmissao,
          ultima_classificacao: ultimaClassificacao,
          cargo_atual: alvoCargoAtual || "-",
          salario_atual: salarioAtual,
          novo_cargo: cargoSelecionado.nome_funcao,
          novo_salario: novoSalarioInput,
          motivo,
          data_efetivacao_desejada: dataEfetivacao || null,
          precisa_exame: precisaExame,
          solicitante: solicitanteNome,
          solicitante_email: solicitanteEmail,
          data_solicitacao: new Date().toISOString(),
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
            <div>
              <Label>Novo Salário *</Label>
              <CurrencyInput
                value={novoSalarioInput}
                onChange={setNovoSalarioInput}
                placeholder="0,00"
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
