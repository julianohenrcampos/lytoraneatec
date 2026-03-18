
import React, { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export type CenterAlertType = "success" | "error" | "warning";

interface CenterAlertProps {
  isOpen: boolean;
  message: string;
  type?: CenterAlertType;
  duration?: number;
  onClose: () => void;
}

const CenterAlert: React.FC<CenterAlertProps> = ({
  isOpen,
  message,
  type = "success",
  duration = 2500,
  onClose,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen && !visible) return null;

  const iconMap = {
    success: <CheckCircle className="h-12 w-12 text-green-500" />,
    error: <XCircle className="h-12 w-12 text-destructive" />,
    warning: <AlertTriangle className="h-12 w-12 text-yellow-500" />,
  };

  const borderMap = {
    success: "border-green-500",
    error: "border-destructive",
    warning: "border-yellow-500",
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-background rounded-xl shadow-2xl p-8 text-center max-w-sm mx-4 border-2 ${borderMap[type]} transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">{iconMap[type]}</div>
        <p className="text-lg font-semibold text-foreground">{message}</p>
      </div>
    </div>
  );
};

export default CenterAlert;
