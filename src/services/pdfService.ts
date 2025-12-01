
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
    pagesContainer.style.position = 'absolute';
    pagesContainer.style.left = '-9999px';
    pagesContainer.style.top = '0';
    pagesContainer.style.display = 'block';
    
    // Aguardar carregamento de imagens
    const images = pagesContainer.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
    
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
      
      // Configuração otimizada para captura de alta qualidade - SEM windowWidth/Height
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        removeContainer: false,
        onclone: (clonedDoc) => {
          const clonedPage = clonedDoc.body.querySelector('.pdf-page');
          if (clonedPage) {
            (clonedPage as HTMLElement).style.transform = 'none';
            (clonedPage as HTMLElement).style.width = '794px';
            (clonedPage as HTMLElement).style.minHeight = '1123px';
            (clonedPage as HTMLElement).style.overflow = 'visible';
            (clonedPage as HTMLElement).style.boxSizing = 'border-box';
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // Proporção A4: 794px = 210mm, logo 1px ≈ 0.2645mm
      // Canvas tem scale: 2, então dividir altura por 2 para proporção real
      const pxToMm = 210 / 794;
      const realCanvasHeight = canvas.height / 2; // Compensar scale: 2
      const imgHeight = realCanvasHeight * pxToMm;
      
      // Adicionar imagem ajustada à página A4
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight));
    }

    // Restaurar o container
    pagesContainer.classList.add('hidden');
    pagesContainer.style.position = '';
    pagesContainer.style.left = '';
    pagesContainer.style.top = '';
    pagesContainer.style.display = '';

    const fileName = `Relatorio_NC_SSO_${obraName.replace(/[^a-zA-Z0-9]/g, '_')}_${dataInspecao.replace(/[^a-zA-Z0-9]/g, '_')}`;
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    // Garantir que o container seja escondido mesmo em caso de erro
    const pagesContainer = document.getElementById('sso-pdf-pages');
    if (pagesContainer) {
      pagesContainer.classList.add('hidden');
      pagesContainer.style.position = '';
      pagesContainer.style.left = '';
      pagesContainer.style.top = '';
      pagesContainer.style.display = '';
    }
    throw error;
  }
};
