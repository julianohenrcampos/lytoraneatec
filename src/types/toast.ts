
export interface ToastApi {
  toast: (props: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
    duration?: number;
  }) => {
    id: string;
    dismiss: () => void;
    update: (props: any) => void;
  };
  dismiss: (toastId?: string) => void;
}
