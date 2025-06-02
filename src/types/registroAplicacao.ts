
import { ListaProgramacaoEntrega } from "./programacaoEntrega";
import { RegistroCarga } from "./registroCargas";

export interface RegistroAplicacao {
  id: string;
  lista_entrega_id: string;
  registro_carga_id: string;
  logradouro_id?: string | null;
  logradouro_aplicado?: string | null;
  data_aplicacao: string;
  hora_chegada_local: string;
  temperatura_chegada?: number | null;
  hora_aplicacao?: string | null;
  temperatura_aplicacao?: number | null;
  bordo?: BordoType | null;
  estaca_inicial?: number | null;
  comprimento?: number | null;
  largura_media?: number | null;
  area?: number | null;
  area_calculada?: number | null;
  tonelada_aplicada?: number | null;
  espessura?: number | null;
  espessura_calculada?: number | null;
  hora_saida_caminhao?: string | null;
  estaca_final?: number | null;
  anotacoes_apontador?: string | null;
  usar_massa_total_para_espessura?: boolean | null;
  // Novos campos para múltiplas aplicações
  aplicacao_sequencia?: number | null;
  media_espessura_cm?: number | null;
  carga_finalizada?: boolean | null;
  massa_remanescente_antes_aplicacao?: number | null;
  carga_origem_id?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  
  // Relations
  lista_entrega?: ListaProgramacaoEntrega;
  registro_carga?: RegistroCarga & {
    caminhao?: {
      id: string;
      placa: string;
      modelo: string;
    }
  };
}

export interface RegistroAplicacaoFormValues {
  lista_entrega_id: string;
  registro_carga_id: string;
  logradouro_id?: string;
  logradouro_aplicado?: string;
  data_aplicacao: string;
  hora_chegada_local: string;
  temperatura_chegada?: number | null;
  hora_aplicacao?: string | null;
  temperatura_aplicacao?: number | null;
  bordo?: BordoType | null;
  estaca_inicial?: number | null;
  comprimento?: number | null;
  largura_media?: number | null;
  area_calculada?: number | null;
  tonelada_aplicada?: number | null;
  espessura?: number | null;
  espessura_calculada?: number | null;
  hora_saida_caminhao?: string | null;
  estaca_final?: number | null;
  anotacoes_apontador?: string | null;
  usar_massa_total_para_espessura?: boolean | null;
  // Novos campos para múltiplas aplicações
  aplicacao_sequencia?: number | null;
  media_espessura_cm?: number | null;
  carga_finalizada?: boolean | null;
  massa_remanescente_antes_aplicacao?: number | null;
  carga_origem_id?: string | null;
}

export interface RegistroAplicacaoFilters {
  centro_custo_id?: string;
  caminhao_id?: string;
  data_inicio?: Date;
}

export type BordoType = "Direito" | "Esquerdo" | "Centro" | "Único" | "Embocadura";
