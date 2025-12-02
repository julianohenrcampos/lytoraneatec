import { Document, Page, View } from '@react-pdf/renderer';
import { SSOChecklist, SSOChecklistItem } from '@/types/sso';
import { styles } from './SSOReportStyles';
import { SSOReportHeader } from './SSOReportHeader';
import { SSOReportFooter } from './SSOReportFooter';
import { SSOReportCoverPage } from './SSOReportCoverPage';
import { SSOReportNCBlock } from './SSOReportNCBlock';

interface SSOReportDocumentProps {
  checklist: SSOChecklist;
  naoConformidades: SSOChecklistItem[];
  photoUrls: Record<string, string>;
}

// Função para determinar se uma NC é "grande"
const isLargeNC = (item: SSOChecklistItem) => {
  const evidenciaLonga = (item.evidencia?.length || 0) > 200;
  const muitasFotos = (item.fotos?.length || 0) >= 3;
  return evidenciaLonga || muitasFotos;
};

// Agrupa NCs em páginas de forma inteligente
const groupNCsIntoPages = (naoConformidades: SSOChecklistItem[]) => {
  const pages: SSOChecklistItem[][] = [];
  let currentPage: SSOChecklistItem[] = [];

  naoConformidades.forEach(nc => {
    if (isLargeNC(nc)) {
      // NC grande vai sozinha na página
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
      }
      pages.push([nc]);
    } else if (currentPage.length >= 2) {
      // Página cheia (2 NCs), iniciar nova
      pages.push(currentPage);
      currentPage = [nc];
    } else {
      currentPage.push(nc);
    }
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};

export const SSOReportDocument = ({ 
  checklist, 
  naoConformidades,
  photoUrls 
}: SSOReportDocumentProps) => {
  const groupedNCPages = groupNCsIntoPages(naoConformidades);

  return (
    <Document>
      {/* Página 1: Capa */}
      <Page size="A4" style={styles.coverPage}>
        <SSOReportCoverPage 
          checklist={checklist} 
          totalNaoConformidades={naoConformidades.length} 
        />
        <SSOReportFooter />
      </Page>

      {/* Páginas 2+: Não Conformidades */}
      {groupedNCPages.map((pageItems, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          <SSOReportHeader dataInspecao={checklist.data_inspecao} />
          
          <View style={styles.content}>
            {pageItems.map((item) => {
              const globalIdx = naoConformidades.findIndex(nc => nc.id === item.id);
              return (
                <SSOReportNCBlock 
                  key={item.id} 
                  item={item} 
                  index={globalIdx}
                  photoUrls={photoUrls}
                />
              );
            })}
          </View>
          
          <SSOReportFooter />
        </Page>
      ))}
    </Document>
  );
};
