
import { useState, useEffect } from 'react';
import { fetchCurrentUser, updateUserProfileImage } from '@/services/userService';
import { useToast } from '@/hooks/use-toast';

export const useUserProfile = () => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await fetchCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleUpdateUserImage = async (file: File): Promise<void> => {
    if (!user) return;
    
    try {
      const imageUrl = await updateUserProfileImage(user.id, file);
      setUser({
        ...user,
        imagem_url: imageUrl
      });
    } catch (error) {
      console.error("Error updating user image:", error);
      toast({
        title: "Error updating image",
        description: "There was a problem updating your profile image.",
        variant: "destructive",
      });
    }
  };

  return {
    user,
    isLoading,
    updateUserImage: handleUpdateUserImage
  };
};
