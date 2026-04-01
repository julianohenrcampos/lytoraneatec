import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { saveAs } from 'file-saver';
import { LinhaTransporte } from '@/components/agendamento-exames/vale-transporte/LinhaTransporteItem';

const ROBOTO_REGULAR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf';
const ROBOTO_BOLD_URL = 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf';

async function embedRobotoFonts(pdfDoc: PDFDocument) {
  pdfDoc.registerFontkit(fontkit);
  const [regularRes, boldRes] = await Promise.all([
    fetch(ROBOTO_REGULAR_URL),
    fetch(ROBOTO_BOLD_URL),
  ]);
  if (!regularRes.ok) throw new Error(`Erro ao baixar fonte Roboto Regular: ${regularRes.status}`);
  if (!boldRes.ok) throw new Error(`Erro ao baixar fonte Roboto Bold: ${boldRes.status}`);
  const [regularBytes, boldBytes] = await Promise.all([
    regularRes.arrayBuffer(),
    boldRes.arrayBuffer(),
  ]);
  const font = await pdfDoc.embedFont(regularBytes);
  const fontBold = await pdfDoc.embedFont(boldBytes);
  return { font, fontBold };
}

const formatDateBR = (date: string): string => {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

interface EnderecoEstruturado {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

interface BeneficiarioData {
  nome: string;
  cpf: string;
  funcao: string;
  empresa: string;
  telefone: string;
  data_nascimento: string;
  endereco: EnderecoEstruturado;
  linhas: LinhaTransporte[];
  motivo: string;
  data_solicitacao: string;
  logoBase64?: string;
}

interface NaoBeneficiarioData {
  nome: string;
  cpf: string;
  funcao: string;
  empresa: string;
  data_nascimento: string;
  telefone: string;
  endereco: EnderecoEstruturado;
  motivos: string[];
  motivo_outros_texto: string;
  data_solicitacao: string;
  logoBase64?: string;
}

const SPACING_SECTION = 30;
const SPACING_LINE = 20;

export async function gerarPdfBeneficiario(dados: BeneficiarioData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { font, fontBold } = await embedRobotoFonts(pdfDoc);

  const drawText = (text: string, x: number, y: number, size = 10, bold = false) => {
    page.drawText(text || '', { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: rgb(0, 0, 0) });
  };

  // Logo
  let headerY = 810;
  if (dados.logoBase64) {
    try {
      const isJpg = dados.logoBase64.startsWith('data:image/jpeg') || dados.logoBase64.startsWith('data:image/jpg');
      const base64Data = dados.logoBase64.split(',')[1];
      const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const img = isJpg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
      const imgDims = img.scale(1);
      const maxW = 77, maxH = 73;
      const scale = Math.min(maxW / imgDims.width, maxH / imgDims.height);
      const logoW = imgDims.width * scale;
      const logoH = imgDims.height * scale;
      page.drawImage(img, { x: 50, y: 806 - logoH / 2, width: logoW, height: logoH });
    } catch (e) { console.warn('Erro ao embutir logo no PDF VT:', e); }
  }

  // Título centralizado
  const titulo = 'SOLICITAÇÃO DE 1ª VIA DE VALE TRANSPORTE';
  const tituloW = fontBold.widthOfTextAtSize(titulo, 12);
  drawText(titulo, (595 - tituloW) / 2, 800, 12, true);

  // NOME
  let y = 755;
  drawText('NOME:', 50, y, 10, true);
  drawLine(100, y - 5, 550, y - 5);
  drawText(dados.nome, 105, y);

  // CELULAR / FUNÇÃO
  y -= SPACING_SECTION;
  drawText('CELULAR:', 50, y, 10, true);
  drawLine(110, y - 5, 270, y - 5);
  drawText(dados.telefone, 115, y);

  drawText('FUNÇÃO:', 280, y, 10, true);
  drawLine(335, y - 5, 550, y - 5);
  drawText(dados.funcao, 340, y);

  // CPF / DATA NASC
  y -= SPACING_SECTION;
  drawText('CPF:', 50, y, 10, true);
  drawLine(80, y - 5, 220, y - 5);
  drawText(dados.cpf, 85, y);

  drawText('DATA NASC:', 230, y, 10, true);
  drawLine(310, y - 5, 420, y - 5);
  drawText(formatDateBR(dados.data_nascimento), 315, y);

  // EMPRESA
  y -= SPACING_SECTION;
  drawText('EMPRESA:', 50, y, 10, true);
  drawLine(120, y - 5, 550, y - 5);
  drawText(dados.empresa, 125, y);

  // Separador
  y -= SPACING_SECTION;
  drawLine(50, y, 550, y);

  // OBS
  y -= SPACING_LINE;
  drawText('OBSERVAÇÃO: ANEXAR COMPROVANTE DE RESIDÊNCIA', 50, y, 9, true);
  y -= 8;
  drawLine(50, y, 550, y);

  // ENDEREÇO ESTRUTURADO
  y -= SPACING_SECTION;
  const end = dados.endereco;
  drawText('ENDEREÇO:', 50, y, 10, true);
  drawLine(120, y - 5, 550, y - 5);
  drawText(`${end.rua || ''}, ${end.numero || ''}`, 125, y);

  y -= SPACING_LINE;
  drawText('BAIRRO:', 50, y, 9, true);
  drawLine(95, y - 5, 270, y - 5);
  drawText(end.bairro || '', 100, y, 9);

  drawText('CIDADE:', 280, y, 9, true);
  drawLine(325, y - 5, 440, y - 5);
  drawText(end.cidade || '', 330, y, 9);

  y -= SPACING_LINE;
  drawText('ESTADO:', 50, y, 9, true);
  drawLine(100, y - 5, 180, y - 5);
  drawText(end.estado || '', 105, y, 9);

  drawText('CEP:', 200, y, 9, true);
  drawLine(230, y - 5, 340, y - 5);
  drawText(end.cep || '', 235, y, 9);

  // Separador antes de LINHAS
  y -= SPACING_SECTION + 10;
  drawLine(50, y + 5, 550, y + 5);

  // LINHAS DE TRANSPORTE - header
  y -= 5;
  drawText('LINHAS DE TRANSPORTE', 50, y, 11, true);
  y -= 8;
  drawLine(50, y, 550, y);

  y -= SPACING_LINE;
  for (let i = 0; i < 4; i++) {
    const linha = dados.linhas[i] || { nome: '', numero: '', tarifa: 0, operadora: 'Jaé' };

    drawText(`LINHA ${i + 1}:`, 50, y, 9, true);
    drawLine(100, y - 5, 230, y - 5);
    drawText(linha.nome || '', 105, y, 9);

    drawText('Nº', 240, y, 9, true);
    drawLine(255, y - 5, 310, y - 5);
    drawText(linha.numero || '', 260, y, 9);

    drawText('TARIFA', 320, y, 9, true);
    drawLine(365, y - 5, 420, y - 5);
    drawText(linha.tarifa ? `R$ ${linha.tarifa.toFixed(2)}` : '', 370, y, 9);

    const isJae = linha.operadora === 'Jaé';
    const isRio = linha.operadora === 'RioCard';
    drawText(`${isJae ? '(X)' : '(  )'} Jaé`, 430, y, 8);
    drawText(`${isRio ? '(X)' : '(  )'} RioCard`, 485, y, 8);

    y -= 25;
  }

  // Separador antes de VALORES
  y -= 5;
  drawLine(50, y + 5, 550, y + 5);

  // VALORES (ida e volta = tarifa x2)
  y -= 10;
  const valorJae = dados.linhas.filter(l => l.operadora === 'Jaé').reduce((s, l) => s + (l.tarifa || 0) * 2, 0);
  const valorRioCard = dados.linhas.filter(l => l.operadora === 'RioCard').reduce((s, l) => s + (l.tarifa || 0) * 2, 0);
  const valorTotal = valorJae + valorRioCard;
  const excedeLimite = valorTotal > 28;

  drawText(`VALOR JAÉ (IDA/VOLTA): R$ ${valorJae.toFixed(2)}`, 50, y, 10, true);
  drawText(`VALOR RIOCARD (IDA/VOLTA): R$ ${valorRioCard.toFixed(2)}`, 280, y, 10, true);
  y -= 25;

  drawText('TOTAL DIÁRIO (IDA/VOLTA): R$', 50, y, 10, true);
  drawLine(210, y - 5, 310, y - 5);
  drawText(valorTotal.toFixed(2), 215, y);

  // Aviso de limite
  if (excedeLimite) {
    y -= 25;
    drawText('VALOR EXCEDE R$ 28,00 — REQUER AUTORIZAÇÃO DA DIRETORIA FINANCEIRA', 50, y, 9, true);
  }

  // Separador antes de MOTIVOS
  y -= SPACING_SECTION;
  drawLine(50, y + 5, 550, y + 5);

  // MOTIVOS
  y -= 5;
  drawText('MOTIVO DA SOLICITAÇÃO:', 50, y, 10, true);
  y -= SPACING_LINE;

  const motivos = ['Admissão', 'Mudança de endereço residencial', 'Transferência de obra', 'Atualização de passagem'];
  for (const m of motivos) {
    const marcado = dados.motivo === m ? '(X)' : '(  )';
    drawText(`${marcado} ${m}`, 60, y, 9);
    y -= 18;
  }

  // DATA
  y -= SPACING_LINE;
  drawText('Data:', 50, y, 10, true);
  drawLine(85, y - 5, 200, y - 5);
  drawText(formatDateBR(dados.data_solicitacao), 90, y);

  // ASSINATURAS
  y -= 50;
  drawLine(50, y, 260, y);
  if (excedeLimite) {
    drawLine(310, y, 550, y);
  }
  y -= 15;
  drawText('Assinatura do Empregado', 90, y, 8);
  if (excedeLimite) {
    drawText('Diretor Financeiro', 380, y, 8);
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  saveAs(blob, `VT_${dados.nome.replace(/\s+/g, '_')}.pdf`);
}

export async function gerarPdfNaoBeneficiario(dados: NaoBeneficiarioData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { font, fontBold } = await embedRobotoFonts(pdfDoc);

  const drawText = (text: string, x: number, y: number, size = 10, bold = false) => {
    page.drawText(text || '', { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: rgb(0, 0, 0) });
  };

  const drawBox = (x: number, y: number, width: number, height: number) => {
    page.drawRectangle({ x, y, width, height, borderColor: rgb(0, 0, 0), borderWidth: 1, color: undefined });
  };

  // Logo
  if (dados.logoBase64) {
    try {
      const isJpg = dados.logoBase64.startsWith('data:image/jpeg') || dados.logoBase64.startsWith('data:image/jpg');
      const base64Data = dados.logoBase64.split(',')[1];
      const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const img = isJpg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
      const imgDims = img.scale(1);
      const maxW = 77, maxH = 73;
      const scale = Math.min(maxW / imgDims.width, maxH / imgDims.height);
      const logoW = imgDims.width * scale;
      const logoH = imgDims.height * scale;
      page.drawImage(img, { x: 50, y: 807 - logoH / 2, width: logoW, height: logoH });
    } catch (e) { console.warn('Erro ao embutir logo no PDF NB:', e); }
  }

  // ── CABEÇALHO ──
  const t1 = 'VALE - TRANSPORTE';
  drawText(t1, (595 - fontBold.widthOfTextAtSize(t1, 14)) / 2, 800, 14, true);
  const t2 = 'Declaração de Não Beneficiário';
  drawText(t2, (595 - fontBold.widthOfTextAtSize(t2, 11)) / 2, 780, 11, true);

  // ── BLOCO 1 — EMPRESA ──
  const b1Top = 755;
  const b1Height = 70;
  drawBox(40, b1Top - b1Height, 515, b1Height);

  drawText('Empresa:', 50, b1Top - 20, 9, true);
  drawText(dados.empresa || '', 110, b1Top - 20, 9);

  drawText('CNPJ:', 400, b1Top - 20, 9, true);
  drawText('', 440, b1Top - 20, 9);

  drawText('Endereço:', 50, b1Top - 40, 9, true);
  drawText('', 115, b1Top - 40, 9);

  drawText('Atividade:', 50, b1Top - 60, 9, true);
  drawText('', 115, b1Top - 60, 9);
  drawText('Código CNAE:', 300, b1Top - 60, 9, true);
  drawText('', 385, b1Top - 60, 9);

  // ── BLOCO 2 — FUNCIONÁRIO ──
  const b2Top = b1Top - b1Height - 10;
  const b2Height = 90;
  drawBox(40, b2Top - b2Height, 515, b2Height);

  drawText('Funcionário:', 50, b2Top - 20, 9, true);
  drawText(dados.nome || '', 125, b2Top - 20, 9);

  const end = dados.endereco || { rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' };
  drawText('Endereço:', 50, b2Top - 40, 9, true);
  drawText(`${end.rua || ''}, ${end.numero || ''}`, 115, b2Top - 40, 9);

  drawText('Bairro:', 50, b2Top - 60, 9, true);
  drawText(end.bairro || '', 95, b2Top - 60, 9);
  drawText('Cidade:', 250, b2Top - 60, 9, true);
  drawText(`${end.cidade || ''} / ${end.estado || ''}`, 295, b2Top - 60, 9);

  drawText('CTPS:', 50, b2Top - 80, 9, true);
  drawText('', 85, b2Top - 80, 9);
  drawText('CPF:', 200, b2Top - 80, 9, true);
  drawText(dados.cpf || '', 230, b2Top - 80, 9);
  drawText('Registro:', 380, b2Top - 80, 9, true);
  drawText('', 435, b2Top - 80, 9);

  // ── BLOCO 3 — DECLARAÇÃO ──
  const b3Top = b2Top - b2Height - 10;
  const b3Height = 310;
  drawBox(40, b3Top - b3Height, 515, b3Height);

  // Texto declaratório com word-wrap
  let y = b3Top - 20;
  const declaracao = `Declaro para os devidos fins que não desejo usufruir do Benefício VALE-TRANSPORTE, concedido pelo Art. 1° da Lei 7.418 de 16 de Dezembro de 1985, com alterações da Lei n° 7.619 de 30 de Setembro de 1987 regulamentado pelo Decreto n° 95.247 de 17 de Novembro de 1987 e que até o presente momento cabe a mim o custo com transporte utilizado no percurso Residência-Trabalho-Residência.`;
  const words = declaracao.split(' ');
  let currentLine = '';
  const maxWidth = 490;
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, 9) > maxWidth) {
      drawText(currentLine, 50, y, 9);
      y -= 14;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) { drawText(currentLine, 50, y, 9); y -= 24; }

  // Motivos
  drawText('Motivo(s):', 50, y, 9, true);
  y -= 18;

  const MOTIVO_LABELS: Record<string, string> = {
    transporte_proprio: 'Utilizo meio próprio de transporte',
    custo_inferior: 'Custo inferior a 6% do salário',
    mora_proximo: 'Não utilizo transporte por morar próximo ao local de trabalho',
    outros: 'Outros',
  };

  for (const [key, label] of Object.entries(MOTIVO_LABELS)) {
    const marcado = dados.motivos.includes(key) ? '(X)' : '(   )';
    drawText(`${marcado}  ${label}`, 60, y, 9);
    y -= 18;
  }

  // Linhas "Outros"
  if (dados.motivos.includes('outros') && dados.motivo_outros_texto) {
    drawText(dados.motivo_outros_texto, 60, y, 9);
    y -= 18;
  }
  drawLine(60, y + 5, 520, y + 5);
  y -= 18;
  drawLine(60, y + 5, 520, y + 5);
  y -= 18;
  drawLine(60, y + 5, 520, y + 5);

  // Data
  y -= 35;
  const dataBR = formatDateBR(dados.data_solicitacao);
  drawText(`Data: ${dataBR || '___/___/______'}`, 50, y, 9, true);
  drawLine(50, y - 7, 200, y - 7);

  // Assinatura
  y -= 60;
  drawLine(120, y, 480, y);
  y -= 18;
  drawText('( ASSINATURA DO EMPREGADO )', 210, y, 8, true);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  saveAs(blob, `Declaracao_NB_${dados.nome.replace(/\s+/g, '_')}.pdf`);
}
