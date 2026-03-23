import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Save, Upload, PenTool } from 'lucide-react';
import { useAssinaturaDigital } from '@/hooks/useAssinaturaDigital';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface AssinaturaDigitalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

export default function AssinaturaDigitalModal({ isOpen, onClose }: AssinaturaDigitalModalProps) {
  const { assinatura, signedUrl, salvarAssinatura, isSaving, hasAssinatura } = useAssinaturaDigital();

  const { data: profile } = useQuery({
    queryKey: ['profile-assinatura'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('nome_completo, cargo, funcoes')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: isOpen,
  });

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');
  const [uploadedImage, setUploadedImage] = useState<Blob | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (assinatura) {
      setNome(assinatura.nome_completo);
      setCpf(formatCPF(assinatura.cpf));
      setCargo(assinatura.cargo || '');
    } else if (profile) {
      setNome(profile.nome_completo || '');
      setCargo(profile.cargo || (Array.isArray(profile.funcoes) && profile.funcoes.length > 0 ? profile.funcoes[0] : '') || '');
    }
  }, [isOpen, assinatura, profile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('png') && !file.type.includes('image')) {
      toast.error('Selecione uma imagem PNG');
      return;
    }
    setUploadedImage(file);
    setUploadedPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!validateCPF(cpf)) { toast.error('CPF inválido'); return; }
    if (!uploadedImage && !hasAssinatura) { toast.error('Selecione uma imagem de assinatura'); return; }

    const blob = uploadedImage;
    if (!blob) { toast.error('Selecione uma nova imagem de assinatura'); return; }

    const cleanCpf = cpf.replace(/\D/g, '');
    await salvarAssinatura({ nome_completo: nome, cpf: cleanCpf, cargo, imageBlob: blob });
    setUploadedImage(null);
    setUploadedPreview(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PenTool className="h-5 w-5 text-primary" />
            Assinatura Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {hasAssinatura && signedUrl && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Assinatura atual</p>
                <img src={signedUrl} alt="Assinatura" className="max-h-20 border rounded-lg bg-white p-1" />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo">Cargo/Função</Label>
                <Input id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Imagem da assinatura *</Label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Clique para selecionar uma imagem PNG</span>
              <input type="file" accept="image/png,image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            {uploadedPreview && (
              <div className="border rounded-lg p-2 bg-white">
                <img src={uploadedPreview} alt="Preview" className="max-h-24 mx-auto" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar assinatura
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
