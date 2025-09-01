
import { supabase } from "@/integrations/supabase/client";
import { ApontamentoEquipe, ApontamentoEquipeFilters } from "@/types/apontamentoEquipe";

// Helper function to normalize date to prevent timezone issues
const normalizeDate = (date: Date | string): string => {
  if (typeof date === 'string') {
    if (date.includes('T')) {
      const dateObj = new Date(date);
      return dateObj.toISOString().split('T')[0];
    }
    return date;
  }
  
  const normalizedDate = new Date(date);
  normalizedDate.setHours(12, 0, 0, 0);
  return normalizedDate.toISOString().split('T')[0];
};

// Fetch apontamentos with automatic RLS filtering and retry logic
export const fetchSecureApontamentos = async (filters: ApontamentoEquipeFilters = {}): Promise<ApontamentoEquipe[]> => {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(`🔐 Fetching apontamentos with RLS filtering (tentativa ${retryCount + 1})...`);
      
      let query = supabase
        .from('bd_apontamento_equipe')
        .select(`
          *,
          equipe:equipe_id(
            id,
            nome_equipe
          ),
          colaborador:colaborador_id(
            id,
            nome_completo
          ),
          registrado_por_profile:registrado_por(
            id,
            nome_completo
          )
        `)
        .order('data_registro', { ascending: false });
      
      // Apply filters
      if (filters.data_inicio) {
        const formattedDate = normalizeDate(filters.data_inicio);
        query = query.gte("data_registro", formattedDate);
      }
      
      if (filters.data_fim) {
        const formattedDate = normalizeDate(filters.data_fim);
        query = query.lte("data_registro", formattedDate);
      }
      
      if (filters.equipe_id && filters.equipe_id !== 'all') {
        query = query.eq("equipe_id", filters.equipe_id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("🚨 Database error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        
        // Tratamento específico para erros de relacionamento
        if (error.message?.includes('more than one relationship') || error.message?.includes('Could not embed')) {
          console.warn("🔗 Relationship error detected - attempting simplified fallback select...");

          let simpleQuery = supabase
            .from('bd_apontamento_equipe')
            .select(`
              *,
              equipe:equipe_id(id, nome_equipe),
              colaborador:colaborador_id(id, nome_completo)
            `)
            .order('data_registro', { ascending: false });

          if (filters.data_inicio) {
            simpleQuery = simpleQuery.gte('data_registro', normalizeDate(filters.data_inicio));
          }
          if (filters.data_fim) {
            simpleQuery = simpleQuery.lte('data_registro', normalizeDate(filters.data_fim));
          }
          if (filters.equipe_id && filters.equipe_id !== 'all') {
            simpleQuery = simpleQuery.eq('equipe_id', filters.equipe_id);
          }

          const { data: simpleData, error: simpleError } = await simpleQuery;
          if (simpleError) {
            console.error('❌ Fallback select failed:', simpleError);
            throw new Error(`Database relationship error and fallback failed: ${simpleError.message}`);
          }

          console.log(`✅ Fallback succeeded with ${simpleData?.length || 0} apontamentos`);
          return simpleData as unknown as ApontamentoEquipe[];
        }
        
        // Se é erro de RLS/permissão e ainda há tentativas, retry
        if ((error.message?.includes('policy') || error.message?.includes('permission') || error.code === 'PGRST116') && retryCount < maxRetries - 1) {
          console.warn(`⚠️ RLS error, retrying (${retryCount + 1}/${maxRetries}):`, error);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        console.error("❌ Error fetching secure apontamentos:", error);
        throw error;
      }
      
      console.log(`✅ Fetched ${data?.length || 0} apontamentos with RLS filtering`);
      return data as unknown as ApontamentoEquipe[];
      
    } catch (error) {
      if (retryCount >= maxRetries - 1) {
        console.error("❌ Final error in fetchSecureApontamentos:", error);
        throw error;
      }
      
      console.warn(`🔄 Retry ${retryCount + 1}/${maxRetries} after error:`, error);
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }

  // Fallback que nunca deve ser alcançado
  throw new Error('Unexpected end of retry loop');
};

// Fetch teams with automatic RLS filtering
export const fetchSecureEquipes = async () => {
  try {
    console.log('🔐 Fetching teams with RLS filtering...');
    
    const { data, error } = await supabase
      .from('bd_equipes')
      .select('*')
      .order('nome_equipe');
    
    if (error) {
      console.error("❌ Error fetching secure teams:", error);

      if (error.message?.includes('more than one relationship') || error.message?.includes('Could not embed')) {
        console.warn('🔗 Relationship error on equipes - using simple fallback select');
        const { data: simpleTeams, error: simpleErr } = await supabase
          .from('bd_equipes')
          .select('*')
          .order('nome_equipe');
        if (simpleErr) {
          console.error('❌ Fallback teams select failed:', simpleErr);
          throw simpleErr;
        }
        return simpleTeams || [];
      }

      throw error;
    }
    
    console.log(`✅ Fetched ${data?.length || 0} teams with RLS filtering`);
    return data || [];
    
  } catch (error) {
    console.error("❌ Error in fetchSecureEquipes:", error);
    throw error;
  }
};

// Check if user can access specific team
export const canAccessTeam = async (teamId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('bd_equipes')
      .select('id')
      .eq('id', teamId)
      .single();
    
    // If RLS allows access, data will be returned
    return !error && !!data;
  } catch (error) {
    console.error("❌ Error checking team access:", error);
    return false;
  }
};

// Simplified permission check - rely only on RLS
export const canCreateApontamentoForTeam = async (teamId: string): Promise<boolean> => {
  try {
    // Se o usuário pode acessar o time via RLS, pode criar apontamentos
    // A RLS já controla todas as permissões necessárias
    return await canAccessTeam(teamId);
  } catch (error) {
    console.error("❌ Error checking apontamento creation permission:", error);
    return false;
  }
};
