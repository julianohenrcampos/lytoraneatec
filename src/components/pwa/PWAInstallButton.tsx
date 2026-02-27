import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';

const manualInstructions: Record<string, { title: string; steps: { icon: string; text: string }[] }> = {
  ios: {
    title: 'Instalar LYTEC',
    steps: [
      { icon: '⬆️', text: 'Toque em "Compartilhar" na barra do Safari' },
      { icon: '➕', text: 'Selecione "Adicionar à Tela de Início"' },
      { icon: '✅', text: 'Toque em "Adicionar" para confirmar' },
    ],
  },
  android: {
    title: 'Instalar LYTEC',
    steps: [
      { icon: '⋮', text: 'Toque no menu do navegador (três pontos)' },
      { icon: '📥', text: 'Selecione "Instalar app" ou "Adicionar à tela inicial"' },
      { icon: '✅', text: 'Confirme a instalação' },
    ],
  },
  desktop: {
    title: 'Instalar LYTEC',
    steps: [
      { icon: '⊕', text: 'Clique no ícone de instalação na barra de endereço' },
      { icon: '⋮', text: 'Ou abra o menu do navegador e selecione "Instalar LYTEC"' },
      { icon: '✅', text: 'Confirme clicando em "Instalar"' },
    ],
  },
};

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className }) => {
  const { canInstall, install, platform } = usePWAInstall();
  const [showManual, setShowManual] = useState(false);
  const isMobile = useIsMobile();

  if (!canInstall) return null;

  const handleClick = async () => {
    const result = await install();
    if (result === 'manual') {
      setShowManual(true);
    }
  };

  const info = manualInstructions[platform] || manualInstructions.desktop;

  return (
    <>
      {/* Desktop: inline navbar button */}
      {!isMobile && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          className={`gap-1.5 ${className ?? ''}`}
        >
          <Download className="h-4 w-4" />
          <span>Instalar LYTEC</span>
        </Button>
      )}

      {/* Mobile: fixed pill bottom-right */}
      {isMobile && (
        <button
          onClick={handleClick}
          className="fixed bottom-5 right-4 z-50 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg active:scale-95 transition-transform"
        >
          <Download className="h-4 w-4" />
          Instalar
        </button>
      )}

      {/* Fallback manual modal */}
      {showManual && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {platform === 'desktop' ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                {info.title}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowManual(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {info.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <span className="text-xl flex-shrink-0">{step.icon}</span>
                  <p className="text-sm">{step.text}</p>
                </div>
              ))}
            </div>

            <Button onClick={() => setShowManual(false)} className="w-full">
              Entendi!
            </Button>
          </Card>
        </div>
      )}
    </>
  );
};
