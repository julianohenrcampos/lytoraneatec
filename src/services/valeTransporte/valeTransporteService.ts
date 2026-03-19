import { supabase } from '@/integrations/supabase/client';
import { ValeTransporteStepData } from '@/components/agendamento-exames/vale-transporte/ValeTransporteStep';

const BUCKET = 'documentos-rh';

interface DocumentoInfo {
  nome: string;
  path: string;
  tipo: 'pdf' | 'imagem';
}

function normalizePath(path: string): string {
  // If it's a full URL, extract the object path
  if (path.startsWith('http')) {
    const match = path.match(/\/object\/(?:public|sign)\/[^/]+\/(.+)/);
    if (match) return decodeURIComponent(match[1]);
    // fallback: extract after bucket name
    const bucketMatch = path.match(new RegExp(`${BUCKET}/(.+)`));
    if (bucketMatch) return decodeURIComponent(bucketMatch[1]);
  }
  return path;
}

export const valeTransporteService = {
  async uploadComprovante(agendamentoId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `vale-transporte/${agendamentoId}/comprovante_residencia.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  },

  async uploadPdfAssinado(agendamentoId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `vale-transporte/${agendamentoId}/vt_assinado.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  },

  async getDocumentos(agendamentoId: string): Promise<DocumentoInfo[]> {
    const { data, error } = await supabase
      .from('bd_vale_transporte' as any)
      .select('pdf_assinado_url, comprovante_url, tipo')
      .eq('agendamento_id', agendamentoId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return [];

    const docs: DocumentoInfo[] = [];
    const record = data as any;

    if (record.pdf_assinado_url) {
      const ext = (record.pdf_assinado_url as string).split('.').pop()?.toLowerCase() || '';
      docs.push({
        nome: record.tipo === 'nao_beneficiario'
          ? 'Declaração de Não Beneficiário (Assinada)'
          : 'Solicitação de Vale Transporte (Assinada)',
        path: record.pdf_assinado_url,
        tipo: ext === 'pdf' ? 'pdf' : 'imagem',
      });
    }

    if (record.comprovante_url) {
      const ext = (record.comprovante_url as string).split('.').pop()?.toLowerCase() || '';
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
      docs.push({
        nome: 'Comprovante de Residência',
        path: record.comprovante_url,
        tipo: isImage ? 'imagem' : 'pdf',
      });
    }

    return docs;
  },

  async downloadBlob(path: string): Promise<Blob> {
    const normalizedPath = normalizePath(path);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(normalizedPath);
    if (error) throw error;
    return data;
  },

  async salvar(
    agendamentoId: string,
    stepData: ValeTransporteStepData,
    candidato: { nome: string; cpf: string; funcao: string; empresa: string; data_nascimento: string; telefone: string }
  ) {
    const tipo = stepData.isNaoBeneficiario ? 'nao_beneficiario' : 'beneficiario';

    let pdfAssinadoUrl: string | null = null;
    if (stepData.pdfAssinadoFile) {
      pdfAssinadoUrl = await this.uploadPdfAssinado(agendamentoId, stepData.pdfAssinadoFile);
    }

    let comprovanteUrl: string | null = null;
    if (!stepData.isNaoBeneficiario && stepData.comprovanteFile) {
      comprovanteUrl = await this.uploadComprovante(agendamentoId, stepData.comprovanteFile);
    }

    const linhas = stepData.isNaoBeneficiario ? [] : stepData.beneficiarioData.linhas;
    const valorJae = linhas.filter(l => l.operadora === 'Jaé').reduce((s, l) => s + (l.tarifa || 0), 0);
    const valorRioCard = linhas.filter(l => l.operadora === 'RioCard').reduce((s, l) => s + (l.tarifa || 0), 0);

    const end = stepData.endereco || stepData.beneficiarioData.endereco;
    const enderecoData = {
      endereco: `${end.rua}, ${end.numero} - ${end.bairro}, ${end.cidade}/${end.estado} - ${end.cep}`,
      rua: end.rua,
      numero: end.numero,
      bairro: end.bairro,
      cidade: end.cidade,
      estado: end.estado,
      cep: end.cep,
    };

    const { error } = await supabase.from('bd_vale_transporte' as any).insert({
      agendamento_id: agendamentoId,
      tipo,
      ...enderecoData,
      linhas: stepData.isNaoBeneficiario ? [] : linhas,
      valor_jae: valorJae,
      valor_riocard: valorRioCard,
      motivo: stepData.isNaoBeneficiario ? null : stepData.beneficiarioData.motivo,
      motivos_nao_beneficiario: stepData.isNaoBeneficiario ? stepData.naoBeneficiarioData.motivos : null,
      motivo_outros_texto: stepData.isNaoBeneficiario ? stepData.naoBeneficiarioData.motivo_outros_texto : null,
      comprovante_url: comprovanteUrl,
      pdf_assinado_url: pdfAssinadoUrl,
      data_solicitacao: stepData.isNaoBeneficiario
        ? stepData.naoBeneficiarioData.data_solicitacao
        : stepData.beneficiarioData.data_solicitacao,
    } as any);

    if (error) throw error;
  },
};
