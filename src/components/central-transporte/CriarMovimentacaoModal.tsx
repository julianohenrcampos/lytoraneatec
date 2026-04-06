import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { criarMovimentacao, criarTransporteDetalhado } from "@/services/movimentacaoService";
import { toast } from "sonner";

interface Props {
  open: boolean;
  solicitacaoId: string;
  planejamentoId?: string;
  tipoAtendimento: string;
  tipoEquipamentoId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const CriarMovimentacaoModal: React.FC<Props> = ({
  open, solicitacaoId, planejamentoId, tipoAtendimento, tipoEquipamentoId, onClose, onSaved
}) => {
  const [saving, setSaving] = useState(false);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);

  const [equipamentoId, setEquipamentoId] = useState("");
  const [origemTipo, setOrigemTipo] = useState("INTERNO");
  const [origemId, setOrigemId] = useState("");
  const [destinoTipo, setDestinoTipo] = useState("INTERNO");
  const [destinoId, setDestinoId] = useState("");
  const [tipoDeslocamento, setTipoDeslocamento] = useState("PRANCHA");
  const [responsavelTransporte, setResponsavelTransporte] = useState("PROPRIO");
  const [distanciaKm, setDistanciaKm] = useState("");
  const [valorKm, setValorKm] = useState("");
  const [prazoHoras, setPrazoHoras] = useState("");

  // Transporte detalhado
  const [tipoTransporte, setTipoTransporte] = useState("PRANCHA");
  const [caminhaoId, setCaminhaoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [motoristaNome, setMotoristaNome] = useState("");
  const [motoristaCpf, setMotoristaCpf] = useState("");
  const [placa, setPlaca] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [caminhoes, setCaminhoes] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    // Load lookups
    const loadData = async () => {
      const [eqRes, empRes, ccRes, camRes, funcRes] = await Promise.all([
        tipoEquipamentoId
          ? supabase.from("bd_caminhoes_equipamentos").select("id, frota, numero_frota").eq("tipo_equipamento_id", tipoEquipamentoId).eq("situacao", "ATIVO" as any)
          : Promise.resolve({ data: [] }),
        supabase.from("bd_empresas").select("id, nome_empresa").order("nome_empresa"),
        supabase.from("bd_centros_custo").select("id, nome_centro_custo").order("nome_centro_custo"),
        supabase.from("bd_caminhoes_equipamentos").select("id, frota, numero_frota, placa").eq("situacao", "ATIVO" as any),
        supabase.from("bd_funcionarios").select("id, nome_completo").eq("status", "ATIVO" as any).order("nome_completo"),
      ]);
      setEquipamentos(eqRes.data || []);
      setEmpresas(empRes.data || []);
      setCentrosCusto(ccRes.data || []);
      setCaminhoes(camRes.data || []);
      setFuncionarios(funcRes.data || []);
    };
    loadData();
  }, [open, tipoEquipamentoId]);

  const handleSave = async () => {
    if (!origemTipo || !destinoTipo) {
      toast.error("Preencha origem e destino.");
      return;
    }
    setSaving(true);
    try {
      const dist = distanciaKm ? Number(distanciaKm) : undefined;
      const vkm = valorKm ? Number(valorKm) : undefined;
      const custoTotal = dist && vkm ? dist * vkm : undefined;

      const movId = await criarMovimentacao({
        solicitacao_id: solicitacaoId,
        solicitacao_planejamento_id: planejamentoId,
        equipamento_id: equipamentoId || undefined,
        origem_tipo: origemTipo,
        origem_id: origemId || undefined,
        destino_tipo: destinoTipo,
        destino_id: destinoId || undefined,
        tipo_deslocamento: tipoDeslocamento,
        responsavel_transporte: responsavelTransporte,
        tipo_atendimento: tipoAtendimento,
        distancia_km: dist,
        valor_km: vkm,
        custo_total: custoTotal,
        prazo_estimado_horas: prazoHoras ? Number(prazoHoras) : undefined,
      });

      await criarTransporteDetalhado({
        movimentacao_id: movId,
        tipo_transporte: tipoTransporte,
        responsavel_transporte: responsavelTransporte,
        caminhao_id: responsavelTransporte === "PROPRIO" ? caminhaoId : undefined,
        motorista_id: responsavelTransporte === "PROPRIO" ? motoristaId : undefined,
        empresa_id: responsavelTransporte === "TERCEIRO" ? empresaId : undefined,
        motorista_nome: responsavelTransporte === "TERCEIRO" ? motoristaNome : undefined,
        motorista_cpf: responsavelTransporte === "TERCEIRO" ? motoristaCpf : undefined,
        placa: responsavelTransporte === "TERCEIRO" ? placa : undefined,
        observacoes: observacoes || undefined,
      });

      toast.success("Movimentação criada com sucesso!");
      onSaved();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Movimentação</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Equipamento */}
          <div className="col-span-2">
            <Label>Equipamento</Label>
            <Select value={equipamentoId} onValueChange={setEquipamentoId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {equipamentos.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.frota} - {e.numero_frota}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origem */}
          <div>
            <Label>Tipo Origem</Label>
            <Select value={origemTipo} onValueChange={setOrigemTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNO">Interno</SelectItem>
                <SelectItem value="LOCADORA">Locadora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem (CC)</Label>
            <Select value={origemId} onValueChange={setOrigemId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {centrosCusto.map((cc: any) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.nome_centro_custo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destino */}
          <div>
            <Label>Tipo Destino</Label>
            <Select value={destinoTipo} onValueChange={setDestinoTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNO">Interno</SelectItem>
                <SelectItem value="LOCADORA">Locadora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Destino (CC)</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {centrosCusto.map((cc: any) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.nome_centro_custo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deslocamento */}
          <div>
            <Label>Tipo Deslocamento</Label>
            <Select value={tipoDeslocamento} onValueChange={setTipoDeslocamento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRANCHA">Prancha</SelectItem>
                <SelectItem value="RODANDO">Rodando</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável Transporte</Label>
            <Select value={responsavelTransporte} onValueChange={setResponsavelTransporte}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROPRIO">Próprio</SelectItem>
                <SelectItem value="TERCEIRO">Terceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custos */}
          <div>
            <Label>Distância (km)</Label>
            <Input type="number" value={distanciaKm} onChange={(e) => setDistanciaKm(e.target.value)} />
          </div>
          <div>
            <Label>Valor/km (R$)</Label>
            <Input type="number" value={valorKm} onChange={(e) => setValorKm(e.target.value)} />
          </div>
          <div>
            <Label>Prazo Estimado (horas)</Label>
            <Input type="number" value={prazoHoras} onChange={(e) => setPrazoHoras(e.target.value)} />
          </div>

          {/* Transporte detalhado */}
          <div className="col-span-2 border-t pt-4 mt-2">
            <h3 className="font-semibold text-sm mb-3">Detalhes do Transporte</h3>
          </div>

          <div>
            <Label>Tipo Transporte</Label>
            <Select value={tipoTransporte} onValueChange={setTipoTransporte}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRANCHA">Prancha</SelectItem>
                <SelectItem value="RODANTE">Rodante</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {responsavelTransporte === "PROPRIO" ? (
            <>
              <div>
                <Label>Caminhão</Label>
                <Select value={caminhaoId} onValueChange={setCaminhaoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {caminhoes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.frota} - {c.numero_frota} {c.placa && `(${c.placa})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motorista</Label>
                <Select value={motoristaId} onValueChange={setMotoristaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome_empresa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Motorista</Label>
                <Input value={motoristaNome} onChange={(e) => setMotoristaNome(e.target.value)} />
              </div>
              <div>
                <Label>CPF do Motorista</Label>
                <Input value={motoristaCpf} onChange={(e) => setMotoristaCpf(e.target.value)} />
              </div>
              <div>
                <Label>Placa</Label>
                <Input value={placa} onChange={(e) => setPlaca(e.target.value)} />
              </div>
            </>
          )}

          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Criar Movimentação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CriarMovimentacaoModal;
