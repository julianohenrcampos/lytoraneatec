
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  MaquinasKpis, 
  TipoVeiculoDistribution, 
  StatusOperacionalData,
  IdadeFrotaData,
  UtilizacaoData,
  CentroCustoUtilizacao,
  EquipamentosPorCentroCusto,
  ChamadosPorStatus,
  ManutencaoTipoFalha,
  CustoLocacao,
  CaminhoesProgramados,
  CaminhoesPorCentroCusto,
  MaquinasFilters,
  AtivoBasico 
} from "@/types/maquinas";

export const useMaquinasDashboard = (filters: MaquinasFilters) => {
  // 1. KPIs Principais
  const kpisQuery = useQuery<MaquinasKpis>({
    queryKey: ["maquinas-kpis", filters],
    queryFn: async () => {
      console.log("🔍 DEBUG useMaquinasDashboard - buscando KPIs");

      // Total de ativos
      let ativosQuery = supabase
        .from("bd_caminhoes_equipamentos")
        .select("*", { count: "exact", head: true });

      if (filters.tipoVeiculo && filters.tipoVeiculo.length > 0) {
        ativosQuery = ativosQuery.in("tipo_veiculo", filters.tipoVeiculo);
      }

      if (filters.empresaId) {
        ativosQuery = ativosQuery.eq("empresa_id", filters.empresaId);
      }

      const { count: totalAtivos } = await ativosQuery;

      // Status atual dos ativos (baseado no último apontamento)
      const { data: ultimosApontamentos } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          caminhao_equipamento_id,
          situacao,
          data,
          bd_caminhoes_equipamentos(id, tipo_veiculo, empresa_id)
        `)
        .gte("data", filters.periodStart)
        .lte("data", filters.periodEnd)
        .order("data", { ascending: false });

      // Agrupar por ativo e pegar o status mais recente
      const statusAtivos = new Map();
      ultimosApontamentos?.forEach(apontamento => {
        if (!statusAtivos.has(apontamento.caminhao_equipamento_id)) {
          statusAtivos.set(apontamento.caminhao_equipamento_id, apontamento.situacao);
        }
      });

      const ativosOperando = Array.from(statusAtivos.values()).filter(s => s === 'Operando').length;
      const ativosManutencao = Array.from(statusAtivos.values()).filter(s => s === 'Em Manutenção').length;
      const ativosDisponiveis = (totalAtivos || 0) - ativosOperando - ativosManutencao;

      // Chamados abertos
      const { count: chamadosAbertos } = await supabase
        .from("bd_chamados_os")
        .select("*", { count: "exact", head: true })
        .eq("status", "Aberto");

      // Tempo médio de reparo
      const { data: chamadosFechados } = await supabase
        .from("bd_chamados_os")
        .select("data_solicitacao, created_at, updated_at")
        .eq("status", "Fechado")
        .gte("data_solicitacao", filters.periodStart)
        .lte("data_solicitacao", filters.periodEnd);

      let tempoMedioReparo = 0;
      if (chamadosFechados && chamadosFechados.length > 0) {
        const tempos = chamadosFechados.map(chamado => {
          const inicio = new Date(chamado.data_solicitacao);
          const fim = new Date(chamado.updated_at || chamado.created_at);
          return (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24); // dias
        });
        tempoMedioReparo = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      }

      return {
        totalAtivos: totalAtivos || 0,
        ativosOperando,
        ativosDisponiveis,
        ativosManutencao,
        chamadosAbertos: chamadosAbertos || 0,
        tempoMedioReparo: Math.round(tempoMedioReparo * 10) / 10
      };
    }
  });

  // 2. Distribuição por Tipo de Veículo (melhorado)
  const tipoVeiculoQuery = useQuery<TipoVeiculoDistribution[]>({
    queryKey: ["maquinas-tipo-veiculo", filters],
    queryFn: async () => {
      let query = supabase
        .from("bd_caminhoes_equipamentos")
        .select("tipo_veiculo, capacidade, aluguel");

      if (filters.empresaId) {
        query = query.eq("empresa_id", filters.empresaId);
      }

      const { data: ativos } = await query;

      const distribuicao = new Map<string, {
        quantidade: number;
        capacidadeTotal: number;
        valorLocacaoTotal: number;
      }>();

      ativos?.forEach(ativo => {
        const tipo = ativo.tipo_veiculo || "Não informado";
        const capacidade = parseFloat(ativo.capacidade?.replace(/[^\d,.-]/g, '').replace(',', '.') || "0");
        const aluguel = parseFloat(ativo.aluguel?.replace(/[^\d,.-]/g, '').replace(',', '.') || "0");
        
        if (!distribuicao.has(tipo)) {
          distribuicao.set(tipo, { quantidade: 0, capacidadeTotal: 0, valorLocacaoTotal: 0 });
        }
        
        const data = distribuicao.get(tipo)!;
        data.quantidade += 1;
        data.capacidadeTotal += capacidade;
        data.valorLocacaoTotal += aluguel;
      });

      const total = ativos?.length || 0;
      return Array.from(distribuicao.entries()).map(([tipo, data]) => ({
        tipo,
        quantidade: data.quantidade,
        percentual: total > 0 ? (data.quantidade / total) * 100 : 0,
        capacidadeTotal: data.capacidadeTotal,
        valorLocacaoTotal: data.valorLocacaoTotal
      }));
    }
  });

  // 3. Status Operacional (melhorado com detalhes)
  const statusOperacionalQuery = useQuery<StatusOperacionalData[]>({
    queryKey: ["maquinas-status", filters],
    queryFn: async () => {
      const { data: apontamentos } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          caminhao_equipamento_id,
          situacao,
          data,
          bd_caminhoes_equipamentos(id, frota, numero_frota, tipo_veiculo, modelo)
        `)
        .gte("data", filters.periodStart)
        .lte("data", filters.periodEnd)
        .order("data", { ascending: false });

      const statusMap = new Map<string, Array<{
        id: string;
        frota: string;
        numero_frota: string;
        tipo_veiculo: string;
        modelo?: string;
      }>>();

      const processedAtivos = new Set<string>();

      apontamentos?.forEach(apt => {
        if (!processedAtivos.has(apt.caminhao_equipamento_id)) {
          const status = apt.situacao || 'Disponível';
          const caminhao = apt.bd_caminhoes_equipamentos as any;
          
          if (caminhao && !Array.isArray(caminhao)) {
            if (!statusMap.has(status)) {
              statusMap.set(status, []);
            }
            
            statusMap.get(status)!.push({
              id: caminhao.id,
              frota: caminhao.frota || '',
              numero_frota: caminhao.numero_frota || '',
              tipo_veiculo: caminhao.tipo_veiculo || '',
              modelo: caminhao.modelo
            });
            
            processedAtivos.add(apt.caminhao_equipamento_id);
          }
        }
      });

      return Array.from(statusMap.entries()).map(([status, ativos]) => ({
        status,
        quantidade: ativos.length,
        ativos
      }));
    }
  });

  // 4. Idade da Frota (melhorado com detalhes)
  const idadeFrotaQuery = useQuery<IdadeFrotaData[]>({
    queryKey: ["maquinas-idade", filters],
    queryFn: async () => {
      let query = supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, frota, numero_frota, ano_fabricacao, tipo_veiculo, modelo");

      if (filters.empresaId) {
        query = query.eq("empresa_id", filters.empresaId);
      }

      const { data: ativos } = await query;
      const anoAtual = new Date().getFullYear();

      const faixas = new Map<string, Array<{
        id: string;
        frota: string;
        numero_frota: string;
        tipo_veiculo: string;
        ano_fabricacao: string;
        modelo?: string;
      }>>();
      
      ativos?.forEach(ativo => {
        const ano = parseInt(ativo.ano_fabricacao || "0");
        const idade = ano > 0 ? anoAtual - ano : 0;
        
        let faixa = "Não informado";
        if (idade <= 2) faixa = "0-2 anos";
        else if (idade <= 5) faixa = "3-5 anos";
        else if (idade <= 10) faixa = "6-10 anos";
        else if (idade > 10) faixa = "Mais de 10 anos";

        if (!faixas.has(faixa)) {
          faixas.set(faixa, []);
        }
        
        faixas.get(faixa)!.push({
          id: ativo.id,
          frota: ativo.frota || '',
          numero_frota: ativo.numero_frota || '',
          tipo_veiculo: ativo.tipo_veiculo || '',
          ano_fabricacao: ativo.ano_fabricacao || '',
          modelo: ativo.modelo
        });
      });

      return Array.from(faixas.entries()).map(([faixaIdade, ativos]) => ({
        faixaIdade,
        quantidade: ativos.length,
        ativos
      }));
    }
  });

  // 5. Equipamentos por Centro de Custo (NOVO)
  const equipamentosPorCentroCustoQuery = useQuery<EquipamentosPorCentroCusto[]>({
    queryKey: ["equipamentos-centro-custo", filters],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data: apontamentosHoje } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          caminhao_equipamento_id,
          situacao,
          hora_inicial,
          hora_final,
          operador_id,
          centro_custo_id,
          bd_caminhoes_equipamentos(id, frota, numero_frota, tipo_veiculo),
          bd_centros_custo(nome_centro_custo),
          bd_funcionarios(nome_completo)
        `)
        .eq("data", hoje);

      const centroMap = new Map<string, {
        caminhoes: any[];
        equipamentos: any[];
      }>();

      apontamentosHoje?.forEach(apt => {
        const centroCusto = apt.bd_centros_custo as any;
        const centro = (centroCusto && !Array.isArray(centroCusto)) ? centroCusto.nome_centro_custo : "Não informado";
        const caminhao = apt.bd_caminhoes_equipamentos as any;
        const operador = apt.bd_funcionarios as any;
        
        if (!centroMap.has(centro)) {
          centroMap.set(centro, { caminhoes: [], equipamentos: [] });
        }
        
        const equipamento = {
          id: caminhao?.id || '',
          frota: caminhao?.frota || '',
          numero_frota: caminhao?.numero_frota || '',
          operador: operador?.nome_completo || 'Não informado',
          horaInicio: apt.hora_inicial,
          horaFim: apt.hora_final,
          situacao: apt.situacao || 'Disponível'
        };
        
        const isCaminhao = caminhao?.tipo_veiculo?.toLowerCase().includes('caminhão');
        
        if (isCaminhao) {
          centroMap.get(centro)!.caminhoes.push(equipamento);
        } else {
          centroMap.get(centro)!.equipamentos.push(equipamento);
        }
      });

      return Array.from(centroMap.entries()).map(([centroCusto, data]) => ({
        centroCusto,
        caminhoes: data.caminhoes,
        equipamentos: data.equipamentos,
        totalCaminhoes: data.caminhoes.length,
        totalEquipamentos: data.equipamentos.length
      }));
    }
  });

  // 6. Utilização por Centro de Custo (melhorado para gráfico de rosca)
  const centroCustoQuery = useQuery<CentroCustoUtilizacao[]>({
    queryKey: ["maquinas-centro-custo", filters],
    queryFn: async () => {
      const { data: utilizacao } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          horimetro_inicial,
          horimetro_final,
          abastecimento,
          centro_custo_id,
          bd_centros_custo(nome_centro_custo)
        `)
        .gte("data", filters.periodStart)
        .lte("data", filters.periodEnd);

      const centroMap = new Map<string, {
        totalHoras: number;
        totalKm: number;
        totalCombustivel: number;
      }>();

      utilizacao?.forEach(reg => {
        const centroCusto = reg.bd_centros_custo as any;
        const centro = (centroCusto && !Array.isArray(centroCusto)) ? centroCusto.nome_centro_custo : "Não informado";
        const horas = (reg.horimetro_final || 0) - (reg.horimetro_inicial || 0);
        
        if (!centroMap.has(centro)) {
          centroMap.set(centro, { totalHoras: 0, totalKm: 0, totalCombustivel: 0 });
        }
        
        const data = centroMap.get(centro)!;
        data.totalHoras += Math.max(0, horas);
        data.totalCombustivel += reg.abastecimento || 0;
      });

      const totalHorasGeral = Array.from(centroMap.values()).reduce((sum, data) => sum + data.totalHoras, 0);
      const totalCombustivelGeral = Array.from(centroMap.values()).reduce((sum, data) => sum + data.totalCombustivel, 0);

      return Array.from(centroMap.entries()).map(([centroCusto, data]) => ({
        centroCusto,
        ...data,
        percentualHoras: totalHorasGeral > 0 ? (data.totalHoras / totalHorasGeral) * 100 : 0,
        percentualCombustivel: totalCombustivelGeral > 0 ? (data.totalCombustivel / totalCombustivelGeral) * 100 : 0
      }));
    }
  });

  // 7. Chamados por Status e Prioridade
  const chamadosQuery = useQuery<ChamadosPorStatus[]>({
    queryKey: ["maquinas-chamados", filters],
    queryFn: async () => {
      const { data: chamados } = await supabase
        .from("bd_chamados_os")
        .select("status, prioridade")
        .gte("data_solicitacao", filters.periodStart)
        .lte("data_solicitacao", filters.periodEnd);

      const statusMap = new Map<string, number>();
      
      chamados?.forEach(chamado => {
        const key = `${chamado.status || 'Não informado'} - ${chamado.prioridade || 'Normal'}`;
        statusMap.set(key, (statusMap.get(key) || 0) + 1);
      });

      return Array.from(statusMap.entries()).map(([key, quantidade]) => {
        const [status, prioridade] = key.split(' - ');
        return { status, prioridade, quantidade };
      });
    }
  });

  // 8. Manutenções por Tipo de Falha (melhorado)
  const tipoFalhaQuery = useQuery<ManutencaoTipoFalha[]>({
    queryKey: ["maquinas-tipo-falha", filters],
    queryFn: async () => {
      const { data: chamados } = await supabase
        .from("bd_chamados_os")
        .select("tipo_falha")
        .gte("data_solicitacao", filters.periodStart)
        .lte("data_solicitacao", filters.periodEnd);

      const falhaMap = new Map<string, number>();
      
      chamados?.forEach(chamado => {
        const tipo = chamado.tipo_falha || "Não informado";
        falhaMap.set(tipo, (falhaMap.get(tipo) || 0) + 1);
      });

      const total = Array.from(falhaMap.values()).reduce((sum, count) => sum + count, 0);

      return Array.from(falhaMap.entries()).map(([tipoFalha, quantidade]) => ({
        tipoFalha,
        quantidade,
        custoEstimado: quantidade * 1500, // Estimativa base
        percentual: total > 0 ? (quantidade / total) * 100 : 0
      }));
    }
  });

  // 9. Custos de Locação
  const custoLocacaoQuery = useQuery<CustoLocacao>({
    queryKey: ["maquinas-custo", filters],
    queryFn: async () => {
      let query = supabase
        .from("bd_caminhoes_equipamentos")
        .select("aluguel");

      if (filters.empresaId) {
        query = query.eq("empresa_id", filters.empresaId);
      }

      const { data: ativos } = await query;

      const valorTotal = ativos?.reduce((total, ativo) => {
        const aluguel = parseFloat(ativo.aluguel?.replace(/[^\d,.-]/g, '').replace(',', '.') || "0");
        return total + aluguel;
      }, 0) || 0;

      // Calcular dias de manutenção no período
      const { data: manutencoes } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select("data, horimetro_inicial, horimetro_final")
        .eq("situacao", "Em Manutenção")
        .gte("data", filters.periodStart)
        .lte("data", filters.periodEnd);

      const diasManutencao = manutencoes?.length || 0;
      const horasManutencao = manutencoes?.reduce((total, man) => {
        return total + Math.max(0, (man.horimetro_final || 0) - (man.horimetro_inicial || 0));
      }, 0) || 0;

      const totalDescontos = diasManutencao * 500; // R$ 500 por dia de manutenção
      const valorLiquido = valorTotal - totalDescontos;

      return {
        valorTotal,
        totalDescontos,
        valorLiquido,
        diasManutencao,
        horasManutencao
      };
    }
  });

  // 10. Caminhões Programados para Entrega (AGRUPADOS POR CENTRO DE CUSTO)
  const caminhoesProgramadosQuery = useQuery<CaminhoesPorCentroCusto[]>({
    queryKey: ["caminhoes-programados", filters],
    queryFn: async () => {
      // Determinar as datas baseadas nos novos filtros específicos
      let dataInicio: string;
      let dataFim: string;

      if (filters.dataInicioPlanejamanento && filters.dataFimPlanejamento) {
        // Usar as datas específicas dos filtros
        dataInicio = filters.dataInicioPlanejamanento;
        dataFim = filters.dataFimPlanejamento;
      } else {
        // Comportamento padrão: próximos 7 dias
        const hoje = new Date();
        dataInicio = hoje.toISOString().split('T')[0];
        const proximos7dias = new Date(hoje);
        proximos7dias.setDate(hoje.getDate() + 7);
        dataFim = proximos7dias.toISOString().split('T')[0];
      }

      console.log("🔍 Buscando caminhões programados entre:", dataInicio, "e", dataFim);

      const { data: programacoes, error } = await supabase
        .from("bd_lista_programacao_entrega")
        .select(`
          id,
          data_entrega,
          status,
          logradouro,
          tipo_lancamento,
          bd_caminhoes_equipamentos(id, frota, numero_frota, placa),
          bd_requisicoes!inner(
            centro_custo_id,
            bd_centros_custo(codigo_centro_custo, nome_centro_custo)
          )
        `)
        .gte("data_entrega", dataInicio)
        .lte("data_entrega", dataFim)
        .in("status", ["Ativa", "Enviada", "Entregue"])
        .order("data_entrega", { ascending: true })
        .limit(50);

      console.log("🔍 Query resultado:", { programacoes, error, count: programacoes?.length });

      if (error) {
        console.error("❌ Erro na query de caminhões programados:", error);
        return [];
      }

      // Agrupar por centro de custo
      const gruposPorCentroCusto = new Map<string, {
        codigoCentroCusto: string;
        nomeCentroCusto: string;
        caminhoes: Array<{
          id: string;
          frota: string;
          numero_frota: string;
          placa: string;
          data_entrega: string;
          status: string;
        }>;
      }>();

      programacoes?.forEach(prog => {
        const caminhao = prog.bd_caminhoes_equipamentos as any;
        const requisicao = prog.bd_requisicoes as any;
        const centroCusto = requisicao?.bd_centros_custo as any;
        
        if (caminhao && centroCusto && caminhao.frota && caminhao.numero_frota) {
          const codigoCentroCusto = centroCusto.codigo_centro_custo || 'Não informado';
          const nomeCentroCusto = centroCusto.nome_centro_custo || '';
          
          if (!gruposPorCentroCusto.has(codigoCentroCusto)) {
            gruposPorCentroCusto.set(codigoCentroCusto, {
              codigoCentroCusto,
              nomeCentroCusto,
              caminhoes: []
            });
          }
          
          gruposPorCentroCusto.get(codigoCentroCusto)!.caminhoes.push({
            id: prog.id,
            frota: caminhao.frota,
            numero_frota: caminhao.numero_frota,
            placa: caminhao.placa || '',
            data_entrega: prog.data_entrega,
            status: prog.status || 'Ativa'
          });
        }
      });

      const resultado = Array.from(gruposPorCentroCusto.values()).map(grupo => ({
        ...grupo,
        totalCaminhoes: grupo.caminhoes.length
      }));

      console.log("🔍 Resultado agrupado por centro de custo:", { count: resultado.length, grupos: resultado });

      return resultado;
    }
  });

  return {
    kpisQuery,
    tipoVeiculoQuery,
    statusOperacionalQuery,
    idadeFrotaQuery,
    equipamentosPorCentroCustoQuery,
    centroCustoQuery,
    chamadosQuery,
    tipoFalhaQuery,
    custoLocacaoQuery,
    caminhoesProgramadosQuery
  };
};
