import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useDefinirSenha } from "@/hooks/usePontoDispositivos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dispositivoId: string | null;
  dispositivoNome?: string;
}

export function DefinirSenhaDialog({
  open,
  onOpenChange,
  dispositivoId,
  dispositivoNome,
}: Props) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const definir = useDefinirSenha();

  const reset = () => {
    setSenha("");
    setConfirma("");
    setErro(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não coincidem");
      return;
    }
    if (!dispositivoId) return;
    try {
      await definir.mutateAsync({ id: dispositivoId, senha });
      reset();
      onOpenChange(false);
    } catch {
      // toast já tratado no hook
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Definir Senha</DialogTitle>
          <DialogDescription>
            {dispositivoNome
              ? `Defina a senha do dispositivo "${dispositivoNome}".`
              : "Defina a senha do dispositivo."}{" "}
            Mínimo de 8 caracteres.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              minLength={8}
              maxLength={128}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirma">Confirmar senha</Label>
            <Input
              id="confirma"
              type="password"
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              minLength={8}
              maxLength={128}
            />
          </div>

          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={definir.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={definir.isPending}>
              {definir.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar Senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
