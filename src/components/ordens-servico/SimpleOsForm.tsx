import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrdemServico } from "@/types/ordemServico";

interface SimpleOsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (osData: Partial<OrdemServico>, motivo: string) => void;
  currentOs: OrdemServico | null;
  isLoading: boolean;
  veiculosDropdown?: Array<{id: string; nome_caminhao: string}>;
  funcionarios?: Array<{id: string; nome_completo: string}>;
}

const SimpleOsForm: React.FC<SimpleOsFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentOs,
  isLoading,
  veiculosDropdown = [],
  funcionarios = []
}) => {
  const [formData, setFormData] = useState({
    tipo_servico: "",
    descricao_servico: "",
    observacoes: "",
    status: "Aberta" as 'Aberta' | 'Em Andamento' | 'Concluída' | 'Cancelada',
    valor_servico: 0,
    caminhao_equipamento_id: "",
    mecanico_id: "",
    data_previsao: "",
    data_conclusao: ""
  });

  useEffect(() => {
    if (currentOs) {
      setFormData({
        tipo_servico: currentOs.tipo_servico || "",
        descricao_servico: currentOs.descricao_servico || "",
        observacoes: currentOs.observacoes || "",
        status: currentOs.status || "Aberta",
        valor_servico: currentOs.valor_servico || 0,
        caminhao_equipamento_id: currentOs.caminhao_equipamento_id || "",
        mecanico_id: currentOs.mecanico_id || "",
        data_previsao: currentOs.data_previsao || "",
        data_conclusao: currentOs.data_conclusao || ""
      });
    }
  }, [currentOs]);
  const [motivo, setMotivo] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, motivo);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {currentOs ? `Editar OS ${currentOs.numero_os}` : "Nova Ordem de Serviço"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tipo_servico">Tipo de Serviço</Label>
            <Input
              id="tipo_servico"
              value={formData.tipo_servico}
              onChange={(e) => setFormData(prev => ({ ...prev, tipo_servico: e.target.value }))}
              placeholder="Digite o tipo de serviço"
            />
          </div>

          <div>
            <Label htmlFor="descricao_servico">Descrição do Serviço</Label>
            <Textarea
              id="descricao_servico"
              value={formData.descricao_servico}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao_servico: e.target.value }))}
              placeholder="Descreva o serviço a ser realizado"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: 'Aberta' | 'Em Andamento' | 'Concluída' | 'Cancelada') => 
                setFormData(prev => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberta">Aberta</SelectItem>
                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="caminhao_equipamento_id">Caminhão/Equipamento</Label>
            <Select
              value={formData.caminhao_equipamento_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, caminhao_equipamento_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent>
                {veiculosDropdown.map((veiculo) => (
                  <SelectItem key={veiculo.id} value={veiculo.id}>
                    {veiculo.nome_caminhao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="mecanico_id">Mecânico Responsável</Label>
            <Select
              value={formData.mecanico_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, mecanico_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mecânico" />
              </SelectTrigger>
              <SelectContent>
                {funcionarios.map((funcionario) => (
                  <SelectItem key={funcionario.id} value={funcionario.id}>
                    {funcionario.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_previsao">Data Previsão</Label>
              <Input
                id="data_previsao"
                type="date"
                value={formData.data_previsao}
                onChange={(e) => setFormData(prev => ({ ...prev, data_previsao: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="data_conclusao">Data Conclusão</Label>
              <Input
                id="data_conclusao"
                type="date"
                value={formData.data_conclusao}
                onChange={(e) => setFormData(prev => ({ ...prev, data_conclusao: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="valor_servico">Valor do Serviço (R$)</Label>
            <Input
              id="valor_servico"
              type="number"
              step="0.01"
              value={formData.valor_servico}
              onChange={(e) => setFormData(prev => ({ ...prev, valor_servico: parseFloat(e.target.value) || 0 }))}
              placeholder="0,00"
            />
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações adicionais"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="motivo">Motivo da Alteração</Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da alteração"
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleOsForm;