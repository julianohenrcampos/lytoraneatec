
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { handleFormSubmission } from "@/utils/registroAplicacaoSubmit";

/**
 * Custom hook for handling form submission
 */
export const useFormSubmission = (onSuccess?: () => void) => {
  const { toast, dismiss } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmitHandler = async (data: RegistroAplicacaoSchema) => {
    setIsLoading(true);
    try {
      await handleFormSubmission(data, { toast: { toast, dismiss } }, onSuccess);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    onSubmit: onSubmitHandler,
    toast
  };
};
