import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIA_IDS } from "@/constants/categorias";
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
  AtivoBasico,
  DistribuicaoCentroCusto
} from "@/types/maquinas";

export const useMaquinasDashboard = (filters: MaquinasFilters) => {
  // 1. KPIs Principais
  const kpisQuery = useQuery<MaquinasKpis>({
    queryKey: ["maquinas-kpis", filters],
    queryFn: async () => {
      let ativosQuery = supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, situacao");

      if (filters.tipoVeiculo && filters.tipoVeiculo.length > 0) {
        ativosQuery = ativosQuery.in("categoria_ativo_id", filters.tipoVeiculo);
      }

      if (filters.empresaId) {
        ativosQuery = ativosQuery.eq("empresa_id", filters.empresaId);
      }

      const { data: ativos } = await ativosQuery;
      const totalAtivos = ativos?.length || 0;

      const hoje = new Date().toISOString().split('T')[0];
      const { data: apontamentosHoje } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select("caminhao_equipamento_id, situacao")
        .eq("data", hoje)
        .eq("situacao", "Operando");

      const equipamentosOperandoHoje = new Set(
        apontamentosHoje?.map(apt => apt.caminhao_equipamento_id) || []
      );

      let ativosOperando = 0;
      let ativosManutencao = 0;
      let ativosDisponiveis = 0;

      ativos?.forEach(ativo => {
        if (equipamentosOperandoHoje.has(ativo.id)) {
          ativosOperando++;
        } else if (ativo.situacao === 'Em Manutenção') {
          ativosManutencao++;
        } else {
          ativosDisponiveis++;
        }
      });

      const { count: chamadosAbertos } = await supabase
        .from("bd_chamados_os")
        .select("*", { count: "exact", head: true })
        .eq("status", "Aberto");

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
          return (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
        });
        tempoMedioReparo = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      }

      return {
        totalAtivos,
        ativosOperando,
        ativosDisponiveis,
        ativosManutencao,
        chamadosAbertos: chamadosAbertos || 0,
        tempoMedioReparo: Math.round(tempoMedioReparo * 10) / 10
      };
    }
  });

  // 2. Distribuição por Categoria
  const tipoVeiculoQuery = useQuery<TipoVeiculoDistribution[]>({
    queryKey: ["maquinas-tipo-veiculo", filters],
    queryFn: async () => {
      let query = supabase
        .from("bd_caminhoes_equipamentos")
        .select(`
          capacidade, aluguel, categoria_ativo_id,
          categoria:bd_categorias_ativos(nome_categoria)
        `);

      if (filters.empresaId) {
        query = query.eq("empresa_id", filters.empresaId);
      }

      const { data: ativos } = await query;

      const distribuicao = new Map<string, {
        quantidade: number;
        capacidadeTotal: number;
        valorLocacaoTotal: number;
      }>();

      ativos?.forEach((ativo: any) => {
        const tipo = ativo.categoria?.nome_categoria || "Não informado";
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

  // 3. Status Operacional
  const statusOperacionalQuery = useQuery<StatusOperacionalData[]>({
    queryKey: ["maquinas-status", filters],
    queryFn: async () => {
      let ativosQuery = supabase
        .from("bd_caminhoes_equipamentos")
        .select(`
          id, frota, numero_frota, situacao, categoria_ativo_id,
          categoria:bd_categorias_ativos(nome_categoria),
          subcategoria:bd_subcategorias_ativos(nome_subcategoria)
        `);

      if (filters.tipoVeiculo && filters.tipoVeiculo.length > 0) {
        ativosQuery = ativosQuery.in("categoria_ativo_id", filters.tipoVeiculo);
      }

      if (filters.empresaId) {
        ativosQuery = ativosQuery.eq("empresa_id", filters.empresaId);
      }

      const { data: ativos } = await ativosQuery;

      const hoje = new Date().toISOString().split('T')[0];
      const { data: apontamentosHoje } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select("caminhao_equipamento_id, situacao")
        .eq("data", hoje)
        .eq("situacao", "Operando");

      const equipamentosOperandoHoje = new Set(
        apontamentosHoje?.map(apt => apt.caminhao_equipamento_id) || []
      );

      const statusMap = new Map<string, Array<{
        id: string;
        frota: string;
        numero_frota: string;
        nome_categoria: string;
        nome_subcategoria?: string;
      }>>();

      ativos?.forEach((ativo: any) => {
        let statusFinal: string;

        if (equipamentosOperandoHoje.has(ativo.id)) {
          statusFinal = 'Operando';
        } else if (ativo.situacao === 'Em Manutenção') {
          statusFinal = 'Em Manutenção';
        } else {
          statusFinal = 'Disponível';
        }

        if (!statusMap.has(statusFinal)) {
          statusMap.set(statusFinal, []);
        }

        statusMap.get(statusFinal)!.push({
          id: ativo.id,
          frota: ativo.frota || '',
          numero_frota: ativo.numero_frota || '',
          nome_categoria: ativo.categoria?.nome_categoria || '',
          nome_subcategoria: ativo.subcategoria?.nome_subcategoria
        });
      });

      return Array.from(statusMap.entries()).map(([status, ativos]) => ({
        status,
        quantidade: ativos.length,
        ativos
      }));
    }
  });

  // 4. Idade da Frota
  const idadeFrotaQuery = useQuery<IdadeFrotaData[]>({
    queryKey: ["maquinas-idade", filters],
    queryFn: async () => {
      let query = supabase
        .from("bd_caminhoes_equipamentos")
        .select(`
          id, frota, numero_frota, ano_fabricacao, categoria_ativo_id,
          categoria:bd_categorias_ativos(nome_categoria),
          subcategoria:bd_subcategorias_ativos(nome_subcategoria)
        `);

      if (filters.empresaId) {
        query = query.eq("empresa_id", filters.empresaId);
      }

      const { data: ativos } = await query;
      const anoAtual = new Date().getFullYear();

      const faixas = new Map<string, Array<{
        id: string;
        frota: string;
        numero_frota: string;
        nome_categoria: string;
        ano_fabricacao: string;
        nome_subcategoria?: string;
      }>>();
      
      ativos?.forEach((ativo: any) => {
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
          nome_categoria: ativo.categoria?.nome_categoria || '',
          ano_fabricacao: ativo.ano_fabricacao || '',
          nome_subcategoria: ativo.subcategoria?.nome_subcategoria
        });
      });

      return Array.from(faixas.entries()).map(([faixaIdade, ativos]) => ({
        faixaIdade,
        quantidade: ativos.length,
        ativos
      }));
    }
  });

  // 5. Equipamentos por Centro de Custo
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
          bd_caminhoes_equipamentos(id, frota, numero_frota, categoria_ativo_id),
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
        
        const isCaminhao = caminhao?.categoria_ativo_id === CATEGORIA_IDS.CAMINHAO;
        
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

  // 6. Utilização por Centro de Custo
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

  // 8. Manutenções por Tipo de Falha
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
        custoEstimado: quantidade * 1500,
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

      const totalDescontos = diasManutencao * 500;
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

  // 10. Caminhões Programados para Entrega
  const caminhoesProgramadosQuery = useQuery<CaminhoesPorCentroCusto[]>({
    queryKey: ["caminhoes-programados", filters],
    queryFn: async () => {
      let dataInicio: string;
      let dataFim: string;

      if (filters.dataInicioPlanejamanento && filters.dataFimPlanejamento) {
        dataInicio = filters.dataInicioPlanejamanento;
        dataFim = filters.dataFimPlanejamento;
      } else {
        const hoje = new Date();
        dataInicio = hoje.toISOString().split('T')[0];
        const proximos7dias = new Date(hoje);
        proximos7dias.setDate(hoje.getDate() + 7);
        dataFim = proximos7dias.toISOString().split('T')[0];
      }

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

      if (error) {
        console.error("Erro na query de caminhões programados:", error);
        return [];
      }

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

      return Array.from(gruposPorCentroCusto.values()).map(grupo => ({
        ...grupo,
        totalCaminhoes: grupo.caminhoes.length
      }));
    }
  });

  // 11. Distribuição Real da Frota por Centro de Custo
  const distribuicaoCentroCustoQuery = useQuery<DistribuicaoCentroCusto[]>({
    queryKey: ["distribuicao-centro-custo", filters],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];

      let veiculosQuery = supabase
        .from("bd_caminhoes_equipamentos")
        .select(`
          id, frota, numero_frota, categoria_ativo_id,
          categoria:bd_categorias_ativos(nome_categoria)
        `);

      if (filters.tipoVeiculo && filters.tipoVeiculo.length > 0) {
        veiculosQuery = veiculosQuery.in("categoria_ativo_id", filters.tipoVeiculo);
      }

      if (filters.empresaId) {
        veiculosQuery = veiculosQuery.eq("empresa_id", filters.empresaId);
      }

      const { data: veiculos } = await veiculosQuery;

      if (!veiculos || veiculos.length === 0) {
        return [];
      }

      const { data: apontamentosHoje } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          caminhao_equipamento_id,
          centro_custo_id,
          bd_centros_custo(codigo_centro_custo, nome_centro_custo)
        `)
        .eq("data", hoje);

      const veiculoCentroCusto = new Map<string, {
        codigo: string;
        nomeCompleto: string;
      }>();

      apontamentosHoje?.forEach(apontamento => {
        const centro = apontamento.bd_centros_custo as any;
        if (centro && !Array.isArray(centro)) {
          veiculoCentroCusto.set(apontamento.caminhao_equipamento_id, {
            codigo: centro.codigo_centro_custo || "Não Informado",
            nomeCompleto: centro.nome_centro_custo || centro.codigo_centro_custo || "Não Informado"
          });
        }
      });

      const centroMap = new Map<string, {
        nomeCompleto: string;
        veiculos: Array<{
          id: string;
          frota: string;
          numero_frota: string;
          nome_categoria: string;
        }>;
      }>();

      veiculos.forEach((veiculo: any) => {
        const centroCustoInfo = veiculoCentroCusto.get(veiculo.id);
        
        let centroCusto = "Não Alocado Hoje";
        let nomeCompleto = "Veículos Não Alocados Hoje";

        if (centroCustoInfo) {
          centroCusto = centroCustoInfo.codigo;
          nomeCompleto = centroCustoInfo.nomeCompleto;
        }

        if (!centroMap.has(centroCusto)) {
          centroMap.set(centroCusto, {
            nomeCompleto,
            veiculos: []
          });
        }

        centroMap.get(centroCusto)!.veiculos.push({
          id: veiculo.id,
          frota: veiculo.frota || '',
          numero_frota: veiculo.numero_frota || '',
          nome_categoria: veiculo.categoria?.nome_categoria || ''
        });
      });

      const totalVeiculos = veiculos.length;
      return Array.from(centroMap.entries()).map(([centroCusto, data]) => ({
        centroCusto,
        nomeCompleto: data.nomeCompleto,
        quantidade: data.veiculos.length,
        percentual: totalVeiculos > 0 ? (data.veiculos.length / totalVeiculos) * 100 : 0,
        veiculos: data.veiculos
      })).sort((a, b) => b.quantidade - a.quantidade);
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
    caminhoesProgramadosQuery,
    distribuicaoCentroCustoQuery
  };
};
