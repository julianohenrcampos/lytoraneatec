
import { supabase } from "@/integrations/supabase/client";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { formatBrazilianDateToString } from "@/utils/timezoneUtils";

/**
 * Fetch entregas enviadas and entregues that are available for registro aplicacao
 * Now includes finalized deliveries for viewing and better debugging
 */
export const fetchEntregasEnviadas = async (
  selectedDate?: Date,
  equipeId?: string
): Promise<ListaProgramacaoEntrega[]> => {
  try {
    console.log("🔍 Fetching entregas - Input params:", {
      selectedDate: selectedDate ? formatBrazilianDateToString(selectedDate) : "ALL DATES",
      equipeId: equipeId || "ALL TEAMS"
    });
    
    // Query principal nas tabelas ao invés da view, incluindo relações com centro de custo
    let query = supabase
      .from("bd_lista_programacao_entrega")
      .select(`
        id,
        logradouro,
        quantidade_massa,
        data_entrega,
        tipo_lancamento,
        status,
        apontador_id,
        caminhao_id,
        equipe_id,
        usina_id,
        requisicao_id,
        programacao_entrega_id,
        programacao_id,
        created_at,
        updated_at,
        requisicao:requisicao_id(
          id,
          numero,
          centro_custo_id,
          centro_custo:centro_custo_id(
            id,
            nome_centro_custo
          )
        )
      `)
      .in("status", ["Enviada", "Entregue", "Pendente"]); // Incluir mais status

    // Filter by date if provided - usar formatação brasileira
    if (selectedDate) {
      const formattedDate = formatBrazilianDateToString(selectedDate);
      console.log("📅 Filtering by date:", formattedDate);
      query = query.eq("data_entrega", formattedDate);
    } else {
      console.log("📅 No date filter - showing all dates");
    }

    // Filter by equipe if provided
    if (equipeId) {
      console.log("👥 Filtering by equipe:", equipeId);
      query = query.eq("apontador_id", equipeId);
    } else {
      console.log("👥 No team filter - showing all teams");
    }

    // Ordenar por data mais recente
    query = query.order("data_entrega", { ascending: false })
                 .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("❌ Error fetching entregas:", error);
      throw error;
    }

    console.log(`📊 Raw data fetched: ${data?.length || 0} records`);
    console.log("📋 Raw data sample:", data?.slice(0, 3));
    
    if (!data || data.length === 0) {
      console.log("⚠️ No entregas found with current filters");
      return [];
    }

    // Buscar dados relacionados para enriquecer os resultados
    const caminhaoIds = [...new Set(data.map(item => item.caminhao_id).filter(Boolean))];
    const equipeIds = [...new Set(data.map(item => item.equipe_id).filter(Boolean))];
    const usinaIds = [...new Set(data.map(item => item.usina_id).filter(Boolean))];

    console.log("🔗 Fetching related data:", {
      caminhoes: caminhaoIds.length,
      equipes: equipeIds.length,
      usinas: usinaIds.length
    });

    // Fetch dados relacionados em paralelo
    const [caminhoesResult, equipesResult, usinasResult] = await Promise.all([
      caminhaoIds.length > 0 ? supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, placa, modelo, marca")
        .in("id", caminhaoIds) : Promise.resolve({ data: [] }),
      equipeIds.length > 0 ? supabase
        .from("bd_equipes")
        .select("id, nome_equipe")
        .in("id", equipeIds) : Promise.resolve({ data: [] }),
      usinaIds.length > 0 ? supabase
        .from("bd_usinas")
        .select("id, nome_usina")
        .in("id", usinaIds) : Promise.resolve({ data: [] })
    ]);

    // Create lookup maps with proper typing
    const caminhoesMap = new Map();
    caminhoesResult.data?.forEach(c => caminhoesMap.set(c.id, c));
    
    const equipesMap = new Map();
    equipesResult.data?.forEach(e => equipesMap.set(e.id, e));
    
    const usinasMap = new Map();
    usinasResult.data?.forEach(u => usinasMap.set(u.id, u));
    
    console.log("🗺️ Created lookup maps:", {
      caminhoes: caminhoesMap.size,
      equipes: equipesMap.size,
      usinas: usinasMap.size
    });

    // Para cada entrega, calcular massa remanescente corretamente
    const entregasComMassa = await Promise.all(
      data.map(async (item) => {
        let massaRemanescente = item.quantidade_massa; // Default para quantidade original
        let massaTotalCarga = item.quantidade_massa;

        try {
          // Buscar registro de carga se existir
          const { data: cargaData } = await supabase
            .from("bd_registro_cargas")
            .select("tonelada_real")
            .eq("lista_entrega_id", item.id)
            .maybeSingle();

          if (cargaData?.tonelada_real) {
            massaTotalCarga = cargaData.tonelada_real;

            // Buscar total já aplicado para esta entrega específica
            const { data: aplicadoData } = await supabase
              .from("bd_registro_apontamento_aplicacao")
              .select("tonelada_aplicada")
              .eq("lista_entrega_id", item.id);

            const totalJaAplicado = aplicadoData?.reduce((sum, app) => sum + (app.tonelada_aplicada || 0), 0) || 0;
            
            // Fórmula correta: massa remanescente = massa total da carga - total já aplicado
            massaRemanescente = Math.max(0, massaTotalCarga - totalJaAplicado);
            
            console.log(`📊 Massa calculation for ${item.logradouro}:`, {
              massaTotalCarga,
              totalJaAplicado,
              massaRemanescente
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error calculating massa for entrega ${item.id}:`, error);
        }

        return {
          ...item,
          massa_remanescente: massaRemanescente,
          massa_total_carga: massaTotalCarga
        };
      })
    );
    
    // Transform data to match ListaProgramacaoEntrega interface
    const entregas: ListaProgramacaoEntrega[] = entregasComMassa.map(item => {
      const caminhao = item.caminhao_id ? caminhoesMap.get(item.caminhao_id) : undefined;
      const equipe = item.equipe_id ? equipesMap.get(item.equipe_id) : undefined;
      const usina = item.usina_id ? usinasMap.get(item.usina_id) : undefined;

      // Safely access requisicao data - handle both array and object cases
      const requisicaoData = Array.isArray(item.requisicao) ? item.requisicao[0] : item.requisicao;
      
      // Safely access centro_custo data - handle both array and object cases
      const centroCustoData = requisicaoData?.centro_custo ? 
        (Array.isArray(requisicaoData.centro_custo) ? requisicaoData.centro_custo[0] : requisicaoData.centro_custo) : 
        undefined;

      return {
        id: item.id,
        logradouro: item.logradouro,
        quantidade_massa: item.quantidade_massa,
        data_entrega: item.data_entrega,
        tipo_lancamento: item.tipo_lancamento,
        status: item.status,
        apontador_id: item.apontador_id,
        massa_remanescente: item.massa_remanescente,
        massa_total_carga: item.massa_total_carga,
        caminhao_id: item.caminhao_id,
        equipe_id: item.equipe_id,
        usina_id: item.usina_id,
        requisicao_id: item.requisicao_id,
        programacao_entrega_id: item.programacao_entrega_id,
        programacao_id: item.programacao_id,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        // Add the related data with proper fallbacks
        caminhao: caminhao ? {
          id: caminhao.id,
          placa: caminhao.placa || 'N/A',
          modelo: caminhao.modelo || 'N/A',
          marca: caminhao.marca
        } : undefined,
        equipe: equipe ? {
          id: equipe.id,
          nome_equipe: equipe.nome_equipe || 'N/A'
        } : undefined,
        usina: usina ? {
          id: usina.id,
          nome_usina: usina.nome_usina || 'N/A'
        } : undefined,
        // Add centro_custo_nome from the requisicao relation - safely access the data
        centro_custo_nome: centroCustoData?.nome_centro_custo,
        requisicao: requisicaoData ? {
          id: requisicaoData.id,
          numero: requisicaoData.numero,
          centro_custo_id: requisicaoData.centro_custo_id,
          centro_custo: centroCustoData ? {
            id: centroCustoData.id,
            nome_centro_custo: centroCustoData.nome_centro_custo
          } : undefined
        } : undefined
      };
    });

    console.log(`✅ Final processed entregas: ${entregas.length}`);
    console.log("📋 Sample entrega with centro custo:", {
      logradouro: entregas[0]?.logradouro,
      centro_custo_nome: entregas[0]?.centro_custo_nome,
      data_entrega: entregas[0]?.data_entrega
    });
    
    // Log estatísticas por status
    const statusStats = entregas.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log("📊 Status distribution:", statusStats);

    return entregas;
  } catch (error) {
    console.error("💥 Unexpected error fetching entregas:", error);
    throw error;
  }
};
