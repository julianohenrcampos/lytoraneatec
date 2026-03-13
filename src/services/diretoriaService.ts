import { supabase } from "@/integrations/supabase/client";
import { Diretoria, DiretoriaFormData } from "@/types/diretoria";

export const fetchDiretorias = async (apenasAtivas = false): Promise<Diretoria[]> => {
  let query = supabase
    .from("bd_diretorias")
    .select("*, diretor:bd_funcionarios!bd_diretorias_diretor_id_fkey(id, nome_completo)")
    .order("nome", { ascending: true });

  if (apenasAtivas) {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching diretorias:", error);
    throw new Error(`Erro ao buscar diretorias: ${error.message}`);
  }

  return (data || []).map((d: any) => ({
    ...d,
    diretor: d.diretor || null,
  })) as Diretoria[];
};

export const createDiretoria = async (data: DiretoriaFormData): Promise<Diretoria> => {
  const insertData: any = {
    nome: data.nome,
    tipo: data.tipo,
    ativo: data.ativo,
  };

  if (data.diretor_id && data.diretor_id !== "__none__") {
    insertData.diretor_id = data.diretor_id;
  }

  const { data: newData, error } = await supabase
    .from("bd_diretorias")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating diretoria:", error);
    throw new Error(`Erro ao criar diretoria: ${error.message}`);
  }

  return newData as unknown as Diretoria;
};

export const updateDiretoria = async (id: string, data: DiretoriaFormData): Promise<Diretoria> => {
  const updateData: any = {
    nome: data.nome,
    tipo: data.tipo,
    ativo: data.ativo,
  };

  if (data.diretor_id && data.diretor_id !== "__none__") {
    updateData.diretor_id = data.diretor_id;
  } else {
    updateData.diretor_id = null;
  }

  const { data: updatedData, error } = await supabase
    .from("bd_diretorias")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating diretoria:", error);
    throw new Error(`Erro ao atualizar diretoria: ${error.message}`);
  }

  return updatedData as unknown as Diretoria;
};

export const deleteDiretoria = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("bd_diretorias")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting diretoria:", error);
    throw new Error(`Erro ao excluir diretoria: ${error.message}`);
  }
};
