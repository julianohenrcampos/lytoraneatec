import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { desvioStyles as styles } from './DesvioReportStyles';
import { DesvioReportHeader } from './DesvioReportHeader';
import { SSODesvio } from '@/types/ssoDesvios';

interface DesvioReportDocumentProps {
  desvio: SSODesvio;
  photoUrls: Record<string, string>;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
};

const formatDateTime = (date: Date) => {
  return date.toLocaleDateString('pt-BR') + ' ' + 
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const DesvioReportDocument: React.FC<DesvioReportDocumentProps> = ({
  desvio,
  photoUrls
}) => {
  const fotos = desvio.bd_registro_desvios_fotos || [];
  const fotosWithUrls = fotos.filter(f => photoUrls[f.path]);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <DesvioReportHeader
          numeroRelatorio={desvio.numero_relatorio}
          classificacao={desvio.classificacao_desvio}
          status={desvio.status_acao}
          reincidencia={desvio.reincidencia}
        />

        {/* Identificação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IDENTIFICAÇÃO</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Obra</Text>
              <Text style={styles.infoValue}>
                {desvio.bd_centros_custo?.nome_centro_custo || '-'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Data do Registro</Text>
              <Text style={styles.infoValue}>{formatDate(desvio.data_registro)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Gerência Regional</Text>
              <Text style={styles.infoValue}>{desvio.gerente_regional}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Engenheiro da Obra</Text>
              <Text style={styles.infoValue}>{desvio.engenheiro_obra}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Técnico de Segurança</Text>
              <Text style={styles.infoValue}>{desvio.tecnico_seguranca}</Text>
            </View>
            {desvio.encarregado_mestre && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Encarregado/Mestre</Text>
                <Text style={styles.infoValue}>{desvio.encarregado_mestre}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tipos de Desvio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TIPOS DE DESVIO</Text>
          <View style={styles.tiposContainer}>
            {desvio.tipos_desvio?.map((tipo, index) => (
              <View key={index} style={styles.tipoItem}>
                <View style={styles.tipoCheckmark}>
                  <Text style={styles.tipoCheckmarkText}>✓</Text>
                </View>
                <Text style={styles.tipoText}>{tipo}</Text>
              </View>
            ))}
            {desvio.tipo_outros && (
              <View style={styles.tipoOutros}>
                <Text style={styles.tipoOutrosLabel}>Outros:</Text>
                <Text style={styles.tipoOutrosText}>{desvio.tipo_outros}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Análise Técnica */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ANÁLISE TÉCNICA</Text>
          <Text style={styles.textContent}>{desvio.analise_tecnica}</Text>
        </View>

        {/* Ações Corretivas */}
        {(desvio.adequacao_imediata || desvio.responsavel_acao || desvio.prazo_correcao) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AÇÕES CORRETIVAS</Text>
            {desvio.adequacao_imediata && (
              <View style={styles.acaoSection}>
                <Text style={styles.acaoLabel}>Adequação Imediata:</Text>
                <Text style={styles.acaoText}>{desvio.adequacao_imediata}</Text>
              </View>
            )}
            {(desvio.responsavel_acao || desvio.prazo_correcao) && (
              <View style={styles.acaoGrid}>
                {desvio.responsavel_acao && (
                  <View style={styles.acaoItem}>
                    <Text style={styles.infoLabel}>Responsável</Text>
                    <Text style={styles.infoValue}>{desvio.responsavel_acao}</Text>
                  </View>
                )}
                {desvio.prazo_correcao && (
                  <View style={styles.acaoItem}>
                    <Text style={styles.infoLabel}>Prazo</Text>
                    <Text style={styles.infoValue}>{formatDate(desvio.prazo_correcao)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Registro Fotográfico */}
        {fotosWithUrls.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>REGISTRO FOTOGRÁFICO</Text>
            <View style={styles.photosGrid}>
              {fotosWithUrls.map((foto, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image
                    src={photoUrls[foto.path]}
                    style={styles.photo}
                  />
                  {foto.legenda && (
                    <Text style={styles.photoCaption}>{foto.legenda}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Sistema SSO - MTE_TAC</Text>
          <Text style={styles.footerText}>
            Gerado em: {formatDateTime(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
