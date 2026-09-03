/**
 * Opção do combobox "Rua / Logradouro" na aba Relatório AP's.
 *
 * `chave` é a identidade estável (usada como value do combobox e como filtro
 * de detalhes). `nome` é o label combinado "Mapa / Local". `searchText`
 * concatena mapa + local sem acentos para busca com/sem acento.
 */
export interface RuaOption {
  chave: string;
  nome: string;
  searchText: string;
  logradouroMapa: string;
  logradouroLocal: string;
}
