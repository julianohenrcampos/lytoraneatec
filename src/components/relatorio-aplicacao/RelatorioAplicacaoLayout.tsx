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

interface RelatorioAplicacaoLayoutProps {
  resumo: ResumoOperacional;
  aplicacoes: AplicacaoData[];
}

const RelatorioAplicacaoLayout: React.FC<RelatorioAplicacaoLayoutProps> = ({ resumo, aplicacoes }) => {
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
    <div className="w-full bg-white text-black p-8 font-sans">
      {/* Cabeçalho Unificado */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-800">
        <div className="flex-1">
          <div className="w-20 h-20 bg-blue-600 rounded-lg mb-3 flex items-center justify-center text-white font-bold text-sm">
            LYTORÂNEA
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            RESUMO DE APLICAÇÃO DIÁRIO
          </h1>
          <p className="text-lg text-gray-700 font-medium">
            CONCRETO BETUMINOSO USINADO A QUENTE
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p className="font-semibold text-gray-800">Sistema LYTOTEC ERP</p>
          <p>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Informações Básicas em Linha */}
      <div className="mb-6 text-sm">
        <p className="mb-2">
          <span className="font-semibold">Obra:</span> {resumo.obra} | 
          <span className="font-semibold ml-4">Centro de Custo:</span> {resumo.centro_custo} | 
          <span className="font-semibold ml-4">Data:</span> {formatDate(resumo.data)} | 
          <span className="font-semibold ml-4">Turno:</span> {resumo.turno}
        </p>
      </div>

      {/* 1. RESUMO OPERACIONAL */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3 border-l-4 border-blue-600 pl-3">
          1. RESUMO OPERACIONAL
        </h2>
        <div className="text-sm space-y-2">
          <p><span className="font-medium">Total de Massa Diária Aplicada:</span> <span className="font-bold">{formatNumber(resumo.total_massa_diaria)} t</span></p>
          <p><span className="font-medium">Volume Total Diário Aplicado:</span> <span className="font-bold">{formatNumber(resumo.volume_total_diario)} m³</span></p>
          <p><span className="font-medium">Área Total Diária Pavimentada:</span> <span className="font-bold">{formatNumber(resumo.area_total_diaria)} m²</span></p>
          <p><span className="font-medium">Espessura Média Diária:</span> <span className="font-bold">{formatNumber(resumo.espessura_media_diaria, 3)} m</span></p>
          <p><span className="font-medium">Total de Caminhões Diários:</span> <span className="font-bold">{resumo.total_caminhoes_diarios}</span></p>
        </div>
      </div>

      {/* 2. APLICAÇÃO POR LOGRADOURO */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3 border-l-4 border-blue-600 pl-3">
          2. APLICAÇÃO POR LOGRADOURO
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-800 p-2 text-xs font-bold">Data</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Logradouro</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Frota</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Est. Inicial</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Est. Final</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Bordo</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">(T)</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Comp.</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Larg. Média</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Espessura (m)</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Área (m²)</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Encarregado</th>
                <th className="border border-gray-800 p-2 text-xs font-bold">Apontador</th>
              </tr>
            </thead>
            <tbody>
              {aplicacoes.map((aplicacao, index) => (
                <tr key={aplicacao.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {formatDate(aplicacao.data_aplicacao)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs">
                    {aplicacao.logradouro_aplicado || '-'}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {getVehicleLabel(aplicacao.lista_entrega_id?.caminhao_id)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {aplicacao.estaca_inicial ? `0+${formatNumber(aplicacao.estaca_inicial, 0).padStart(2, '0')}` : '-'}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {aplicacao.estaca_final ? `0+${formatNumber(aplicacao.estaca_final, 0).padStart(2, '0')}` : '-'}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {aplicacao.bordo || '-'}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center font-bold">
                    {formatNumber(aplicacao.tonelada_aplicada)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {formatNumber(aplicacao.comprimento)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {formatNumber(aplicacao.largura_media)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {formatNumber(aplicacao.espessura, 3)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center font-bold">
                    {formatNumber(aplicacao.area_calculada)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {getPrimeiroNome(aplicacao.lista_entrega_id?.equipe_id?.encarregado_id?.nome_completo)}
                  </td>
                  <td className="border border-gray-800 p-1 text-xs text-center">
                    {getPrimeiroNome(aplicacao.lista_entrega_id?.apontador_id?.nome_completo)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 font-bold">
                <td colSpan={6} className="border border-gray-800 p-2 text-xs text-right">
                  TOTAIS:
                </td>
                <td className="border border-gray-800 p-2 text-xs text-center">
                  {aplicacoes.reduce((sum, app) => sum + (app.tonelada_aplicada || 0), 0).toFixed(2)}
                </td>
                <td className="border border-gray-800 p-2 text-xs text-center">-</td>
                <td className="border border-gray-800 p-2 text-xs text-center">-</td>
                <td className="border border-gray-800 p-2 text-xs text-center">-</td>
                <td className="border border-gray-800 p-2 text-xs text-center">
                  {aplicacoes.reduce((sum, app) => sum + (app.area_calculada || 0), 0).toFixed(2)}
                </td>
                <td colSpan={2} className="border border-gray-800 p-2 text-xs text-center">
                  {aplicacoes.length} registros
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Rodapé com Assinaturas */}
      <div className="mt-8 pt-4 border-t border-gray-800">
        <div className="grid grid-cols-3 gap-8 text-center text-xs">
          <div>
            <div className="border-b border-gray-800 mb-2 h-8"></div>
            <p className="font-bold">ENCARREGADO</p>
          </div>
          <div>
            <div className="border-b border-gray-800 mb-2 h-8"></div>
            <p className="font-bold">RESPONSÁVEL TÉCNICO</p>
          </div>
          <div>
            <div className="border-b border-gray-800 mb-2 h-8"></div>
            <p className="font-bold">LYTORÂNEA CONSTRUÇÕES LTDA</p>
          </div>
        </div>
        <div className="text-center mt-4">
          <p className="text-xs text-gray-600">Sistema LYTOTEC ERP - Relatório gerado automaticamente</p>
        </div>
      </div>
    </div>
  );
};

export default RelatorioAplicacaoLayout;