import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { pdf } from '@react-pdf/renderer';
import { SSOReportDocument } from '@/components/sso/pdf/SSOReportDocument';
import { DesvioReportDocument } from '@/components/ssoDesvios/pdf/DesvioReportDocument';
import { SolicitacaoPDFDocument } from '@/components/diarias/pdf/SolicitacaoPDFDocument';
import { CompiladoDiariasPDF } from '@/components/diarias/pdf/CompiladoDiariasPDF';
import { ListaPresencaPDFDocument } from '@/components/diarias/pdf/ListaPresencaPDF';
import type { ListaPresencaItem } from '@/components/diarias/pdf/ListaPresencaPDF';
import { RelatorioDiariasPDF } from '@/components/diarias/pdf/RelatorioDiariasPDF';
import { SSOChecklist, SSOChecklistItem } from '@/types/sso';
import { SSODesvio, SSODesvioFoto } from '@/types/ssoDesvios';
import { DiariaSolicitacao, FuncionarioPreConvocado, RelatorioFolhaItem, PresencaResumo, RelatorioFilters } from '@/types/diarias';
import { ssoStorageService } from '@/services/sso/ssoStorageService';
import { ssoDesvioStorageService } from '@/services/ssoDesvios/ssoDesvioStorageService';
import { createElement } from 'react';

export const generatePDF = async (elementId: string, fileName: string): Promise<void> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Elemento não encontrado para geração do PDF');
    }

    // Configurações para captura de alta qualidade
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      height: element.scrollHeight,
      width: element.scrollWidth
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Criar PDF em formato A4 PAISAGEM
    const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' para landscape (paisagem)
    const imgWidth = 295; // Largura A4 paisagem em mm
    const pageHeight = 210; // Altura A4 paisagem em mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Adicionar primeira página
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Adicionar páginas adicionais se necessário
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Fazer download do PDF
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};

export const generateReportPDF = async (
  vehicleName: string,
  periodo: string
): Promise<void> => {
  const fileName = `Relatorio_Medicao_${vehicleName.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo.replace(/[^a-zA-Z0-9]/g, '_')}`;
  await generatePDF('relatorio-medicao-detalhado', fileName);
};

// Helper para carregar imagem como base64
const loadImageAsBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao carregar imagem:', error);
    return '';
  }
};

// Função para pré-carregar todas as fotos das NCs
const preloadPhotos = async (
  naoConformidades: SSOChecklistItem[]
): Promise<Record<string, string>> => {
  const photoUrls: Record<string, string> = {};
  
  for (const nc of naoConformidades) {
    if (!nc.fotos || nc.fotos.length === 0) continue;
    
    for (const foto of nc.fotos) {
      if (!foto.path) continue;
      
      try {
        // Obter URL válida
        let url = foto.url;
        
        // Se não tem URL ou é inválida, gerar signed URL
        if (!url || !url.startsWith('https://')) {
          url = await ssoStorageService.getSignedUrl(foto.path, 60 * 60);
        }
        
        // Converter para base64 para garantir renderização no PDF
        if (url) {
          const base64 = await loadImageAsBase64(url);
          if (base64) {
            photoUrls[foto.path] = base64;
          }
        }
      } catch (error) {
        console.error(`Erro ao carregar foto ${foto.path}:`, error);
      }
    }
  }
  
  return photoUrls;
};

export const generateSSOReportPDF = async (
  checklist: SSOChecklist,
  naoConformidades: SSOChecklistItem[],
  fileName: string
): Promise<void> => {
  try {
    // Pré-carregar todas as fotos como base64
    const photoUrls = await preloadPhotos(naoConformidades);
    
    // Criar o documento React-PDF
    const doc = createElement(SSOReportDocument, {
      checklist,
      naoConformidades,
      photoUrls
    });
    
    // Gerar o blob do PDF usando pdf() com cast para any para resolver incompatibilidade de tipos
    const blob = await pdf(doc as any).toBlob();
    
    // Fazer download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};

// Helper para pré-carregar fotos de desvios
const preloadDesvioPhotos = async (
  fotos: SSODesvioFoto[]
): Promise<Record<string, string>> => {
  const photoUrls: Record<string, string> = {};
  
  for (const foto of fotos) {
    if (!foto.path) continue;
    
    try {
      // Obter URL válida
      let url = foto.url;
      
      // Se não tem URL ou é inválida, gerar signed URL
      if (!url || !url.startsWith('https://')) {
        url = await ssoDesvioStorageService.getSignedUrl(foto.path) || '';
      }
      
      // Converter para base64 para garantir renderização no PDF
      if (url) {
        const base64 = await loadImageAsBase64(url);
        if (base64) {
          photoUrls[foto.path] = base64;
        }
      }
    } catch (error) {
      console.error(`Erro ao carregar foto ${foto.path}:`, error);
    }
  }
  
  return photoUrls;
};

export const generateDesvioReportPDF = async (
  desvio: SSODesvio,
  fileName: string
): Promise<void> => {
  try {
    // Pré-carregar todas as fotos como base64
    const fotos = desvio.bd_registro_desvios_fotos || [];
    const photoUrls = await preloadDesvioPhotos(fotos);
    
    // Criar o documento React-PDF
    const doc = createElement(DesvioReportDocument, {
      desvio,
      photoUrls
    });
    
    // Gerar o blob do PDF
    const blob = await pdf(doc as any).toBlob();
    
    // Fazer download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF de desvio:', error);
    throw error;
  }
};

// =====================================================
// DIÁRIAS PDF - Solicitação Individual
// =====================================================

export const generateSolicitacaoPDF = async (
  solicitacao: DiariaSolicitacao,
  convocados: FuncionarioPreConvocado[],
  dadosComplementares: {
    aprovadorNome?: string | null;
    apontadorNome?: string | null;
    criadorNome?: string | null;
    funcionariosMap?: Record<string, string>;
    funcoesMap?: Record<string, string>;
  },
  fileName: string
): Promise<void> => {
  try {
    // Carregar logo como base64
    const logoUrl = await loadImageAsBase64('/logo-lyto.svg');
    
    // Criar o documento React-PDF
    const doc = createElement(SolicitacaoPDFDocument, {
      solicitacao,
      convocados,
      dadosComplementares,
      logoUrl: logoUrl || undefined
    });
    
    // Gerar o blob do PDF
    const blob = await pdf(doc as any).toBlob();
    
    // Fazer download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF de solicitação:', error);
    throw error;
  }
};

// =====================================================
// DIÁRIAS PDF - Relatório de Folha
// =====================================================

export const generateRelatorioDiariasPDF = async (
  relatorio: RelatorioFolhaItem[],
  resumo: PresencaResumo,
  filtros: RelatorioFilters,
  feriados: string[],
  fileName: string,
  extras?: {
    engenheiroSolicitante?: string;
    gerenteRegional?: string;
  }
): Promise<void> => {
  try {
    // Carregar logo como base64
    const logoUrl = await loadImageAsBase64('/lyto-uploads/dcf6c980-f927-4180-b109-b425da1323ba.png');
    
    // Criar o documento React-PDF
    const doc = createElement(RelatorioDiariasPDF, {
      relatorio,
      resumo,
      filtros,
      feriados,
      logoUrl: logoUrl || undefined,
      engenheiroSolicitante: extras?.engenheiroSolicitante,
      gerenteRegional: extras?.gerenteRegional
    });
    
    // Gerar o blob do PDF
    const blob = await pdf(doc as any).toBlob();
    
    // Fazer download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF de relatório de diárias:', error);
    throw error;
  }
};

// =====================================================
// DIÁRIAS PDF - Lista de Presença para Assinatura
// =====================================================

export const generateListaPresencaPDF = async (
  numeroSolicitacao: string,
  centroCusto: string,
  dataApontamento: string,
  funcionarios: ListaPresencaItem[],
  fileName: string
): Promise<void> => {
  try {
    const doc = createElement(ListaPresencaPDFDocument, {
      numeroSolicitacao,
      centroCusto,
      dataApontamento,
      funcionarios
    });

    const blob = await pdf(doc as any).toBlob();

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF de lista de presença:', error);
    throw error;
  }
};

// =====================================================
// DIÁRIAS PDF - Compilado por Gerência
// =====================================================

interface CompiladoGerencia {
  gerenteNome: string;
  centrosCusto: {
    centroCusto: string;
    quantidade: number;
    valor: number;
  }[];
  totalQuantidade: number;
  totalValor: number;
}

export const generateCompiladoDiariasPDF = async (
  dados: CompiladoGerencia[],
  mesAno: string,
  totalGeralQuantidade: number,
  totalGeralValor: number,
  fileName: string
): Promise<void> => {
  try {
    const logoUrl = await loadImageAsBase64('/logo-lyto.svg');

    const doc = createElement(CompiladoDiariasPDF, {
      dados,
      mesAno,
      logoUrl: logoUrl || undefined,
      totalGeralQuantidade,
      totalGeralValor,
    });

    const blob = await pdf(doc as any).toBlob();

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF compilado:', error);
    throw error;
  }
};
