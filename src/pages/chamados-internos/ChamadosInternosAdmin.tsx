/**
 * Configuração de Chamados Internos.
 * Abas:
 *  - Atendentes: listar/vincular/desativar por setor (RPCs fn_chamado_interno_atendente_*)
 *  - Categorias: SOMENTE LEITURA (bd_chamado_interno_categorias)
 */
import React from "react";
import { toast } from "sonner";
import { Loader2, Plus, Settings, Trash2 } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

import {
  useChamadoInternoAtendentesSetor,
  useChamadoInternoAtendenteVincular,
  useChamadoInternoAtendenteDesativar,
  useChamadoInternoCategorias,
  useChamadoInternoProfilesAdmin,
} from "@/hooks/useChamadosInternos";
import {
  PrioridadeBadge,
  SetorBadge,
} from "@/components/chamados-internos/StatusBadges";
import { CategoriaIcon } from "@/components/chamados-internos/CategoriaIcon";
import { CHAMADO_INTERNO_SETOR_META } from "@/constants/chamadosInternos";
import type { ChamadoInternoSetor, ChamadosInternosError } from "@/types/chamadosInternos";

const isError = (e: unknown): e is ChamadosInternosError =>
  !!e && typeof e === "object" && "message" in (e as Record<string, unknown>);

const SETORES = (Object.entries(CHAMADO_INTERNO_SETOR_META) as Array<
  [ChamadoInternoSetor, { label: string; ordem: number }]
>).sort((a, b) => a[1].ordem - b[1].ordem);

const ChamadosInternosAdmin: React.FC = () => {
  usePageTitle("Configuração de Chamados Internos");

  const [setor, setSetor] = React.useState<ChamadoInternoSetor>("administracao");
  const [busca, setBusca] = React.useState("");
  const [profileEscolhido, setProfileEscolhido] = React.useState("");

  const atendentesQ = useChamadoInternoAtendentesSetor(setor);
  const profilesQ = useChamadoInternoProfilesAdmin(busca);
  const categoriasQ = useChamadoInternoCategorias();
  const vincularM = useChamadoInternoAtendenteVincular();
  const desativarM = useChamadoInternoAtendenteDesativar();

  const profileOptions: ComboboxOption[] = React.useMemo(
    () =>
      (profilesQ.data ?? []).map((p) => ({
        value: p.id,
        label: p.nome_completo ?? p.email ?? p.id,
        searchText: `${p.nome_completo ?? ""} ${p.email ?? ""}`,
      })),
    [profilesQ.data],
  );

  const vincular = async () => {
    if (!profileEscolhido) return;
    try {
      await vincularM.mutateAsync({ profileId: profileEscolhido, setor });
      toast.success("Atendente vinculado");
      setProfileEscolhido("");
    } catch (e) {
      const err = isError(e) ? e : null;
      toast.error(err?.message ?? "Falha ao vincular");
    }
  };

  const desativar = async (vinculoId: string) => {
    try {
      await desativarM.mutateAsync({ vinculoId, setor });
      toast.success("Vínculo desativado");
    } catch (e) {
      const err = isError(e) ? e : null;
      toast.error(err?.message ?? "Falha ao desativar");
    }
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Configuração de Chamados Internos
            </CardTitle>
            <CardDescription>
              Vincule atendentes por setor e consulte o catálogo de categorias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="atendentes">
              <TabsList>
                <TabsTrigger value="atendentes">Atendentes por setor</TabsTrigger>
                <TabsTrigger value="categorias">Categorias</TabsTrigger>
              </TabsList>

              <TabsContent value="atendentes" className="mt-3 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Setor</Label>
                    <Select value={setor} onValueChange={(v) => setSetor(v as ChamadoInternoSetor)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SETORES.map(([k, m]) => (
                          <SelectItem key={k} value={k}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label>Buscar profile</Label>
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Nome ou email"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Profile</Label>
                    <div className="flex gap-2">
                      <Combobox
                        options={profileOptions}
                        value={profileEscolhido}
                        onChange={setProfileEscolhido}
                        placeholder={
                          profilesQ.isLoading ? "Carregando..." : "Selecione um profile"
                        }
                        emptyText="Nenhum profile encontrado"
                        searchPlaceholder="Filtrar..."
                        className="flex-1"
                      />
                      <Button
                        onClick={vincular}
                        disabled={!profileEscolhido || vincularM.isPending}
                      >
                        {vincularM.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Vincular
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border">
                  {atendentesQ.isLoading ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando atendentes...
                    </div>
                  ) : (atendentesQ.data ?? []).filter((a) => a.ativo).length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Nenhum atendente vinculado a este setor.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Funcionário</TableHead>
                          <TableHead>Vinculado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(atendentesQ.data ?? [])
                          .filter((a) => a.ativo)
                          .map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium">
                                {a.profile_nome ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {a.funcionario_nome_completo ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(a.created_at).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => desativar(a.id)}
                                  disabled={desativarM.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="categorias" className="mt-3">
                <div className="mb-2 text-xs text-muted-foreground">
                  Catálogo institucional (somente leitura). Alterações são feitas por migration.
                </div>
                <div className="rounded-md border">
                  {categoriasQ.isLoading ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando categorias...
                    </div>
                  ) : (categoriasQ.data ?? []).length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma categoria cadastrada.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Setor</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>SLA (h)</TableHead>
                          <TableHead>Ativa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(categoriasQ.data ?? []).map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CategoriaIcon codigo={c.codigo} size={16} className="text-primary" />
                                <span className="font-medium">{c.nome}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                            <TableCell><SetorBadge setor={c.setor} /></TableCell>
                            <TableCell><PrioridadeBadge prioridade={c.prioridade_padrao} /></TableCell>
                            <TableCell>{c.sla_horas ?? "—"}</TableCell>
                            <TableCell className="text-xs">
                              {c.ativo ? "Sim" : "Não"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ChamadosInternosAdmin;
