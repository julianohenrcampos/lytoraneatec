
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Core hook for handling authentication state
 * Provides user authentication information and session management
 */
export const useAuth = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuthState = async () => {
      try {
        setIsLoading(true);
        setAuthError(null);
        
        // Get current session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("❌ Error getting session:", sessionError);
          setAuthError(sessionError.message);
          setUserId(null);
          return;
        }
        
        if (!sessionData.session) {
          console.log("No active session found");
          setUserId(null);
          return;
        }
        
        const currentUserId = sessionData.session.user.id;
        setUserId(currentUserId);
        
        console.log("Auth state loaded for user:", currentUserId);
      } catch (error: any) {
        console.error("❌ Exception in auth state fetch:", error);
        setAuthError(error.message || "Unknown authentication error");
        setUserId(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAuthState();
    
    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event);
        
        if (event === "SIGNED_IN" && session) {
          setUserId(session.user.id);
          setAuthError(null);
          console.log("User signed in:", session.user.id);
        } else if (event === "SIGNED_OUT") {
          setUserId(null);
          console.log("User signed out");
        } else if (event === "USER_UPDATED" && session) {
          setUserId(session.user.id);
          console.log("User updated:", session.user.id);
        } else if (event === "PASSWORD_RECOVERY") {
          console.log("Password recovery event received");
        }
      }
    );
    
    return () => {
      // Clean up subscription
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  return {
    userId,
    isAuthenticated: !!userId,
    isLoading,
    authError
  };
};
