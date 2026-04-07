
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Empresa } from "@/types/empresa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, ShieldCheck, Globe } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EmpresaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa?: Empresa;
}

const EmpresaDetailsModal: React.FC<EmpresaDetailsModalProps> = ({ isOpen, onClose, empresa }) => {
  if (!empresa) return null;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return "Data inválida";
    }
  };

  const isPJ = (empresa.pessoa_tipo || "PJ") === "PJ";
  const isSite = empresa.origem_cadastro === 'integracao_site';

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-4 gap-4 py-2 border-b last:border-b-0">
      <span className="font-medium text-muted-foreground col-span-1">{label}:</span>
      <span className="col-span-3">{value || "Não informado"}</span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Empresa</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex flex-col">
            <Row label="Tipo" value={isPJ ? "Pessoa Jurídica" : "Pessoa Física"} />
            <Row label="Nome" value={empresa.nome_empresa} />
            <Row label={isPJ ? "CNPJ" : "CPF"} value={empresa.cnpj} />
            {isPJ && <Row label="Insc. Estadual" value={empresa.inscricao_estadual} />}
            {isPJ && <Row label="Insc. Municipal" value={empresa.inscricao_municipal} />}
            <Row label="Telefone" value={empresa.telefone} />
            <Row label="Contato" value={empresa.nome_contato} />
            <Row label="Situação" value={
              empresa.situacao === 'Ativa' ? (
                <span className="flex items-center">
                  <Check className="mr-1 h-4 w-4 text-green-500" />
                  Ativa
                </span>
              ) : (
                <span className="flex items-center">
                  <X className="mr-1 h-4 w-4 text-red-500" />
                  Inativa
                </span>
              )
            } />
          </div>

          {isSite && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Integração
              </h3>
              <div className="flex flex-col">
                <Row label="Origem" value={
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                    <Globe className="h-3 w-3" />
                    Portal de Fornecedores
                  </span>
                } />
                <Row label="Compliance" value={
                  empresa.aprovado_compliance ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <ShieldCheck className="h-4 w-4" />
                      Aprovado
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Pendente</span>
                  )
                } />
                <Row label="Data Integração" value={formatDate(empresa.data_integracao)} />
                <Row label="Atualizada via Site" value={empresa.atualizado_via_integracao ? "Sim" : "Não"} />
              </div>
            </>
          )}

          {(empresa.endereco_completo || empresa.endereco_cidade) && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold text-muted-foreground">Endereço</h3>
              <div className="flex flex-col">
                <Row label="Endereço" value={empresa.endereco_completo} />
                <Row label="CEP" value={empresa.endereco_cep} />
                <Row label="Cidade" value={empresa.endereco_cidade} />
                <Row label="UF" value={empresa.endereco_estado} />
              </div>
            </>
          )}

          {(empresa.banco || empresa.pix) && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold text-muted-foreground">Dados Bancários</h3>
              <div className="flex flex-col">
                <Row label="Banco" value={empresa.banco} />
                <Row label="Agência" value={empresa.agencia} />
                <Row label="Conta" value={empresa.conta} />
                <Row label="Tipo Conta" value={empresa.tipo_conta === 'CORRENTE' ? 'Corrente' : empresa.tipo_conta === 'POUPANCA' ? 'Poupança' : empresa.tipo_conta} />
                <Row label="PIX" value={empresa.pix} />
              </div>
            </>
          )}

          <Separator />
          <div className="flex flex-col">
            <Row label="Criado em" value={formatDate(empresa.created_at)} />
            <Row label="Atualizado" value={formatDate(empresa.updated_at)} />
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaDetailsModal;
