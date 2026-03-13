import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Funcionario } from "@/types/funcionario";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCPF } from "@/utils/textTransform";

interface FuncionarioDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  funcionario: Funcionario | null;
}

const FuncionarioDetailsModal: React.FC<FuncionarioDetailsModalProps> = ({
  isOpen,
  onClose,
  funcionario,
}) => {
  if (!funcionario) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Funcionário</DialogTitle>
          <DialogDescription>
            Informações completas do funcionário
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center mb-4">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarImage src={funcionario.imagem} alt={funcionario.nome_completo} />
            <AvatarFallback className="text-xl">
              {funcionario.nome_completo
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">{funcionario.nome_completo}</h2>
          <p className="text-muted-foreground">{funcionario.bd_funcoes?.nome_funcao || "-"}</p>
        </div>

        <Tabs defaultValue="pessoal" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
            <TabsTrigger value="profissional">Profissional</TabsTrigger>
            <TabsTrigger value="contratual">Contratual</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoal" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow label="Nome Completo" value={funcionario.nome_completo} />
              <DetailRow label="CPF" value={formatCPF(funcionario.cpf || "")} />
              <DetailRow label="Matrícula" value={funcionario.matricula} />
              <DetailRow label="E-mail" value={funcionario.email} />
              <DetailRow label="Data de Nascimento" value={formatDate(funcionario.data_nascimento)} />
              <DetailRow label="Gênero" value={funcionario.genero} />
              <DetailRow label="Escolaridade" value={funcionario.escolaridade} />
            </div>
            <Separator />
            <DetailRow label="Endereço Completo" value={funcionario.endereco_completo} />
          </TabsContent>

          <TabsContent value="profissional" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow label="Empresa" value={funcionario.bd_empresas?.nome_empresa} />
              <DetailRow label="Departamento" value={funcionario.bd_departamentos?.nome_departamento} />
              <DetailRow label="Centro de Custo" value={funcionario.bd_centros_custo?.nome_centro_custo} />
              <DetailRow label="Função" value={funcionario.bd_funcoes?.nome_funcao} />
              <DetailRow label="Equipe" value={funcionario.bd_equipes?.nome_equipe} />
            </div>
          </TabsContent>

          <TabsContent value="contratual" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow label="Status" value={funcionario.status} />
              <DetailRow label="Data de Admissão" value={formatDate(funcionario.data_admissao)} />
              <DetailRow label="Data de Férias" value={formatDate(funcionario.data_ferias)} />
              <DetailRow label="Data de Demissão" value={formatDate(funcionario.data_demissao)} />
            </div>
            <Separator />
            <DetailRow label="Observações" value={funcionario.observacoes} />
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-4 mt-4">
            <h4 className="text-sm font-semibold text-muted-foreground">Remuneração</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <DetailRow label="Salário Base" value={formatCurrency(funcionario.salario_base)} />
              <DetailRow label="Insalubridade" value={formatCurrency(funcionario.insalubridade)} />
              <DetailRow label="Periculosidade" value={formatCurrency(funcionario.periculosidade)} />
              <DetailRow label="Gratificação" value={formatCurrency(funcionario.gratificacao)} />
              <DetailRow label="Adicional Noturno" value={formatCurrency(funcionario.adicional_noturno)} />
              <DetailRow label="Custo Passagem" value={formatCurrency(funcionario.custo_passagem)} />
              <DetailRow label="Refeição" value={formatCurrency(funcionario.refeicao)} />
              <DetailRow label="Diárias" value={formatCurrency(funcionario.diarias)} />
            </div>
            <Separator />
            <h4 className="text-sm font-semibold text-muted-foreground">Dados Bancários</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <DetailRow label="Banco" value={funcionario.banco} />
              <DetailRow label="Agência" value={funcionario.agencia} />
              <DetailRow label="Conta Corrente" value={funcionario.conta_corrente} />
              <DetailRow label="Chave PIX" value={funcionario.chave_pix} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default FuncionarioDetailsModal;
