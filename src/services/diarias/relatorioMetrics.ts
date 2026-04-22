import type { RelatorioFolhaItem } from '@/types/diarias';

export interface RelatorioConferenciaItem {
  chave: string;
  label: string;
  totalRegistros: number;
  totalConfirmados: number;
}

export interface RelatorioConferenciaResumo {
  totalRegistros: number;
  totalConfirmados: number;
  porEmpresa: RelatorioConferenciaItem[];
  porVinculo: RelatorioConferenciaItem[];
  porSolicitacao: RelatorioConferenciaItem[];
}

export function isRelatorioItemConfirmado(item: RelatorioFolhaItem): boolean {
  return String(item.presenca_status) === 'true' && !!item.hora_entrada && !!item.hora_saida;
}

export function isRelatorioItemRemessa(item: RelatorioFolhaItem): boolean {
  return !!item.matricula_funcionario && item.matricula_funcionario !== '---' && String(item.matricula_funcionario).trim() !== '';
}

function ordenarResumo(items: RelatorioConferenciaItem[]): RelatorioConferenciaItem[] {
  return items.sort((a, b) => {
    if (b.totalConfirmados !== a.totalConfirmados) {
      return b.totalConfirmados - a.totalConfirmados;
    }
    return a.label.localeCompare(b.label);
  });
}

function agruparResumo(
  relatorio: RelatorioFolhaItem[],
  resolver: (item: RelatorioFolhaItem) => { chave: string; label: string },
): RelatorioConferenciaItem[] {
  const mapa = new Map<string, RelatorioConferenciaItem>();

  relatorio.forEach((item) => {
    const { chave, label } = resolver(item);
    const atual = mapa.get(chave) || { chave, label, totalRegistros: 0, totalConfirmados: 0 };
    atual.totalRegistros += 1;
    if (isRelatorioItemConfirmado(item)) {
      atual.totalConfirmados += 1;
    }
    mapa.set(chave, atual);
  });

  return ordenarResumo(Array.from(mapa.values()));
}

export function buildRelatorioConferenciaResumo(relatorio: RelatorioFolhaItem[]): RelatorioConferenciaResumo {
  return {
    totalRegistros: relatorio.length,
    totalConfirmados: relatorio.filter(isRelatorioItemConfirmado).length,
    porEmpresa: agruparResumo(relatorio, (item) => {
      const empresaId = item.empresa_id || 'sem-empresa';
      const empresaNome = item.empresa_funcionario || 'Empresa não informada';
      return { chave: empresaId, label: empresaNome };
    }),
    porVinculo: agruparResumo(relatorio, (item) => {
      const remessa = isRelatorioItemRemessa(item);
      return {
        chave: remessa ? 'remessa' : 'sem_remessa',
        label: remessa ? 'Remessa' : 'Sem remessa',
      };
    }),
    porSolicitacao: agruparResumo(relatorio, (item) => ({
      chave: item.solicitacao_id || item.numero_solicitacao || 'sem-solicitacao',
      label: item.numero_solicitacao || 'Solicitação não informada',
    })),
  };
}