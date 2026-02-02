import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SimpleAuthGuardProps {
  children: React.ReactNode;
}

const SimpleAuthGuard: React.FC<SimpleAuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, userId, isPasswordRecovery } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);
  const verificationAttempted = useRef(false);

  console.log('🔐 [SimpleAuthGuard] Estado atual:', { 
    isAuthenticated, 
    isLoading, 
    userId, 
    shouldRedirect, 
    sessionVerified 
  });

  // Verificação adicional de sessão antes de redirecionar
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const verifySessionBeforeRedirect = async () => {
      // Se já está autenticado, tem sessão verificada ou carregando, não fazer nada
      if (isAuthenticated || isLoading || isPasswordRecovery || sessionVerified) {
        setShouldRedirect(false);
        return;
      }

      // Se já tentou verificar e não encontrou sessão, permitir redirect
      if (verificationAttempted.current) {
        setShouldRedirect(true);
        return;
      }

      // Marcar que estamos verificando
      setIsVerifying(true);
      verificationAttempted.current = true;
      
      console.log('🔍 [SimpleAuthGuard] Verificando sessão antes de redirecionar...');
      
      try {
        // Dar um tempo extra para o auth state se estabelecer
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Tentar obter sessão diretamente
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [SimpleAuthGuard] Erro ao verificar sessão:', error);
          setShouldRedirect(true);
          setIsVerifying(false);
          return;
        }

        if (session?.user) {
          console.log('✅ [SimpleAuthGuard] Sessão encontrada na verificação!');
          // Forçar estado de sessão verificada
          setSessionVerified(true);
          setShouldRedirect(false);
          setIsVerifying(false);
          return;
        }
        
        // Nenhuma sessão encontrada após verificação
        console.log('⚠️ [SimpleAuthGuard] Nenhuma sessão válida encontrada');
        setShouldRedirect(true);
      } catch (err) {
        console.error('❌ [SimpleAuthGuard] Erro na verificação:', err);
        setShouldRedirect(true);
      } finally {
        setIsVerifying(false);
      }
    };

    // Só verificar se não está autenticado e não está carregando
    if (!isAuthenticated && !isLoading && !isPasswordRecovery && !sessionVerified) {
      // Pequeno delay antes de iniciar verificação
      timeoutId = setTimeout(verifySessionBeforeRedirect, 150);
    } else {
      // Reset do estado quando autenticado
      verificationAttempted.current = false;
      setShouldRedirect(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, isLoading, isPasswordRecovery, sessionVerified]);

  // Timeout de segurança para estado intermediário (evitar deadlock)
  useEffect(() => {
    let fallbackTimer: NodeJS.Timeout | null = null;

    // Só ativar se estiver no estado intermediário problemático
    const isIntermediateState = !isLoading && !isVerifying && !isAuthenticated && 
                                 !shouldRedirect && !sessionVerified;
    
    if (isIntermediateState) {
      console.log('⏱️ [SimpleAuthGuard] Estado intermediário detectado, iniciando timeout de 2s...');
      
      fallbackTimer = setTimeout(async () => {
        console.log('⏱️ [SimpleAuthGuard] Timeout de segurança atingido, verificando sessão...');
        
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ [SimpleAuthGuard] Erro no fallback:', error);
            setShouldRedirect(true);
            return;
          }
          
          if (session?.user) {
            console.log('✅ [SimpleAuthGuard] Sessão válida encontrada no fallback - permitindo acesso');
            setSessionVerified(true);
            setShouldRedirect(false);
          } else {
            console.log('⚠️ [SimpleAuthGuard] Sem sessão no fallback, redirecionando...');
            setShouldRedirect(true);
          }
        } catch (err) {
          console.error('❌ [SimpleAuthGuard] Erro no timeout:', err);
          setShouldRedirect(true);
        }
      }, 2000);
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [isLoading, isVerifying, isAuthenticated, shouldRedirect, sessionVerified]);

  // ============== RENDERIZAÇÃO ==============

  // Estado de loading inicial
  if (isLoading || isVerifying) {
    console.log('🔐 [SimpleAuthGuard] Ainda carregando/verificando auth...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  // Sessão verificada via fallback - permitir acesso imediatamente
  if (sessionVerified) {
    console.log('✅ [SimpleAuthGuard] Sessão verificada via fallback - renderizando children');
    return <>{children}</>;
  }

  // Usuário autenticado via hook useAuth
  if (isAuthenticated && userId) {
    console.log('✅ [SimpleAuthGuard] Usuário autenticado via hook');
    return <>{children}</>;
  }

  // Modo de recovery de senha - permitir acesso
  if (isPasswordRecovery) {
    console.log('🔄 [SimpleAuthGuard] Modo recovery - permitindo acesso');
    return <>{children}</>;
  }

  // Redirecionar para login se determinado após verificação
  if (shouldRedirect) {
    console.log('🔄 [SimpleAuthGuard] Redirecionando para login');
    return <Navigate to="/login" replace />;
  }

  // Estado intermediário - aguardando timeout de segurança (máx 2s)
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="ml-2">Verificando autenticação...</span>
    </div>
  );
};

export default SimpleAuthGuard;
