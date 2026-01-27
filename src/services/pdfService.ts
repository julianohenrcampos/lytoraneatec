import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { pdf } from '@react-pdf/renderer';
import { SSOReportDocument } from '@/components/sso/pdf/SSOReportDocument';
import { DesvioReportDocument } from '@/components/ssoDesvios/pdf/DesvioReportDocument';
import { SSOChecklist, SSOChecklistItem } from '@/types/sso';
import { SSODesvio, SSODesvioFoto } from '@/types/ssoDesvios';
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
