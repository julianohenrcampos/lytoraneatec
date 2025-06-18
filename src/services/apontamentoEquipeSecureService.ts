
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

// Fetch apontamentos with automatic RLS filtering
export const fetchSecureApontamentos = async (filters: ApontamentoEquipeFilters = {}): Promise<ApontamentoEquipe[]> => {
  try {
    console.log('🔐 Fetching apontamentos with RLS filtering...');
    
    let query = supabase
      .from("bd_apontamento_equipe")
      .select(`
        *,
        equipe:equipe_id (
          *,
          encarregado:encarregado_id (id, nome_completo),
          apontador:apontador_id (id, nome_completo)
        ),
        colaborador:colaborador_id (
          id, nome_completo
        ),
        lista_entrega:lista_entrega_id (*)
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
      console.error("❌ Error fetching secure apontamentos:", error);
      throw error;
    }
    
    console.log(`✅ Fetched ${data?.length || 0} apontamentos with RLS filtering`);
    return data as unknown as ApontamentoEquipe[];
    
  } catch (error) {
    console.error("❌ Error in fetchSecureApontamentos:", error);
    throw error;
  }
};

// Fetch teams with automatic RLS filtering
export const fetchSecureEquipes = async () => {
  try {
    console.log('🔐 Fetching teams with RLS filtering...');
    
    const { data, error } = await supabase
      .from('bd_equipes')
      .select(`
        *,
        encarregado:encarregado_id (id, nome_completo),
        apontador:apontador_id (id, nome_completo)
      `)
      .order('nome_equipe');
    
    if (error) {
      console.error("❌ Error fetching secure teams:", error);
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

// Check if user can create apontamento for specific team
export const canCreateApontamentoForTeam = async (teamId: string): Promise<boolean> => {
  try {
    // Try to access the team - if RLS allows it, user can create apontamentos
    const canAccess = await canAccessTeam(teamId);
    
    // Additional check: verify user role allows creation
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) return false;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('funcoes')
      .eq('id', currentUser.user.id)
      .single();
    
    if (!profile?.funcoes) return false;
    
    // Only certain roles can create apontamentos
    const allowedRoles = ['SuperAdm', 'AdmRH', 'Apontador', 'Encarregado'];
    const hasAllowedRole = profile.funcoes.some(role => allowedRoles.includes(role));
    
    return canAccess && hasAllowedRole;
  } catch (error) {
    console.error("❌ Error checking apontamento creation permission:", error);
    return false;
  }
};
