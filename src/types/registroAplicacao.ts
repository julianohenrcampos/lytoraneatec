
import { ListaProgramacaoEntrega } from "./programacaoEntrega";
import { RegistroCarga } from "./registroCargas";

export interface RegistroAplicacao {
  id: string;
  lista_entrega_id: string;
  registro_carga_id: string;
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
  espessura?: number | null;
  hora_saida_caminhao?: string | null;
  estaca_final?: number | null;
  anotacoes_apontador?: string | null;
  created_at?: string;
  updated_at?: string;
  
  // Relations
  lista_entrega?: ListaProgramacaoEntrega;
  registro_carga?: RegistroCarga;
}

export interface RegistroAplicacaoFormValues {
  lista_entrega_id: string;
  registro_carga_id: string;
  data_aplicacao: string;
  hora_chegada_local: string;
  temperatura_chegada?: number | null;
  hora_aplicacao?: string | null;
  temperatura_aplicacao?: number | null;
  bordo?: BordoType | null;
  estaca_inicial?: number | null;
  comprimento?: number | null;
  largura_media?: number | null;
  hora_saida_caminhao?: string | null;
  estaca_final?: number | null;
  anotacoes_apontador?: string | null;
}

export interface RegistroAplicacaoFilters {
  centro_custo_id?: string;
  caminhao_id?: string;
  data_inicio?: Date;
}

export type BordoType = "Direito" | "Esquerdo" | "Centro";
