// =====================================================
// COMPONENT: Aba "Permissões Individuais (Override)"
// Permite que SuperAdm conceda ou bloqueie ações específicas
// para um usuário sem alterar a role dele.
// Hierarquia: SuperAdm bypass > Override (DENY vence) > Role
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, ShieldAlert, ShieldCheck, Minus } from "lucide-react";
import {
  fetchAllPermissions,
  fetchOverridesByUser,
  fetchRoleActionsForUser,
  setOverride,
  removeOverride,
  clearAllOverrides,
  type Acao,
  type PermissionWithActions,
  type UserPermissionOverride,
} from "@/services/rbac/userOverridesService";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ActionGuard from "./ActionGuard";
import { usePermission } from "@/hooks/usePermission";

const ACOES: Acao[] = ["visualizar", "criar", "editar", "excluir", "aprovar"];

type EstadoCelula =
  | { tipo: "herdado"; permitidoNaRole: boolean }
  | { tipo: "override_allow" }
  | { tipo: "override_deny" };

interface PerfilOpcao {
  id: string;
  nome_completo: string | null;
  email: string | null;
}

const UserOverridesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasActionPermission } = usePermission();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [filtro, setFiltro] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Carregar perfis (usuários cadastrados)
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["overrides-profiles-list"],
    queryFn: async (): Promise<PerfilOpcao[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo, email")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data || []) as PerfilOpcao[];
    },
    staleTime: 60_000,
  });

  // Permissões disponíveis no sistema
  const { data: permissions = [], isLoading: loadingPermissions } = useQuery({
    queryKey: ["overrides-all-permissions"],
    queryFn: fetchAllPermissions,
    staleTime: 60_000,
  });

  // Overrides do usuário selecionado
  const { data: overrides = [], isLoading: loadingOverrides } = useQuery({
    queryKey: ["overrides-by-user", selectedUserId],
    queryFn: () => fetchOverridesByUser(selectedUserId),
    enabled: !!selectedUserId,
  });

  // Permissões/ações herdadas da role
  const { data: roleActions = [], isLoading: loadingRoleActions } = useQuery({
    queryKey: ["overrides-role-actions", selectedUserId],
    queryFn: () => fetchRoleActionsForUser(selectedUserId),
    enabled: !!selectedUserId,
  });

  const userOptions = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: `${p.nome_completo || "Sem nome"} (${p.email || "sem email"})`,
      })),
    [profiles]
  );

  // Index lookups
  const overridesIndex = useMemo(() => {
    const map = new Map<string, UserPermissionOverride>();
    overrides.forEach((o) =>
      map.set(`${o.permission_id}:${o.acao}`, o)
    );
    return map;
  }, [overrides]);

  const roleActionsIndex = useMemo(() => {
    const set = new Set<string>();
    roleActions.forEach((r) => set.add(`${r.permissionCode}:${r.acao}`));
    return set;
  }, [roleActions]);

  // Permissões filtradas
  const permissionsFiltradas = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    if (!term) return permissions;
    return permissions.filter(
      (p) =>
        p.codigo.toLowerCase().includes(term) ||
        p.nome.toLowerCase().includes(term) ||
        (p.modulo || "").toLowerCase().includes(term)
    );
  }, [permissions, filtro]);

  function getEstado(perm: PermissionWithActions, acao: Acao): EstadoCelula {
    const ovr = overridesIndex.get(`${perm.id}:${acao}`);
    if (ovr) {
      return ovr.permitido
        ? { tipo: "override_allow" }
        : { tipo: "override_deny" };
    }
    const herdado = roleActionsIndex.has(`${perm.codigo}:${acao}`);
    return { tipo: "herdado", permitidoNaRole: herdado };
  }

  // Toggle 3 estados: herdado -> allow -> deny -> herdado
  async function ciclarEstado(perm: PermissionWithActions, acao: Acao) {
    if (!selectedUserId) return;
    if (!hasActionPermission("admin_permissoes_view", "editar")) {
      toast.error("Você não tem permissão para esta ação.");
      return;
    }
    const estado = getEstado(perm, acao);
    const key = `${perm.id}:${acao}`;
    setSavingKey(key);

    try {
      if (estado.tipo === "herdado") {
        await setOverride(selectedUserId, perm.id, acao, true);
        toast.success(`Override LIBERADO para "${perm.codigo}/${acao}"`);
      } else if (estado.tipo === "override_allow") {
        await setOverride(selectedUserId, perm.id, acao, false);
        toast.success(`Override BLOQUEADO para "${perm.codigo}/${acao}"`);
      } else {
        await removeOverride(selectedUserId, perm.id, acao);
        toast.success(`Override removido (volta a herdar da role)`);
      }
      await queryClient.invalidateQueries({
        queryKey: ["overrides-by-user", selectedUserId],
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar override");
    } finally {
      setSavingKey(null);
    }
  }

  async function limparTodos() {
    if (!selectedUserId) return;
    if (!hasActionPermission("admin_permissoes_view", "excluir")) {
      toast.error("Você não tem permissão para esta ação.");
      setConfirmClearOpen(false);
      return;
    }
    try {
      await clearAllOverrides(selectedUserId);
      toast.success("Todos os overrides do usuário foram removidos");
      await queryClient.invalidateQueries({
        queryKey: ["overrides-by-user", selectedUserId],
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao limpar overrides");
    } finally {
      setConfirmClearOpen(false);
    }
  }

  // Reset filtro ao trocar usuário
  useEffect(() => {
    setFiltro("");
  }, [selectedUserId]);

  const totalOverridesAtivos = overrides.length;
  const usuarioSelecionado = profiles.find((p) => p.id === selectedUserId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Permissões Individuais (Override)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <p className="font-medium">Como funciona</p>
            <ul className="list-disc ml-4 text-muted-foreground space-y-0.5">
              <li>
                <strong>SuperAdm</strong> sempre tem acesso total — overrides são
                ignorados para esta role.
              </li>
              <li>
                <strong>Override BLOQUEADO</strong> (vermelho) vence sobre a role —
                mesmo que a função permita, o usuário fica sem acesso.
              </li>
              <li>
                <strong>Override LIBERADO</strong> (verde) concede acesso pontual sem
                alterar a função.
              </li>
              <li>
                <strong>Herdado</strong> (cinza) — comportamento segue exatamente a
                role do usuário.
              </li>
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-xs font-medium">Selecionar usuário</label>
              <Combobox
                options={userOptions}
                value={selectedUserId}
                onChange={setSelectedUserId}
                placeholder="Escolha um usuário..."
                searchPlaceholder="Buscar por nome ou email..."
                emptyText="Nenhum usuário encontrado"
                disabled={loadingProfiles}
              />
            </div>
            <div>
              <label className="text-xs font-medium">
                Filtrar permissões
              </label>
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Filtrar por código, nome ou módulo..."
                className="h-10"
                disabled={!selectedUserId}
              />
            </div>
          </div>

          {selectedUserId && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Usuário:</span>
                <span className="font-medium">
                  {usuarioSelecionado?.nome_completo || "—"}
                </span>
                <Badge variant="outline" className="text-xs">
                  {totalOverridesAtivos} override(s) ativo(s)
                </Badge>
              </div>
              {totalOverridesAtivos > 0 && (
                <ActionGuard permission="admin_permissoes_view" action="excluir">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmClearOpen(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpar todos os overrides
                  </Button>
                </ActionGuard>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedUserId ? (
        <div className="text-center py-12 text-muted-foreground border rounded-md">
          Selecione um usuário para gerenciar overrides individuais.
        </div>
      ) : loadingPermissions || loadingOverrides || loadingRoleActions ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ActionGuard permission="admin_permissoes_view" action="editar" disableOnly>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium w-[35%]">
                      Permissão
                    </th>
                    {ACOES.map((a) => (
                      <th
                        key={a}
                        className="text-center p-3 font-medium capitalize"
                      >
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissionsFiltradas.length === 0 && (
                    <tr>
                      <td
                        colSpan={ACOES.length + 1}
                        className="text-center text-muted-foreground py-8"
                      >
                        Nenhuma permissão encontrada para o filtro.
                      </td>
                    </tr>
                  )}
                  {permissionsFiltradas.map((perm) => (
                    <tr key={perm.id} className="border-b hover:bg-muted/20">
                      <td className="p-3">
                        <div className="font-medium">{perm.nome}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {perm.codigo}
                        </div>
                        {perm.modulo && (
                          <Badge variant="secondary" className="text-[10px] mt-1">
                            {perm.modulo}
                          </Badge>
                        )}
                      </td>
                      {ACOES.map((acao) => {
                        const estado = getEstado(perm, acao);
                        const key = `${perm.id}:${acao}`;
                        const isSaving = savingKey === key;

                        let icone = <Minus className="h-4 w-4" />;
                        let classe =
                          "border-input bg-background hover:bg-muted text-muted-foreground";
                        let titulo = "Herdado da role";

                        if (estado.tipo === "override_allow") {
                          icone = <ShieldCheck className="h-4 w-4" />;
                          classe =
                            "border-green-300 bg-green-100 hover:bg-green-200 text-green-700 dark:border-green-700 dark:bg-green-900/40 dark:text-green-300";
                          titulo = "LIBERADO via override (vence a role)";
                        } else if (estado.tipo === "override_deny") {
                          icone = <ShieldAlert className="h-4 w-4" />;
                          classe =
                            "border-red-300 bg-red-100 hover:bg-red-200 text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-300";
                          titulo = "BLOQUEADO via override (vence a role)";
                        } else if (estado.tipo === "herdado") {
                          if (estado.permitidoNaRole) {
                            classe =
                              "border-input bg-background hover:bg-muted text-foreground";
                            titulo = "Herdado da role: PERMITIDO";
                            icone = <Minus className="h-4 w-4 opacity-50" />;
                          }
                        }

                        return (
                          <td key={acao} className="text-center p-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => ciclarEstado(perm, acao)}
                              title={titulo}
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors disabled:opacity-50 ${classe}`}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                icone
                              )}
                            </button>
                            {estado.tipo === "herdado" &&
                              estado.permitidoNaRole && (
                                <div className="text-[9px] text-muted-foreground mt-0.5">
                                  role
                                </div>
                              )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </ActionGuard>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={limparTodos}
        title="Limpar todos os overrides"
        description={`Remover todos os ${totalOverridesAtivos} overrides individuais deste usuário? Ele voltará a herdar permissões exclusivamente da role.`}
        confirmText="Limpar todos"
        variant="warning"
      />
    </div>
  );
};

export default UserOverridesTab;
