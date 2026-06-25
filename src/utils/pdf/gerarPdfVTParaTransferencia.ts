/**
 * Adapter para gerar PDF de Solicitação de Vale Transporte
 * a partir de um item de Solicitação de Transferência.
 *
 * Reutiliza `gerarPdfBeneficiario` do módulo VT sem alterá-lo.
 * Empresa SEMPRE via bd_funcionarios.empresa_id → bd_empresas.nome_empresa.
 * Sem render alternativo: se o gerador VT falhar com vazios, propagar erro.
 */
import { supabase } from '@/integrations/supabase/client';
import { gerarPdfBeneficiario } from '@/services/valeTransporte/pdfGenerator';

interface Params {
  funcionario_id: string;
  /** Nome do funcionário (snapshot do item da solicitação). Sempre obrigatório. */
  nome: string;
  /** Se true, gera o PDF apenas com o nome preenchido. */
  somenteNome: boolean;
}

const hojeISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export async function gerarPdfVTParaTransferencia({
  funcionario_id,
  nome,
  somenteNome,
}: Params): Promise<void> {
  if (!nome) throw new Error('Nome do funcionário é obrigatório para gerar VT.');

  // Modo "apenas nome": dados em branco para preenchimento manual
  if (somenteNome) {
    await gerarPdfBeneficiario({
      nome,
      cpf: '',
      funcao: '',
      empresa: '',
      telefone: '',
      data_nascimento: '',
      endereco: { rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' },
      linhas: [],
      motivo: 'Transferência de obra',
      data_solicitacao: hojeISO(),
      tituloOverride: 'SOLICITAÇÃO DE ALTERAÇÃO DE PASSAGEM',
    });
    return;
  }

  // Modo completo: busca dados oficiais do funcionário
  const { data, error } = await supabase
    .from('bd_funcionarios')
    .select(`
      id, nome_completo, cpf, data_nascimento,
      endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
      bd_funcoes:funcao_id(nome_funcao),
      bd_empresas:empresa_id(nome_empresa)
    `)
    .eq('id', funcionario_id)
    .maybeSingle();

  if (error) throw error;

  const f: any = data || {};
  const empresaNome = f?.bd_empresas?.nome_empresa || '';
  const funcaoNome = f?.bd_funcoes?.nome_funcao || '';

  await gerarPdfBeneficiario({
    nome: f.nome_completo || nome,
    cpf: f.cpf || '',
    funcao: funcaoNome,
    empresa: empresaNome,
    telefone: '', // bd_funcionarios não possui telefone — preenchimento manual
    data_nascimento: f.data_nascimento || '',
    endereco: {
      rua: f.endereco_rua || '',
      numero: f.endereco_numero || '',
      bairro: f.endereco_bairro || '',
      cidade: f.endereco_cidade || '',
      estado: f.endereco_estado || '',
      cep: f.endereco_cep || '',
    },
    linhas: [],
    motivo: 'Transferência de obra',
    data_solicitacao: hojeISO(),
    tituloOverride: 'SOLICITAÇÃO DE ALTERAÇÃO DE PASSAGEM',
  });
}
