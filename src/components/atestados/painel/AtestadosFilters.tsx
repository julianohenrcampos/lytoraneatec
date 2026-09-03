import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_DOCUMENTO, TIPO_ATESTADO_MEDICO } from "@/constants/atestadosTiposDocumento";
import { SISTEMAS_AFETADOS } from "@/constants/atestadosSistemasAfetados";
import type { AtestadosPainelFilters } from "@/types/atestadoMedico";

interface Props {
  value: AtestadosPainelFilters;
  onChange: (v: AtestadosPainelFilters) => void;
}

export default function AtestadosFilters({ value, onChange }: Props) {
  const set = <K extends keyof AtestadosPainelFilters>(
    k: K,
    v: AtestadosPainelFilters[K]
  ) => onChange({ ...value, [k]: v });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="f-inicio">Enviado de</Label>
            <Input
              id="f-inicio"
              type="date"
              value={value.data_inicio ?? ""}
              onChange={(e) => set("data_inicio", e.target.value || undefined)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-fim">Enviado até</Label>
            <Input
              id="f-fim"
              type="date"
              value={value.data_fim ?? ""}
              onChange={(e) => set("data_fim", e.target.value || undefined)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Select
              value={value.prazo ?? "todos"}
              onValueChange={(v) => set("prazo", v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="dentro">Dentro de 24h</SelectItem>
                <SelectItem value="fora">Fora do prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de documento</Label>
            <Select
              value={value.tipo_documento ?? "todos"}
              onValueChange={(v) =>
                set("tipo_documento", v === "todos" ? undefined : v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS_DOCUMENTO.map((t) => (
                  <SelectItem key={t.codigo} value={t.codigo}>
                    {t.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Setor destino</Label>
            <Select
              value={value.setor_destino ?? "todos"}
              onValueChange={(v) =>
                set("setor_destino", v as AtestadosPainelFilters["setor_destino"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="saude">Saúde (SSO)</SelectItem>
                <SelectItem value="dp">Departamento Pessoal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={value.status ?? "todos"}
              onValueChange={(v) => set("status", v === "todos" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="validado">Validado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status de e-mail</Label>
            <Select
              value={value.status_email ?? "todos"}
              onValueChange={(v) =>
                set("status_email", v === "todos" ? undefined : v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-cc">Centro de custo</Label>
            <Input
              id="f-cc"
              placeholder="Ex.: CONM104"
              value={value.centro_custo ?? ""}
              onChange={(e) => set("centro_custo", e.target.value || undefined)}
            />
          </div>
          {(!value.tipo_documento ||
            value.tipo_documento === "todos" ||
            value.tipo_documento === TIPO_ATESTADO_MEDICO) && (
            <div className="space-y-1.5">
              <Label>Sistema afetado</Label>
              <Select
                value={value.sistema_afetado ?? "todos"}
                onValueChange={(v) =>
                  set("sistema_afetado", v === "todos" ? undefined : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {SISTEMAS_AFETADOS.map((s) => (
                    <SelectItem key={s.codigo} value={s.codigo}>
                      {s.codigo} — {s.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="f-busca">Buscar</Label>
            <Input
              id="f-busca"
              placeholder="Protocolo, nome ou matrícula"
              value={value.busca ?? ""}
              onChange={(e) => set("busca", e.target.value || undefined)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
