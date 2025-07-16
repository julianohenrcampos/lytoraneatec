import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AplicacaoData {
  id: string;
  data_aplicacao: string;
  logradouro_aplicado: string;
  estaca_inicial?: number;
  estaca_final?: number;
  bordo?: string;
  tonelada_aplicada?: number;
  comprimento?: number;
  largura_media?: number;
  espessura?: number;
  area_calculada?: number;
  lista_entrega_id?: {
    caminhao_id?: {
      frota?: string;
      numero_frota?: string;
      placa?: string;
    };
    equipe_id?: {
      nome_equipe: string;
      encarregado_id?: {
        nome_completo: string;
      };
    };
    apontador_id?: {
      nome_completo: string;
    };
  };
}

interface ResumoOperacional {
  obra: string;
  centro_custo: string;
  data: string;
  turno: string;
  total_massa_diaria: number;
  volume_total_diario: number;
  area_total_diaria: number;
  espessura_media_diaria: number;
  total_caminhoes_diarios: number;
}

interface RelatorioAplicacaoPDFLayoutProps {
  resumo: ResumoOperacional;
  aplicacoes: AplicacaoData[];
}

const RelatorioAplicacaoPDFLayout: React.FC<RelatorioAplicacaoPDFLayoutProps> = ({ resumo, aplicacoes }) => {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
      return dateString;
    }
  };

  const formatNumber = (num: number | null | undefined, decimals = 2) => {
    if (num === null || num === undefined) return '-';
    return num.toFixed(decimals);
  };

  const getVehicleLabel = (caminhao: any) => {
    if (!caminhao) return '-';
    const frota = caminhao.frota || '';
    const numero = caminhao.numero_frota || '';
    const placa = caminhao.placa || '';
    return `${frota}${numero} - ${placa}`.trim();
  };

  const getPrimeiroNome = (nomeCompleto: string) => {
    if (!nomeCompleto) return '-';
    return nomeCompleto.split(' ')[0];
  };

  return (
    <div className="bg-white text-black p-6 max-w-full font-sans">
      {/* Cabeçalho Institucional */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-800">
        <div className="flex-1">
          {/* Logo placeholder - substituir por logo real da Lytorânea */}
          <div className="w-20 h-20 bg-blue-600 rounded-lg mb-3 flex items-center justify-center text-white font-bold text-sm">
            LYTORÂNEA
          </div>
          <h1 className="text-xl font-bold text-gray-800 leading-tight mb-1">
            RESUMO DE APLICAÇÃO DIÁRIO
          </h1>
          <p className="text-base text-gray-700 font-medium">
            CONCRETO BETUMINOSO USINADO A QUENTE
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p className="font-semibold">Sistema LYTOTEC ERP</p>
          <p>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Informações Gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <div className="bg-gray-50 p-2 rounded">
          <span className="font-semibold text-gray-700">Obra:</span>
          <div className="text-gray-900">{resumo.obra}</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <span className="font-semibold text-gray-700">Centro de Custo:</span>
          <div className="text-gray-900">{resumo.centro_custo}</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <span className="font-semibold text-gray-700">Data:</span>
          <div className="text-gray-900">{formatDate(resumo.data)}</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <span className="font-semibold text-gray-700">Turno:</span>
          <div className="text-gray-900">{resumo.turno}</div>
        </div>
      </div>

      {/* 1. RESUMO OPERACIONAL */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-gray-800 mb-3 border-l-4 border-blue-600 pl-2">
          1. RESUMO OPERACIONAL
        </h2>
        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Total de Massa Diária Aplicada:</span>
              <span className="font-semibold text-gray-900">{formatNumber(resumo.total_massa_diaria)} t</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Volume Total Diário Aplicado:</span>
              <span className="font-semibold text-gray-900">{formatNumber(resumo.volume_total_diario)} m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Área Total Diária Pavimentada:</span>
              <span className="font-semibold text-gray-900">{formatNumber(resumo.area_total_diaria)} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Espessura Média Diária:</span>
              <span className="font-semibold text-gray-900">{formatNumber(resumo.espessura_media_diaria, 3)} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Total de Caminhões Diários:</span>
              <span className="font-semibold text-gray-900">{resumo.total_caminhoes_diarios}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. APLICAÇÃO POR LOGRADOURO */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-gray-800 mb-3 border-l-4 border-blue-600 pl-2">
          2. APLICAÇÃO POR LOGRADOURO
        </h2>
        <div className="overflow-x-auto border border-gray-300 rounded">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Data</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Logradouro</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Frota</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Est. Inicial</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Est. Final</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Bordo</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">(T)</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Comp.</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Larg. Média</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Espessura (m)</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Área (m²)</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Encarregado</th>
                <th className="border border-gray-300 p-2 text-xs font-semibold text-gray-800">Apontador</th>
              </tr>
            </thead>
            <tbody>
              {aplicacoes.map((aplicacao, index) => (
                <tr key={aplicacao.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {formatDate(aplicacao.data_aplicacao)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs">
                    {aplicacao.logradouro_aplicado || '-'}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {getVehicleLabel(aplicacao.lista_entrega_id?.caminhao_id)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {aplicacao.estaca_inicial ? `0+${formatNumber(aplicacao.estaca_inicial, 0).padStart(2, '0')}` : '-'}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {aplicacao.estaca_final ? `0+${formatNumber(aplicacao.estaca_final, 0).padStart(2, '0')}` : '-'}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {aplicacao.bordo || '-'}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center font-semibold bg-blue-50">
                    {formatNumber(aplicacao.tonelada_aplicada)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {formatNumber(aplicacao.comprimento)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {formatNumber(aplicacao.largura_media)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {formatNumber(aplicacao.espessura, 3)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center font-semibold bg-blue-50">
                    {formatNumber(aplicacao.area_calculada)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {getPrimeiroNome(aplicacao.lista_entrega_id?.equipe_id?.encarregado_id?.nome_completo)}
                  </td>
                  <td className="border border-gray-300 p-1 text-xs text-center">
                    {getPrimeiroNome(aplicacao.lista_entrega_id?.apontador_id?.nome_completo)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Linha de totais */}
            <tfoot>
              <tr className="bg-blue-100 font-semibold">
                <td colSpan={6} className="border border-gray-300 p-2 text-xs text-right">
                  TOTAIS:
                </td>
                <td className="border border-gray-300 p-2 text-xs text-center bg-blue-200">
                  {aplicacoes.reduce((sum, app) => sum + (app.tonelada_aplicada || 0), 0).toFixed(2)}
                </td>
                <td className="border border-gray-300 p-2 text-xs text-center">-</td>
                <td className="border border-gray-300 p-2 text-xs text-center">-</td>
                <td className="border border-gray-300 p-2 text-xs text-center">-</td>
                <td className="border border-gray-300 p-2 text-xs text-center bg-blue-200">
                  {aplicacoes.reduce((sum, app) => sum + (app.area_calculada || 0), 0).toFixed(2)}
                </td>
                <td colSpan={2} className="border border-gray-300 p-2 text-xs text-center">
                  {aplicacoes.length} registros
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-6 pt-4 border-t border-gray-300 text-center">
        <div className="text-xs text-gray-600">
          <p className="font-semibold">LYTORÂNEA CONSTRUÇÕES LTDA</p>
          <p>Sistema LYTOTEC ERP - Relatório gerado automaticamente</p>
        </div>
      </div>
    </div>
  );
};

export default RelatorioAplicacaoPDFLayout;