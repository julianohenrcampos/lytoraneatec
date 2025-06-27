
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserDataAccess {
  allowedTeamIds: string[];
  userRole: string | null;
  canAccessAllTeams: boolean;
  isLoading: boolean;
}

const TEAMS_CACHE_KEY = 'user_teams_cache';
const TEAMS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

export const useUserDataAccessStable = (userId?: string | null, userRole?: string | null, isSuperAdmin?: boolean): UserDataAccess => {
  const [dataAccess, setDataAccess] = useState<UserDataAccess>({
    allowedTeamIds: [],
    userRole: null,
    canAccessAllTeams: false,
    isLoading: true,
  });

  const loadingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!userId || !userRole || loadingRef.current) return;
    loadingRef.current = true;

    const loadTeamAccess = async () => {
      try {
        // Verificar cache
        const cacheKey = `${TEAMS_CACHE_KEY}_${userId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < TEAMS_CACHE_DURATION) {
            console.log('🛡️ Using cached team access');
            setDataAccess({ ...data, isLoading: false });
            loadingRef.current = false;
            return;
          }
        }

        // Timeout de segurança
        timeoutRef.current = setTimeout(() => {
          console.warn('⏰ Team access timeout - sem acesso');
          setDataAccess({
            allowedTeamIds: [],
            userRole,
            canAccessAllTeams: false,
            isLoading: false,
          });
          loadingRef.current = false;
        }, 2000);

        const canAccessAll = isSuperAdmin || userRole === 'AdmRH' || userRole === 'Administrador';

        if (canAccessAll) {
          const { data: allTeams } = await supabase
            .from('bd_equipes')
            .select('id');
          
          clearTimeout(timeoutRef.current);
          
          const finalData = {
            allowedTeamIds: allTeams?.map(team => team.id) || [],
            userRole,
            canAccessAllTeams: true,
            isLoading: false,
          };

          // Cache
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: finalData,
            timestamp: Date.now()
          }));

          setDataAccess(finalData);
          loadingRef.current = false;
          return;
        }

        // Para outros usuários, buscar por email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();

        if (!profile?.email) {
          clearTimeout(timeoutRef.current);
          setDataAccess({
            allowedTeamIds: [],
            userRole,
            canAccessAllTeams: false,
            isLoading: false,
          });
          loadingRef.current = false;
          return;
        }

        // Query otimizada para equipes do usuário
        const { data: teams } = await supabase
          .from('bd_equipes')
          .select(`
            id,
            apontador:apontador_id(email),
            encarregado:encarregado_id(email)
          `);

        const allowedTeams = teams?.filter(team => {
          // Lidar com arrays ou objetos únicos retornados pelo Supabase
          // Usar type assertion para resolver o problema de tipos
          const apontadorEmail = Array.isArray(team.apontador) 
            ? (team.apontador as any)?.[0]?.email 
            : (team.apontador as any)?.email;
          const encarregadoEmail = Array.isArray(team.encarregado) 
            ? (team.encarregado as any)?.[0]?.email 
            : (team.encarregado as any)?.email;
          
          return apontadorEmail === profile.email || encarregadoEmail === profile.email;
        }).map(team => team.id) || [];

        clearTimeout(timeoutRef.current);

        const finalData = {
          allowedTeamIds: allowedTeams,
          userRole,
          canAccessAllTeams: false,
          isLoading: false,
        };

        // Cache
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data: finalData,
          timestamp: Date.now()
        }));

        setDataAccess(finalData);
        loadingRef.current = false;

        console.log('✅ Team access loaded:', {
          teams: allowedTeams.length,
          canAccessAll: false
        });

      } catch (error) {
        console.error('❌ Error loading team access:', error);
        clearTimeout(timeoutRef.current);
        
        setDataAccess({
          allowedTeamIds: [],
          userRole,
          canAccessAllTeams: false,
          isLoading: false,
        });
        loadingRef.current = false;
      }
    };

    loadTeamAccess();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      loadingRef.current = false;
    };
  }, [userId, userRole, isSuperAdmin]);

  return dataAccess;
};
