import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolios, upsertPortfolio, PortfolioFilters, PortfolioEmpresa, getCatalogoDataForPrefill } from "@/services/portfolioEmpresaService";
import PortfolioTable from "./PortfolioTable";
import PortfolioFiltersBar from "./PortfolioFilters";
import PortfolioFormModal from "./PortfolioFormModal";
import VeiculoFormModal from "@/components/veiculos/VeiculoFormModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createVeiculo } from "@/services/veiculo";
import { supabase } from "@/integrations/supabase/client";

const PortfolioPage: React.FC = () => {
  const [filters, setFilters] = useState<PortfolioFilters>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioEmpresa | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Estado para cadastro de equipamento via portfólio
  const [confirmItem, setConfirmItem] = useState<PortfolioEmpresa | null>(null);
  const [isVeiculoModalOpen, setIsVeiculoModalOpen] = useState(false);
  const [prefilledVeiculo, setPrefilledVeiculo] = useState<any>(null);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["portfolios", filters],
    queryFn: () => fetchPortfolios(filters),
  });

  // Dropdowns para VeiculoFormModal
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos-dropdown"],
    queryFn: async () => {
      const { data } = await supabase.from("bd_departamentos").select("id, nome_departamento").order("nome_departamento");
      return data || [];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-dropdown"],
    queryFn: async () => {
      const { data } = await supabase.from("bd_empresas").select("id, nome_empresa").order("nome_empresa");
      return data || [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-dropdown"],
    queryFn: async () => {
      const { data } = await supabase.from("bd_categorias_ativos").select("id, nome_categoria").order("nome_categoria");
      return data || [];
    },
  });

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      await upsertPortfolio(formData);
      toast.success("Portfólio salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error("Este tipo de equipamento já está cadastrado para esta empresa.");
      } else {
        toast.error(e.message || "Erro ao salvar.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCadastrarEquipamento = (item: PortfolioEmpresa) => {
    setConfirmItem(item);
  };

  const handleConfirmCadastro = async () => {
    if (!confirmItem) return;
    try {
      if (confirmItem.catalogo_equipamento_id) {
        const catalogo = await getCatalogoDataForPrefill(confirmItem.catalogo_equipamento_id);
        setPrefilledVeiculo({
          empresa_id: confirmItem.empresa_id,
          catalogo_equipamento_id: confirmItem.catalogo_equipamento_id,
          tipo_equipamento_id: catalogo.tipo_equipamento_id,
          categoria_ativo_id: catalogo.categoria_id,
          subcategoria_ativo_id: catalogo.subcategoria_id,
          fabricante_id: catalogo.fabricante_id,
          modelo_id: catalogo.modelo_id,
          capacidade: catalogo.capacidade,
          tipo_combustivel: catalogo.combustivel,
          cor: catalogo.cor_padrao,
          motor: catalogo.motor_padrao,
          situacao: "ATIVO",
        });
      } else {
        setPrefilledVeiculo({
          empresa_id: confirmItem.empresa_id,
          tipo_equipamento_id: confirmItem.tipo_equipamento_id,
          situacao: "ATIVO",
        });
      }
      setConfirmItem(null);
      setIsVeiculoModalOpen(true);
    } catch (e: any) {
      toast.error("Erro ao buscar dados do catálogo: " + (e.message || ""));
    }
  };

  const handleSaveVeiculo = async (id: string | undefined, data: any) => {
    try {
      await createVeiculo(data);
      toast.success("Equipamento cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setIsVeiculoModalOpen(false);
      setPrefilledVeiculo(null);
    } catch (e: any) {
      if (e.message?.includes("Limite do portfolio")) {
        toast.error("Limite do portfólio já atingido para este equipamento.");
      } else {
        toast.error(e.message || "Erro ao cadastrar equipamento.");
      }
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfólio de Empresas</h1>
          <p className="text-muted-foreground">Tipos de equipamentos que cada empresa pode fornecer</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Portfólio
        </Button>
      </div>

      <PortfolioFiltersBar filters={filters} onFiltersChange={setFilters} />
      <PortfolioTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
        onCadastrarEquipamento={handleCadastrarEquipamento}
      />
      <PortfolioFormModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSubmit={handleSubmit} isSubmitting={isSubmitting} editingItem={editingItem} />

      <ConfirmDialog
        isOpen={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        onConfirm={handleConfirmCadastro}
        title="Cadastrar equipamento"
        description="Deseja cadastrar um novo equipamento com base neste portfólio? Os dados técnicos do catálogo serão preenchidos automaticamente."
        confirmText="Continuar"
        variant="info"
      />

      {isVeiculoModalOpen && (
        <VeiculoFormModal
          isOpen={isVeiculoModalOpen}
          onClose={() => { setIsVeiculoModalOpen(false); setPrefilledVeiculo(null); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["portfolios"] });
          }}
          veiculo={prefilledVeiculo}
          onSave={handleSaveVeiculo}
          departamentos={departamentos}
          empresas={empresas}
          categorias={categorias}
        />
      )}
    </div>
  );
};

export default PortfolioPage;
