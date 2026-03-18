import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OrdemServico } from "@/types/ordemServico";

export interface OsHeaderData {
  osNumero?: string;
  osStatus?: string;
  dataAbertura?: string; // ISO date
  chamadoNumero?: string;
  dataSolicitacao?: string; // ISO date
  horaSolicitacao?: string; // HH:mm:ss
  prioridade?: string | null;
  tipoFalha?: string | null;
  descricaoProblema?: string | null;
  solicitanteNome?: string | null;
  solicitanteEmail?: string | null;
  solicitanteTelefone?: string | null;
  equipamentoTipo?: string | null;
  equipamentoPlaca?: string | null;
  equipamentoFrota?: string | null;
  equipamentoMarcaModelo?: string | null;
  centroCustoCodigo?: string | null;
  centroCustoNome?: string | null;
  centroCustoLabel?: string | null; // codigo - nome
  horimetroInicial?: string | null;
}

export const useOsHeaderData = (currentOs: OrdemServico | null, chamadoId?: string) => {
  const [data, setData] = useState<OsHeaderData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const caminhaoId = useMemo(
    () => currentOs?.caminhao_equipamento_id || null,
    [currentOs?.caminhao_equipamento_id]
  );

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      // Se não há OS atual nem chamadoId, não buscar dados
      if (!currentOs && !chamadoId) return;
      setLoading(true);
      setError(null);

      const targetChamadoId = currentOs?.chamado_id || chamadoId;
      console.log("🔍 DEBUG - useOsHeaderData: Iniciando fetch para OS:", currentOs?.numero_os || `Chamado ID: ${chamadoId}`);

      try {
        const header: OsHeaderData = {};
        
        // Se há OS atual, usar dados da OS
        if (currentOs) {
          header.osNumero = currentOs.numero_os;
          header.osStatus = currentOs.status;
          header.dataAbertura = currentOs.data_abertura;
        }

        // 1) Buscar chamado (se houver ID do chamado)
        let chamado: any = null;
        if (targetChamadoId) {
          const { data: chamadoData, error: chamadoErr } = await supabase
            .from("bd_chamados_os")
            .select(
              "id, numero_chamado, prioridade, descricao_problema, tipo_falha, data_solicitacao, hora_solicitacao, solicitante_id, centro_custo_id, caminhao_equipamento_id"
            )
            .eq("id", targetChamadoId)
            .maybeSingle();
          if (chamadoErr) throw chamadoErr;
          chamado = chamadoData;

          if (chamado) {
            header.chamadoNumero = chamado.numero_chamado;
            header.prioridade = chamado.prioridade;
            header.tipoFalha = chamado.tipo_falha;
            header.descricaoProblema = chamado.descricao_problema;
            header.dataSolicitacao = chamado.data_solicitacao;
            header.horaSolicitacao = chamado.hora_solicitacao;
            
            // Se não temos número da OS mas temos número do chamado, usar como fallback
            if (!header.osNumero && chamado.numero_chamado) {
              header.osNumero = chamado.numero_chamado;
            }
          }
        }

        // 2) Buscar solicitante (profiles primeiro; fallback funcionarios)
        const solicitanteId: string | null = chamado?.solicitante_id || null;
        if (solicitanteId) {
          const { data: profile, error: profErr } = await supabase
            .from("profiles")
            .select("id, nome_completo, email")
            .eq("id", solicitanteId)
            .maybeSingle();
          if (profErr) throw profErr;
          if (profile) {
            header.solicitanteNome = profile.nome_completo;
            header.solicitanteEmail = profile.email;
          } else {
            const { data: func, error: funcErr } = await supabase
              .from("bd_funcionarios")
              .select("id, nome_completo, email")
              .eq("id", solicitanteId)
              .maybeSingle();
            if (funcErr) throw funcErr;
            if (func) {
              header.solicitanteNome = func.nome_completo;
              header.solicitanteEmail = func.email;
            }
          }
        }

        // 3) Buscar centro de custo
        const centroCustoId: string | null = chamado?.centro_custo_id || null;
        if (centroCustoId) {
          const { data: cc, error: ccErr } = await supabase
            .from("bd_centros_custo")
            .select("codigo_centro_custo, nome_centro_custo")
            .eq("id", centroCustoId)
            .maybeSingle();
          if (ccErr) throw ccErr;
          if (cc) {
            header.centroCustoCodigo = cc.codigo_centro_custo;
            header.centroCustoNome = cc.nome_centro_custo;
            header.centroCustoLabel = `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`;
          }
        }

        // 4) Buscar info do equipamento
        const equipamentoId: string | null =
          currentOs?.caminhao_equipamento_id || chamado?.caminhao_equipamento_id || null;
        if (equipamentoId) {
          const { data: veic, error: veicErr } = await supabase
            .from("bd_caminhoes_equipamentos")
            .select(`placa, fabricante, numero_frota,
              categoria:bd_categorias_ativos(nome_categoria),
              subcategoria:bd_subcategorias_ativos(nome_subcategoria)
            `)
            .eq("id", equipamentoId)
            .maybeSingle();
          if (veicErr) throw veicErr;
          if (veic) {
            const cat = (veic.categoria as any)?.nome_categoria;
            const subcat = (veic.subcategoria as any)?.nome_subcategoria;
            header.equipamentoTipo = subcat || cat;
            header.equipamentoPlaca = veic.placa;
            header.equipamentoFrota = veic.numero_frota;
            header.equipamentoMarcaModelo = [veic.fabricante, subcat].filter(Boolean).join(" ") || null;
          }
        }

        // 5) Buscar último horímetro/odômetro (horimetro_final) do apontamento
        if (equipamentoId) {
          const { data: apont, error: apErr } = await supabase
            .from("bd_registro_apontamento_cam_equipa")
            .select("horimetro_final, data, hora_final, created_at")
            .eq("caminhao_equipamento_id", equipamentoId)
            .not("horimetro_final", "is", null)
            .order("data", { ascending: false })
            .order("hora_final", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1);
          if (apErr) throw apErr;
          if (apont && apont.length > 0) {
            header.horimetroInicial = String(apont[0].horimetro_final);
          }
        }

        console.log("✅ DEBUG - Header data completo:", header);
        if (isMounted) setData(header);
      } catch (err: any) {
        console.error("❌ DEBUG - Erro ao carregar header:", err);
        if (isMounted) setError(err.message || "Erro ao carregar cabeçalho da OS");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      isMounted = false;
    };
  }, [currentOs?.id, currentOs?.chamado_id, chamadoId, caminhaoId]);

  return { header: data, isLoading: loading, error };
};
