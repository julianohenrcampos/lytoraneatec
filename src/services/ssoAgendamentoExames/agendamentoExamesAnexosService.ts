import { supabase } from '@/integrations/supabase/client';
import { AgendamentoExameAnexo } from '@/types/ssoAgendamentoExames';
import { agendamentoExamesStorageService } from './agendamentoExamesStorageService';

export const agendamentoExamesAnexosService = {
  async list(agendamentoId: string): Promise<AgendamentoExameAnexo[]> {
    const { data, error } = await (supabase
      .from('bd_agendamentos_exames_anexos' as any) as any)
      .select(`
        *,
        profiles:criado_por(id, nome_completo, email)
      `)
      .eq('agendamento_id', agendamentoId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async upload(agendamentoId: string, file: File, tipo?: string): Promise<AgendamentoExameAnexo> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuário não autenticado');

    // Upload do arquivo para o storage
    const { path } = await agendamentoExamesStorageService.upload(agendamentoId, file);

    // Criar registro no banco
    const { data, error } = await (supabase
      .from('bd_agendamentos_exames_anexos' as any) as any)
      .insert({
        agendamento_id: agendamentoId,
        arquivo_nome: file.name,
        arquivo_path: path,
        tipo: tipo || null,
        criado_por: userData.user.id
      })
      .select(`
        *,
        profiles:criado_por(id, nome_completo, email)
      `)
      .single();

    if (error) {
      // Se falhar, tentar remover o arquivo do storage
      await agendamentoExamesStorageService.delete(path);
      throw error;
    }

    return data;
  },

  async delete(anexo: AgendamentoExameAnexo): Promise<void> {
    // Deletar arquivo do storage
    await agendamentoExamesStorageService.delete(anexo.arquivo_path);

    // Deletar registro do banco
    const { error } = await (supabase
      .from('bd_agendamentos_exames_anexos' as any) as any)
      .delete()
      .eq('id', anexo.id);

    if (error) throw error;
  },

  async getDownloadUrl(path: string): Promise<string> {
    return agendamentoExamesStorageService.getPublicUrl(path);
  }
};
