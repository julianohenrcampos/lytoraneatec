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
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const definir = useDefinirSenha();

  const reset = () => {
    setSenha("");
    setConfirma("");
    setMostrar(false);
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

  const inputType = mostrar ? "text" : "password";

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
            <div className="relative">
              <Input
                id="senha"
                type={inputType}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={8}
                maxLength={128}
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {mostrar ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirma">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="confirma"
                type={inputType}
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                minLength={8}
                maxLength={128}
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {mostrar ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
