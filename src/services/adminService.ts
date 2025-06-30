
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

// Função para confirmar o email do usuário específico que está com problemas
export const confirmSpecificUserEmail = async () => {
  try {
    console.log("🔧 Confirmando email do usuário xmatheus457@gmail.com...");
    const result = await confirmUserEmail("xmatheus457@gmail.com");
    console.log("✅ Email confirmado com sucesso:", result);
    return result;
  } catch (error) {
    console.error("❌ Erro ao confirmar email:", error);
    throw error;
  }
};
