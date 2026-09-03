/**
 * Falhas de transporte no salvamento do checklist SSO.
 *
 * O técnico de segurança preenche o checklist em obra, com 4G instável.
 * Quando o sinal oscila, a requisição morre antes de qualquer resposta HTTP
 * e o navegador lança um TypeError: "Failed to fetch" no Chrome,
 * "NetworkError..." no Firefox, "Load failed" no Safari.
 *
 * Erro de negócio (RLS, constraint, validação) NÃO entra aqui: repetir uma
 * requisição que o servidor recusou legitimamente não resolve e ainda
 * esconde a causa real.
 */

const MENSAGENS_DE_REDE = [
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'err_internet_disconnected',
  'err_network_changed',
  'the network connection was lost',
];

export const isErroDeRede = (error: unknown): boolean => {
  if (error instanceof TypeError) return true;

  const mensagem = (error as { message?: unknown } | null)?.message;
  if (typeof mensagem !== 'string') return false;

  const normalizada = mensagem.toLowerCase();
  return MENSAGENS_DE_REDE.some((trecho) => normalizada.includes(trecho));
};

/** Violação de chave primária — a gravação anterior chegou ao banco. */
export const isChaveDuplicada = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === '23505';

export const MENSAGEM_SEM_CONEXAO =
  'Sem conexão estável. Nada foi perdido — confira o sinal e toque em Salvar novamente.';

/**
 * Repete `fn` somente em falha de rede, com espera progressiva.
 *
 * IMPORTANTE: use apenas com operações idempotentes. No checklist a
 * idempotência vem de gerar o UUID no cliente — se a gravação anterior
 * tiver chegado ao banco, a repetição volta com 23505 e o chamador
 * trata isso como sucesso em vez de duplicar o registro.
 */
export const comRetryDeRede = async <T>(
  fn: () => Promise<T>,
  rotulo: string,
  maxTentativas = 3,
): Promise<T> => {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await fn();
    } catch (error) {
      if (!isErroDeRede(error) || tentativa === maxTentativas) throw error;

      console.warn(`🔄 ${rotulo}: falha de rede (${tentativa}/${maxTentativas})`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * tentativa));
    }
  }

  // Inalcançável: o laço sempre retorna ou relança na última tentativa.
  throw new Error(`${rotulo}: falha inesperada no controle de tentativas`);
};
