// Tradução de tipo_evento → label humano
const MAP: Record<string, string> = {
  cpf_alterado: "CPF alterado",
  biometria_cadastrada: "Biometria cadastrada",
  biometria_substituida: "Biometria substituída",
  biometria_removida: "Biometria removida",
  assinatura_cadastrada: "Assinatura cadastrada",
  assinatura_substituida: "Assinatura substituída",
  assinatura_removida: "Assinatura removida",
  login_falha: "Falha de login",
  login_sucesso: "Login realizado",
  logout: "Logout",
  rate_limit_exceeded: "Limite de requisições excedido",
};

export function traduzirEvento(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  if (MAP[tipo]) return MAP[tipo];

  // padrão "tabela.OPERACAO" (ex.: bd_funcionarios.UPDATE)
  if (tipo.includes(".")) {
    const [tabela, op] = tipo.split(".");
    const opLabel: Record<string, string> = {
      INSERT: "criado",
      UPDATE: "atualizado",
      DELETE: "removido",
      SELECT: "consultado",
    };
    const tabelaLimpa = tabela.replace(/^bd_/, "").replace(/_/g, " ");
    return `${capitalize(tabelaLimpa)} ${opLabel[op] ?? op.toLowerCase()}`;
  }

  return capitalize(tipo.replace(/_/g, " "));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const CATEGORIA_LABEL: Record<string, string> = {
  biometria: "Biometria",
  assinatura: "Assinatura",
  cpf: "Alterações críticas",
  seguranca: "Acessos e segurança",
  ponto: "Ponto eletrônico",
  dados: "Operações no sistema",
};

export function categoriaLabel(cat: string): string {
  return CATEGORIA_LABEL[cat] ?? cat;
}
