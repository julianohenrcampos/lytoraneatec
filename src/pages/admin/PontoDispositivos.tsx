import React, { useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Tablet } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import {
  usePontoDispositivos,
  useToggleAtivo,
  useTodosVinculosAtivos,
} from "@/hooks/usePontoDispositivos";
import { DispositivosTable } from "@/components/admin/ponto-dispositivos/DispositivosTable";
import { DispositivoFormDialog } from "@/components/admin/ponto-dispositivos/DispositivoFormDialog";
import { DefinirSenhaDialog } from "@/components/admin/ponto-dispositivos/DefinirSenhaDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { PontoDispositivoAdmin } from "@/services/pontoDispositivosService";

const PontoDispositivos: React.FC = () => {
  usePageTitle("Dispositivos de Ponto");
  const { isSuperAdmin, isLoading: permLoading } = usePermission();

  const { data: dispositivos = [], isLoading } = usePontoDispositivos();
  const { data: vinculos = [] } = useTodosVinculosAtivos();
  const toggleMut = useToggleAtivo();

  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativo" | "inativo">("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PontoDispositivoAdmin | null>(null);

  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaTarget, setSenhaTarget] = useState<PontoDispositivoAdmin | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<PontoDispositivoAdmin | null>(null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return dispositivos.filter((d) => {
      if (statusFilter === "ativo" && !d.ativo) return false;
      if (statusFilter === "inativo" && d.ativo) return false;
      if (!q) return true;
      return (
        d.nome?.toLowerCase().includes(q) ||
        d.codigo_dispositivo?.toLowerCase().includes(q)
      );
    });
  }, [dispositivos, busca, statusFilter]);

  if (permLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <MainLayout>
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Acesso restrito a SuperAdmins.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tablet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Dispositivos de Ponto</h2>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Dispositivo
          </Button>
        </div>

        <Card>
          <CardContent className="grid gap-3 pt-6 md:grid-cols-3">
            <Input
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end text-sm text-muted-foreground">
              {filtered.length} de {dispositivos.length}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DispositivosTable
            dispositivos={filtered}
            vinculos={vinculos}
            onEdit={(d) => {
              setEditing(d);
              setFormOpen(true);
            }}
            onDefinirSenha={(d) => {
              setSenhaTarget(d);
              setSenhaOpen(true);
            }}
            onToggleAtivo={(d) => setConfirmTarget(d)}
          />
        )}
      </div>

      <DispositivoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        dispositivo={editing}
      />

      <DefinirSenhaDialog
        open={senhaOpen}
        onOpenChange={setSenhaOpen}
        dispositivoId={senhaTarget?.id ?? null}
        dispositivoNome={senhaTarget?.nome}
      />

      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (!confirmTarget) return;
          await toggleMut.mutateAsync({
            id: confirmTarget.id,
            ativo: !confirmTarget.ativo,
          });
          setConfirmTarget(null);
        }}
        title={confirmTarget?.ativo ? "Desativar dispositivo?" : "Ativar dispositivo?"}
        description={
          confirmTarget?.ativo
            ? "Todas as sessões ativas serão revogadas imediatamente e novos logins serão bloqueados."
            : "O dispositivo voltará a aceitar logins operacionais."
        }
        confirmText={confirmTarget?.ativo ? "Desativar" : "Ativar"}
        variant={confirmTarget?.ativo ? "danger" : "info"}
        isLoading={toggleMut.isPending}
      />
    </MainLayout>
  );
};

export default PontoDispositivos;
