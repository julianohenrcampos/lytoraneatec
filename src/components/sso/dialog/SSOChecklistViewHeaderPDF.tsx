import { SSOChecklist } from '@/types/sso';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBrazilianDate } from '@/utils/timezoneUtils';

interface SSOChecklistViewHeaderPDFProps {
  checklist: SSOChecklist;
  totalNaoConformidades: number;
}

export const SSOChecklistViewHeaderPDF = ({ checklist, totalNaoConformidades }: SSOChecklistViewHeaderPDFProps) => {
  const getResultadoColor = () => {
    switch (checklist.resultado_avaliacao) {
      case 'Crítico': return { bg: '#dc2626', color: '#ffffff' };
      case 'Em Atenção': return { bg: '#f59e0b', color: '#ffffff' };
      case 'Satisfatório': return { bg: '#22c55e', color: '#ffffff' };
      case 'Excelente': return { bg: '#16a34a', color: '#ffffff' };
      default: return { bg: '#6b7280', color: '#ffffff' };
    }
  };

  const resultadoColors = getResultadoColor();

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}>
      {/* Cabeçalho do Relatório - Centralizado */}
      <div style={{ 
        textAlign: 'center', 
        paddingBottom: '16px', 
         borderBottom: '3px solid #2563eb',
         marginBottom: '20px'
       }}>
         <h1 style={{ 
           fontSize: '24px', 
           fontWeight: 700, 
           color: '#1f2937', 
           margin: 0,
           letterSpacing: '0.5px'
         }}>
           RELATÓRIO DE NÃO CONFORMIDADES - MTE_TAC
         </h1>
        <p style={{ 
          fontSize: '15px', 
          color: '#6b7280', 
          marginTop: '8px',
          margin: '8px 0 0 0'
        }}>
          {format(parseBrazilianDate(checklist.data_inspecao), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Box Informações da Inspeção */}
      <div style={{ 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px', 
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div style={{ 
          backgroundColor: '#f3f4f6', 
          padding: '10px 16px', 
          borderBottom: '1px solid #e5e7eb' 
        }}>
          <h2 style={{ 
            fontSize: '15px', 
            fontWeight: 600, 
            color: '#1f2937', 
            margin: 0 
          }}>
            Informações da Inspeção
          </h2>
        </div>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          fontSize: '14px' 
        }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ 
                padding: '10px 16px', 
                backgroundColor: '#f9fafb', 
                fontWeight: 600, 
                color: '#374151',
                width: '35%' 
              }}>
                Obra:
              </td>
              <td style={{ padding: '10px 16px', color: '#1f2937' }}>
                {checklist.bd_centros_custo?.nome_centro_custo}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ 
                padding: '10px 16px', 
                backgroundColor: '#f9fafb', 
                fontWeight: 600, 
                color: '#374151' 
              }}>
                Código da Obra:
              </td>
              <td style={{ padding: '10px 16px', color: '#1f2937' }}>
                {checklist.bd_centros_custo?.codigo_centro_custo}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ 
                padding: '10px 16px', 
                backgroundColor: '#f9fafb', 
                fontWeight: 600, 
                color: '#374151' 
              }}>
                Data da Inspeção:
              </td>
              <td style={{ padding: '10px 16px', color: '#1f2937' }}>
                {format(parseBrazilianDate(checklist.data_inspecao), 'dd/MM/yyyy', { locale: ptBR })}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ 
                padding: '10px 16px', 
                backgroundColor: '#f9fafb', 
                fontWeight: 600, 
                color: '#374151' 
              }}>
                Gerente Regional:
              </td>
              <td style={{ padding: '10px 16px', color: '#1f2937' }}>
                {checklist.gerente_regional}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ 
                padding: '10px 16px', 
                backgroundColor: '#f9fafb', 
                fontWeight: 600, 
                color: '#374151' 
              }}>
                Engenheiro da Obra:
              </td>
              <td style={{ padding: '10px 16px', color: '#1f2937' }}>
                {checklist.engenheiro_obra}
              </td>
            </tr>
            <tr>
              <td style={{ 
                padding: '10px 16px', 
                backgroundColor: '#f9fafb', 
                fontWeight: 600, 
                color: '#374151' 
              }}>
                Técnico de Segurança:
              </td>
              <td style={{ padding: '10px 16px', color: '#1f2937' }}>
                {checklist.tecnico_seguranca}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Linha de Resultados - Flexbox Equilibrado */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderTop: '3px solid #2563eb',
        borderBottom: '3px solid #2563eb',
        padding: '20px 0',
        marginBottom: '20px'
      }}>
        {/* Resultado */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ 
            fontSize: '13px', 
            color: '#6b7280', 
            margin: '0 0 8px 0',
            fontWeight: 500
          }}>
            Resultado
          </p>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 20px',
            borderRadius: '9999px',
            fontSize: '15px',
            fontWeight: 700,
            backgroundColor: resultadoColors.bg,
            color: resultadoColors.color,
            lineHeight: 1.2
          }}>
            {checklist.resultado_avaliacao}
          </span>
        </div>
        
        <div style={{ width: '1px', height: '50px', backgroundColor: '#d1d5db' }} />
        
        {/* Nota Real */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ 
            fontSize: '13px', 
            color: '#6b7280', 
            margin: '0 0 6px 0',
            fontWeight: 500
          }}>
            Nota Real
          </p>
          <p style={{ 
            fontSize: '36px', 
            fontWeight: 700, 
            color: '#1f2937', 
            margin: 0,
            lineHeight: 1
          }}>
            {checklist.nota_real?.toFixed(1)}
          </p>
        </div>
        
        <div style={{ width: '1px', height: '50px', backgroundColor: '#d1d5db' }} />
        
        {/* Não Conformidades */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ 
            fontSize: '13px', 
            color: '#6b7280', 
            margin: '0 0 6px 0',
            fontWeight: 500
          }}>
            Não Conformidades
          </p>
          <p style={{ 
            fontSize: '36px', 
            fontWeight: 700, 
            color: '#dc2626', 
            margin: 0,
            lineHeight: 1
          }}>
            {checklist.total_itens}/{totalNaoConformidades}
          </p>
        </div>
        
        <div style={{ width: '1px', height: '50px', backgroundColor: '#d1d5db' }} />
        
        {/* Total de Efetivo */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ 
            fontSize: '13px', 
            color: '#6b7280', 
            margin: '0 0 6px 0',
            fontWeight: 500
          }}>
            Total de Efetivo
          </p>
          <p style={{ 
            fontSize: '36px', 
            fontWeight: 700, 
            color: '#1f2937', 
            margin: 0,
            lineHeight: 1
          }}>
            {checklist.total_efetivo ?? '-'}
          </p>
        </div>
      </div>

      {/* Observações Gerais */}
      {checklist.observacoes_gerais && (
        <div style={{ 
          backgroundColor: '#f9fafb', 
          borderRadius: '8px', 
          padding: '16px', 
          border: '1px solid #e5e7eb' 
        }}>
          <p style={{ 
            fontSize: '13px', 
            fontWeight: 600, 
            color: '#6b7280', 
            margin: '0 0 8px 0' 
          }}>
            Observações Gerais:
          </p>
          <p style={{ 
            fontSize: '15px', 
            color: '#374151', 
            lineHeight: 1.7, 
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {checklist.observacoes_gerais}
          </p>
        </div>
      )}
    </div>
  );
};
