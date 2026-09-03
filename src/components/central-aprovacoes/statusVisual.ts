/**
 * Mapeamento visual por status_fluxo para itens da Central de Aprovações.
 * Pendente → laranja, Aprovado → verde, Negado/Cancelado → vermelho.
 */
export interface StatusVisual {
  border: string;         // classe border-l-<cor>
  bg: string;             // classe de fundo suave para o card
  badgeClass: string;     // classes para <Badge> de status
}

export function statusVisual(codigo: string | null | undefined): StatusVisual {
  switch (codigo) {
    case 'APROVADO':
    case 'aprovado':
    case 'aprovada':
      return {
        border: 'border-l-green-500',
        bg: 'bg-green-50/60 dark:bg-green-950/20',
        badgeClass: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-100',
      };
    case 'NEGADO':
    case 'negado':
    case 'negada':
    case 'reprovado':
    case 'reprovada':
      return {
        border: 'border-l-red-500',
        bg: 'bg-red-50/60 dark:bg-red-950/20',
        badgeClass: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-100',
      };
    case 'CANCELADO':
    case 'cancelado':
    case 'cancelada':
      return {
        border: 'border-l-red-500',
        bg: 'bg-muted/40',
        badgeClass: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-100',
      };
    case 'EM_TRANSPORTE':
      return {
        border: 'border-l-blue-500',
        bg: 'bg-blue-50/60 dark:bg-blue-950/20',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100',
      };
    case 'PENDENTE_APROVACAO':
    case 'aguardando_aprovacao_gerenteadm':
    case 'aguardando_aprovacao_diretor_operacional':
    case 'aguardando_aprovacao_diretor_adm':
    default:
      return {
        border: 'border-l-amber-500',
        bg: 'bg-amber-50/60 dark:bg-amber-950/20',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100',
      };
  }
}
