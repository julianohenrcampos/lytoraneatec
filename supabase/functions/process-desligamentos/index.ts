import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const hoje = new Date().toISOString().split("T")[0];

    // Buscar desligamentos em andamento com aviso prévio vencido
    const { data: pendentes, error: errSelect } = await supabase
      .from("bd_desligamentos")
      .select("id, funcionario_id, data_fim_aviso")
      .eq("status", "em_andamento")
      .lte("data_fim_aviso", hoje);

    if (errSelect) throw errSelect;
    if (!pendentes || pendentes.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum desligamento para processar" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let processados = 0;
    for (const d of pendentes) {
      // Inativar funcionário
      await supabase
        .from("bd_funcionarios")
        .update({ status: "Inativo", data_desligamento: hoje })
        .eq("id", d.funcionario_id);

      // Concluir desligamento
      await supabase
        .from("bd_desligamentos")
        .update({ status: "concluido" })
        .eq("id", d.id);

      processados++;
    }

    return new Response(
      JSON.stringify({ message: `Processados: ${processados} desligamentos` }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
