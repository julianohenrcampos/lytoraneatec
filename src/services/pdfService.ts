
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export const generateSSOReportPDF = async (
  obraName: string,
  dataInspecao: string
): Promise<void> => {
  try {
    const pagesContainer = document.getElementById('sso-pdf-pages');
    if (!pagesContainer) {
      throw new Error('Container de páginas não encontrado');
    }

    // Temporariamente mostrar o container para captura
    pagesContainer.classList.remove('hidden');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    
    // Buscar todas as páginas individuais
    const pages = pagesContainer.querySelectorAll('.pdf-page');
    
    if (pages.length === 0) {
      throw new Error('Nenhuma página encontrada para gerar PDF');
    }

    // Capturar cada página individualmente
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i] as HTMLElement;
      
      // Adicionar nova página (exceto na primeira iteração)
      if (i > 0) {
        pdf.addPage();
      }
      
      // Capturar a página atual
      const canvas = await html2canvas(page, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        height: page.scrollHeight,
        width: page.scrollWidth,
        windowWidth: 980,
        imageTimeout: 0,
        removeContainer: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Adicionar imagem ajustada à página
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
    }

    // Esconder novamente o container
    pagesContainer.classList.add('hidden');

    const fileName = `Relatorio_NC_SSO_${obraName.replace(/[^a-zA-Z0-9]/g, '_')}_${dataInspecao.replace(/[^a-zA-Z0-9]/g, '_')}`;
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    // Garantir que o container seja escondido mesmo em caso de erro
    const pagesContainer = document.getElementById('sso-pdf-pages');
    if (pagesContainer) {
      pagesContainer.classList.add('hidden');
    }
    throw error;
  }
};
