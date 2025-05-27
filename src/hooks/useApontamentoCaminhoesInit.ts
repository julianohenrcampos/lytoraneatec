
import { useEffect } from 'react';
import { setupVeiculosStorage } from '@/integrations/supabase/setupStorage';

export const useApontamentoCaminhoesInit = () => {
  useEffect(() => {
    // Initialize storage buckets if they don't exist
    setupVeiculosStorage();
  }, []);
};
