
import React from "react";
import { Truck, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveGrid } from "@/components/layout/ResponsiveContainer";
import PieChartCard from "./PieChartCard";
import BarChartCard from "./BarChartCard";
import CustomSituacaoTooltip from "./CustomSituacaoTooltip";

interface MaquinasSectionProps {
  navigateTo: (path: string) => void;
  period: string;
  statusColors: Record<string, string>;
}

const MaquinasSection: React.FC<MaquinasSectionProps> = ({ navigateTo, period, statusColors }) => {
  const handleSituacaoClick = (situacao: string) => {
    navigateTo(`/gestao-maquinas/caminhoes?situacao=${encodeURIComponent(situacao)}`);
  };
  // Máquinas & Equipamentos Module Queries
  const { data: veiculosData, isLoading: loadingVeiculos } = useQuery({
    queryKey: ['veiculos-distribution', period],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('bd_caminhoes_equipamentos')
          .select(`
            id, situacao, frota, numero_frota, categoria_ativo_id,
            categoria:bd_categorias_ativos(id, nome_categoria)
          `);
          
        if (error) throw error;
        
        // Count by category name
        const tipoCount: Record<string, number> = {};
        
        const situacaoDetails = {
          operando: [] as Array<{frota: string, numero_frota: string}>,
          manutencao: [] as Array<{frota: string, numero_frota: string}>,
          outros: [] as Array<{frota: string, numero_frota: string}>
        };
        
        data?.forEach(item => {
          const categoria = (item.categoria as any)?.nome_categoria || 'Outros';
          tipoCount[categoria] = (tipoCount[categoria] || 0) + 1;
          
          const frotaInfo = {
            frota: item.frota || 'Sem frota',
            numero_frota: item.numero_frota || 'N/A'
          };
          
          if (item.situacao === 'Operando') {
            situacaoDetails.operando.push(frotaInfo);
          } else if (item.situacao === 'Em Manutenção') {
            situacaoDetails.manutencao.push(frotaInfo);
          } else {
            situacaoDetails.outros.push(frotaInfo);
          }
        });
        
        const distribuicaoArray = Object.entries(tipoCount)
          .filter(([_, count]) => count > 0)
          .map(([name, value]) => ({ name, value }));
        
        return {
          distribuicao: distribuicaoArray,
          situacao: [
            { 
              name: 'Operando', 
              value: situacaoDetails.operando.length,
              frotas: situacaoDetails.operando
            },
            { 
              name: 'Em Manutenção', 
              value: situacaoDetails.manutencao.length,
              frotas: situacaoDetails.manutencao
            },
            { 
              name: 'Outros', 
              value: situacaoDetails.outros.length,
              frotas: situacaoDetails.outros
            }
          ]
        };
      } catch (error) {
        console.error('Error fetching veiculos:', error);
        return { distribuicao: [], situacao: [] };
      }
    },
  });

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        Máquinas e Equipamentos
      </h2>
      
      <ResponsiveGrid cols={{ sm: 1, md: 2, lg: 2 }} gap="md">
        <PieChartCard
          title="Caminhões e Equipamentos"
          icon={Truck}
          data={veiculosData?.distribuicao || []}
          colors={statusColors}
          isLoading={loadingVeiculos}
          onClick={() => navigateTo("/gestao-maquinas/caminhoes")}
        />

        <BarChartCard
          title="Situação Operacional"
          icon={Settings}
          data={veiculosData?.situacao || []}
          colors={statusColors}
          isLoading={loadingVeiculos}
          onClick={() => navigateTo("/gestao-maquinas/caminhoes")}
          onBarClick={handleSituacaoClick}
          tooltipContent={CustomSituacaoTooltip}
        />
      </ResponsiveGrid>
    </section>
  );
};

export default MaquinasSection;
