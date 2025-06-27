
import { supabase } from "@/integrations/supabase/client";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { formatBrazilianDateToString } from "@/utils/timezoneUtils";
import type { RegistroAplicacaoFilters } from "@/types/registroAplicacao";

const ENTREGAS_CACHE_KEY = 'entregas_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const fetchEntregasStable = async (
  filters?: RegistroAplicacaoFilters,
  allowedTeamIds?: string[]
): Promise<ListaProgramacaoEntrega[]> => {
  try {
    console.log("🚀 Fetching entregas - Optimized version");
    
    // Verificar cache
    const cacheKey = `${ENTREGAS_CACHE_KEY}_${JSON.stringify({ filters, teams: allowedTeamIds })}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log("💾 Using cached entregas");
        return data;
      }
    }

    // Team access control
    if (allowedTeamIds && allowedTeamIds.length === 0) {
      console.log("❌ No team access");
      return [];
    }

    // Query única ultra-otimizada com todos os JOINs
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
          centro_custo:centro_custo_id(
            id,
            codigo_centro_custo,
            nome_centro_custo
          )
        ),
        caminhao:caminhao_id(
          id,
          placa,
          modelo,
          marca
        ),
        equipe:equipe_id(
          id,
          nome_equipe
        ),
        usina:usina_id(
          id,
          nome_usina
        )
      `)
      .limit(50); // Paginação para performance

    // Filtros aplicados
    if (allowedTeamIds && allowedTeamIds.length > 0) {
      query = query.in("equipe_id", allowedTeamIds);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    } else {
      query = query.in("status", ["Enviada", "Entregue", "Cancelada"]);
    }

    if (filters?.data_inicio) {
      const formattedDate = formatBrazilianDateToString(filters.data_inicio);
      query = query.eq("data_entrega", formattedDate);
    }

    if (filters?.centro_custo_id) {
      // Sub-query otimizada
      const { data: requisicaoIds } = await supabase
        .from("bd_requisicoes")
        .select("id")
        .eq("centro_custo_id", filters.centro_custo_id)
        .limit(100);
      
      if (requisicaoIds && requisicaoIds.length > 0) {
        query = query.in("requisicao_id", requisicaoIds.map(r => r.id));
      } else {
        return [];
      }
    }

    if (filters?.caminhao_id) {
      query = query.eq("caminhao_id", filters.caminhao_id);
    }

    query = query
      .order("data_entrega", { ascending: false })
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("❌ Error fetching entregas:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log("📭 No entregas found");
      return [];
    }

    console.log(`📊 Raw data fetched: ${data.length} records`);

    // Calcular massa remanescente em batch
    const entregaIds = data.map(item => item.id);
    
    // Query batch para cargas
    const { data: cargasData } = await supabase
      .from("bd_registro_cargas")
      .select("lista_entrega_id, tonelada_real")
      .in("lista_entrega_id", entregaIds);

    // Query batch para aplicações
    const { data: aplicacoesData } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .select("lista_entrega_id, tonelada_aplicada")
      .in("lista_entrega_id", entregaIds);

    // Maps para performance
    const cargasMap = new Map();
    cargasData?.forEach(c => cargasMap.set(c.lista_entrega_id, c.tonelada_real));

    const aplicacoesMap = new Map();
    aplicacoesData?.forEach(a => {
      const current = aplicacoesMap.get(a.lista_entrega_id) || 0;
      aplicacoesMap.set(a.lista_entrega_id, current + (a.tonelada_aplicada || 0));
    });

    // Transform data - correção para lidar com arrays/objetos do Supabase
    const entregas: ListaProgramacaoEntrega[] = data.map(item => {
      const massaTotalCarga = cargasMap.get(item.id) || item.quantidade_massa;
      const totalAplicado = aplicacoesMap.get(item.id) || 0;
      const massaRemanescente = Math.max(0, massaTotalCarga - totalAplicado);

      // Função auxiliar para extrair dados de arrays ou objetos
      const extractData = (field: any) => {
        if (!field) return undefined;
        return Array.isArray(field) ? field[0] : field;
      };

      // Extrair dados dos relacionamentos
      const caminhaoData = extractData(item.caminhao);
      const equipeData = extractData(item.equipe);
      const usinaData = extractData(item.usina);
      const requisicaoData = extractData(item.requisicao);
      const centroCustoData = requisicaoData ? extractData(requisicaoData.centro_custo) : undefined;

      return {
        id: item.id,
        logradouro: item.logradouro,
        quantidade_massa: item.quantidade_massa,
        data_entrega: item.data_entrega,
        tipo_lancamento: item.tipo_lancamento,
        status: item.status,
        apontador_id: item.apontador_id,
        massa_remanescente: massaRemanescente,
        massa_total_carga: massaTotalCarga,
        caminhao_id: item.caminhao_id,
        equipe_id: item.equipe_id,
        usina_id: item.usina_id,
        requisicao_id: item.requisicao_id,
        programacao_entrega_id: item.programacao_entrega_id,
        programacao_id: item.programacao_id,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        caminhao: caminhaoData ? {
          id: caminhaoData.id,
          placa: caminhaoData.placa || 'N/A',
          modelo: caminhaoData.modelo || 'N/A',
          marca: caminhaoData.marca
        } : undefined,
        equipe: equipeData ? {
          id: equipeData.id,
          nome_equipe: equipeData.nome_equipe || 'N/A'
        } : undefined,
        usina: usinaData ? {
          id: usinaData.id,
          nome_usina: usinaData.nome_usina || 'N/A'
        } : undefined,
        centro_custo_nome: centroCustoData?.nome_centro_custo,
        requisicao: requisicaoData ? {
          id: requisicaoData.id,
          numero: requisicaoData.numero,
          centro_custo: centroCustoData ? {
            id: centroCustoData.id,
            codigo_centro_custo: centroCustoData.codigo_centro_custo || '',
            nome_centro_custo: centroCustoData.nome_centro_custo
          } : undefined
        } : undefined
      };
    });

    // Cache o resultado
    localStorage.setItem(cacheKey, JSON.stringify({
      data: entregas,
      timestamp: Date.now()
    }));

    console.log(`✅ Entregas processed: ${entregas.length}`);
    return entregas;

  } catch (error) {
    console.error("💥 Error fetching entregas:", error);
    throw error;
  }
};
