import { supabase } from '@/integrations/supabase/client';
import { ValeTransporteStepData } from '@/components/agendamento-exames/vale-transporte/ValeTransporteStep';

const BUCKET = 'documentos-rh';
const BUCKET_ANEXOS = 'exames_agendamentos';

interface DocumentoInfo {
  nome: string;
  path: string;
  tipo: 'pdf' | 'imagem';
  bucket?: string;
}

function normalizePath(path: string, bucket: string = BUCKET): string {
  if (path.startsWith('http')) {
    const match = path.match(/\/object\/(?:public|sign)\/[^/]+\/(.+)/);
    if (match) return decodeURIComponent(match[1]);
    const bucketMatch = path.match(new RegExp(`${bucket}/(.+)`));
    if (bucketMatch) return decodeURIComponent(bucketMatch[1]);
  }
  return path;
}

export const valeTransporteService = {
  // Buscar registro VT existente para um agendamento
  async getByAgendamento(agendamentoId: string) {
    const { data, error } = await supabase
      .from('bd_vale_transporte' as any)
      .select('*')
      .eq('agendamento_id', agendamentoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as any;
  },

  async uploadComprovante(agendamentoId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `vale-transporte/${agendamentoId}/comprovante.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  },

  async uploadPdfAssinado(agendamentoId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `vale-transporte/${agendamentoId}/declaracao.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  },

  // Substituir documento existente e atualizar campo no banco
  async substituirDocumento(agendamentoId: string, docType: 'comprovante' | 'declaracao', file: File): Promise<string> {
    const ext = file.name.split('.').pop() || (docType === 'declaracao' ? 'pdf' : 'jpg');
    const path = `vale-transporte/${agendamentoId}/${docType}.${ext}`;

    // Upload com upsert
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    // Atualizar campo correspondente no banco
    const campo = docType === 'comprovante' ? 'comprovante_url' : 'pdf_assinado_url';
    const { error: updateError } = await supabase
      .from('bd_vale_transporte' as any)
      .update({ [campo]: path } as any)
      .eq('agendamento_id', agendamentoId);

    if (updateError) throw updateError;
    return path;
  },

  async getDocumentos(agendamentoId: string): Promise<DocumentoInfo[]> {
    const docs: DocumentoInfo[] = [];

    const { data: vtRecords, error: vtError } = await supabase
      .from('bd_vale_transporte' as any)
      .select('pdf_assinado_url, comprovante_url, pdf_gerado_url, pdf_url, tipo')
      .eq('agendamento_id', agendamentoId);

    if (vtError) throw vtError;

    const docFields: { field: string; label: (tipo: string) => string }[] = [
      {
        field: 'pdf_gerado_url',
        label: (tipo) => tipo === 'nao_beneficiario'
          ? 'Declaração de Não Beneficiário (Gerada)'
          : 'Solicitação de Vale Transporte (Gerada)',
      },
      {
        field: 'pdf_assinado_url',
        label: (tipo) => tipo === 'nao_beneficiario'
          ? 'Declaração de Não Beneficiário (Assinada)'
          : 'Solicitação de Vale Transporte (Assinada)',
      },
      {
        field: 'pdf_url',
        label: () => 'Documento PDF do Vale Transporte',
      },
      {
        field: 'comprovante_url',
        label: () => 'Comprovante de Residência',
      },
    ];

    if (vtRecords) {
      for (const record of vtRecords as any[]) {
        const tipo = record.tipo || '';
        for (const df of docFields) {
          const url = record[df.field];
          if (url) {
            const ext = (url as string).split('.').pop()?.toLowerCase() || '';
            const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
            docs.push({
              nome: df.label(tipo),
              path: url,
              tipo: isImage ? 'imagem' : 'pdf',
              bucket: BUCKET,
            });
          }
        }
      }
    }

    const { data: anexos, error: anexosError } = await supabase
      .from('bd_agendamentos_exames_anexos' as any)
      .select('arquivo_nome, arquivo_path')
      .eq('agendamento_id', agendamentoId);

    if (!anexosError && anexos) {
      for (const anexo of anexos as any[]) {
        const ext = (anexo.arquivo_path as string).split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
        docs.push({
          nome: anexo.arquivo_nome || 'Anexo',
          path: anexo.arquivo_path,
          tipo: isImage ? 'imagem' : 'pdf',
          bucket: BUCKET_ANEXOS,
        });
      }
    }

    return docs;
  },

  async downloadBlob(path: string, bucket: string = BUCKET): Promise<Blob> {
    const normalizedPath = normalizePath(path, bucket);
    const { data, error } = await supabase.storage
      .from(bucket)
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

    const payload: any = {
      agendamento_id: agendamentoId,
      tipo,
      ...enderecoData,
      linhas: stepData.isNaoBeneficiario ? [] : linhas,
      valor_jae: valorJae,
      valor_riocard: valorRioCard,
      motivo: stepData.isNaoBeneficiario ? null : stepData.beneficiarioData.motivo,
      motivos_nao_beneficiario: stepData.isNaoBeneficiario ? stepData.naoBeneficiarioData.motivos : null,
      motivo_outros_texto: stepData.isNaoBeneficiario ? stepData.naoBeneficiarioData.motivo_outros_texto : null,
      data_solicitacao: stepData.isNaoBeneficiario
        ? stepData.naoBeneficiarioData.data_solicitacao
        : stepData.beneficiarioData.data_solicitacao,
    };

    // Only include URLs if new files were uploaded
    if (pdfAssinadoUrl) payload.pdf_assinado_url = pdfAssinadoUrl;
    if (comprovanteUrl) payload.comprovante_url = comprovanteUrl;

    // Check if record already exists → update; otherwise → insert
    const existing = await this.getByAgendamento(agendamentoId);

    if (existing) {
      const { error } = await supabase
        .from('bd_vale_transporte' as any)
        .update(payload as any)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('bd_vale_transporte' as any)
        .insert(payload as any);
      if (error) throw error;
    }
  },
};
