import { supabase } from "@/integrations/supabase/client";

export async function syncSubcategorias() {
  const { data, error } = await supabase.functions.invoke(
    "sync-subcategorias-site"
  );

  if (error) {
    throw new Error(`Erro ao sincronizar subcategorias: ${error.message}`);
  }

  return data;
}
