/**
 * Contratos tipados de detalhe do Relatório AP's.
 *
 * `DetalheAps` = linha crua vinda de `bd_registro_aplicacao_detalhes`, com
 * apenas as colunas efetivamente lidas pelo relatório.
 *
 * `DetalheApsEnriquecido` = mesma linha, imutável em `logradouro_nome`, com
 * campos adicionais derivados da junção com `bd_registro_aplicacao_ruas`:
 *   - `ruaAplicacaoId`     : FK original (ou null para detalhes legados)
 *   - `logradouroMapa`     : nome geográfico (mapa)
 *   - `logradouroLocal`    : nome atual/local declarado manualmente
 *   - `logradouroExibicao` : "Mapa / Local" pronto para exibição
 *   - `chaveRelatorioRua`  : chave estável para filtro/agrupamento
 *
 * `logradouro_nome` NUNCA é sobrescrito — continua significando apenas o
 * nome geográfico original conforme gravado no banco.
 */

export interface DetalheAps {
  id: string;
  registro_aplicacao_id: string;
  rua_aplicacao_id: string | null;
  sequencia_aplicacao: number | null;
  logradouro_nome: string | null;
  data_aplicacao: string | null;
  latitude: number | null;
  longitude: number | null;
  fotos_aplicacao: string[] | null;
  /** Demais colunas cruas — não tipadas aqui, mas preservadas via spread. */
  [chaveExtra: string]: unknown;
}

export interface DetalheApsEnriquecido extends DetalheAps {
  ruaAplicacaoId: string | null;
  logradouroMapa: string;
  logradouroLocal: string;
  logradouroExibicao: string;
  chaveRelatorioRua: string;
}
