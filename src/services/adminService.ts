
import { supabase } from "@/integrations/supabase/client";

export const confirmUserEmail = async (email: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-confirm-email', {
      body: { email }
    });

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Erro ao confirmar email:", error);
    throw new Error(error.message || "Erro ao confirmar email do usuário");
  }
};
