import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { verAgirStyles as styles } from './VerAgirPDFStyles';
import { VerAgir } from '@/types/ssoVerAgir';

interface VerAgirPDFDocumentProps {
  registro: VerAgir;
  photoUrls: {
    antes?: string;
    depois?: string;
  };
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

export const VerAgirPDFDocument: React.FC<VerAgirPDFDocumentProps> = ({
  registro,
  photoUrls
}) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>RELATÓRIO VER E AGIR</Text>
          <Text style={styles.headerSubtitle}>Registro de Não Conformidade - Sistema de Gestão SSO</Text>
        </View>

        {/* Identificação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IDENTIFICAÇÃO</Text>
          <View style={styles.infoGrid}>
            {/* Linha 1: Téc. Segurança | Engenheiro */}
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Téc. Seg. Trabalho</Text>
                <Text style={styles.infoValue}>{registro.tecnico_seguranca_nome || '-'}</Text>
              </View>
              <View style={styles.infoCellLast}>
                <Text style={styles.infoLabel}>Engenheiro(a)</Text>
                <Text style={styles.infoValue}>{registro.engenheiro_nome || '-'}</Text>
              </View>
            </View>
            
            {/* Linha 2: Obra | Local */}
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Obra</Text>
                <Text style={styles.infoValue}>{registro.obra || '-'}</Text>
              </View>
              <View style={styles.infoCellLast}>
                <Text style={styles.infoLabel}>Local</Text>
                <Text style={styles.infoValue}>{registro.local || '-'}</Text>
              </View>
            </View>
            
            {/* Linha 3: Data | Hora */}
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Data</Text>
                <Text style={styles.infoValue}>{formatDate(registro.data_registro)}</Text>
              </View>
              <View style={styles.infoCellLast}>
                <Text style={styles.infoLabel}>Hora</Text>
                <Text style={styles.infoValue}>{registro.hora_registro || '-'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Descrição da Não Conformidade */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIÇÃO DA NÃO CONFORMIDADE</Text>
          <Text style={styles.textContent}>
            {registro.descricao_nao_conformidade || 'Não informada'}
          </Text>
        </View>

        {/* Evidências Fotográficas */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>EVIDÊNCIAS FOTOGRÁFICAS</Text>
          <View style={styles.photosContainer}>
            {/* Foto ANTES */}
            <View style={styles.photoWrapper}>
              <Text style={styles.photoLabel}>ANTES</Text>
              <View style={styles.photoFrame}>
                {photoUrls.antes ? (
                  <Image src={photoUrls.antes} style={styles.photo} />
                ) : (
                  <Text style={styles.photoPlaceholder}>Sem foto</Text>
                )}
              </View>
            </View>
            
            {/* Foto DEPOIS */}
            <View style={styles.photoWrapper}>
              <Text style={styles.photoLabel}>DEPOIS</Text>
              <View style={styles.photoFrame}>
                {photoUrls.depois ? (
                  <Image src={photoUrls.depois} style={styles.photo} />
                ) : (
                  <Text style={styles.photoPlaceholder}>Sem foto</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Resultados Alcançados / Solução */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESULTADOS ALCANÇADOS / SOLUÇÃO</Text>
          <View style={styles.solutionBox}>
            <Text style={styles.solutionText}>
              {registro.resultado_alcancado_solucao || 'Não informado'}
            </Text>
          </View>
        </View>

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
