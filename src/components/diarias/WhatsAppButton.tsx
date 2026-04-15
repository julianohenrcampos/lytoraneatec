import React from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { registrarLogComunicacao } from "@/services/diarias/antiFraudeService";

interface WhatsAppButtonProps {
  telefone: string;
  mensagem: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** ID do funcionário para rastreio */
  funcionarioId?: string;
  /** Metadados extras para o log */
  metadata?: Record<string, any>;
}

export function WhatsAppButton({
  telefone,
  mensagem,
  className = '',
  variant = 'outline',
  size = 'default',
  funcionarioId,
  metadata
}: WhatsAppButtonProps) {
  const formatarTelefone = (tel: string): string => {
    const digits = tel.replace(/\D/g, '');
    if (digits.startsWith('55')) return digits;
    if (digits.length === 11 || digits.length === 10) return `55${digits}`;
    return digits;
  };

  const handleClick = async () => {
    const numero = formatarTelefone(telefone);
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

    // Registrar log de comunicação (rastreável)
    await registrarLogComunicacao({
      tipo: 'whatsapp',
      funcionarioId,
      destinatario: numero,
      mensagem,
      metadata
    });

    window.open(url, '_blank');
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700 ${className}`}
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      WhatsApp
    </Button>
  );
}
