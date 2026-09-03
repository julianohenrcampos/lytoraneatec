/**
 * CT-3E — Mini-cards arrastáveis de MOTORISTAS e VEÍCULOS TRANSPORTADORES.
 *
 * Apenas apresentação: as opções são exatamente as do hook de cadastros
 * (`useCtMobilizacaoCadastros`, leitura sob RLS) e o efeito do drop é o mesmo
 * patch de rascunho que os seletores já fazem. Fallback sem drag continua
 * disponível nos comboboxes do card da viagem.
 */
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export const CT_DND_MIME_MOTORISTA = "application/x-lytotec-ct-motorista";
export const CT_DND_MIME_VEICULO = "application/x-lytotec-ct-veiculo";

interface Props {
  motoristas: ComboboxOption[];
  veiculos: ComboboxOption[];
  desabilitado?: boolean;
  /** Fallback sem drag: aplica direto na viagem em foco. */
  onAplicarMotorista?: (id: string) => void;
  onAplicarVeiculo?: (id: string) => void;
}

const MiniLista: React.FC<{
  titulo: string;
  mime: string;
  opcoes: ComboboxOption[];
  testId: string;
  desabilitado: boolean;
  onAplicar?: (id: string) => void;
}> = ({ titulo, mime, opcoes, testId, desabilitado, onAplicar }) => {
  const [busca, setBusca] = useState("");
  const filtradas = opcoes
    .filter((o) =>
      busca.trim() === ""
        ? true
        : `${o.label} ${o.searchText ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
    )
    .slice(0, 24);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </p>
        <span className="text-[10px] text-muted-foreground">{opcoes.length}</span>
      </div>
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar"
        className="h-7 text-xs"
      />
      <div className="grid max-h-52 gap-1 overflow-y-auto pr-1">
        {filtradas.map((o) => (
          <div
            key={o.value}
            role="button"
            tabIndex={0}
            draggable={!desabilitado}
            data-testid={`${testId}-item-${o.value}`}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition-colors",
              desabilitado ? "opacity-60" : "cursor-grab hover:bg-muted",
            )}
            onDragStart={(e) => {
              e.dataTransfer.setData(mime, o.value);
              e.dataTransfer.setData("text/plain", o.value);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => !desabilitado && onAplicar?.(o.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !desabilitado) {
                e.preventDefault();
                onAplicar?.(o.value);
              }
            }}
            title={o.label}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-hidden />
            <span className="truncate">{o.label}</span>
          </div>
        ))}
        {filtradas.length === 0 && (
          <p className="text-[11px] text-muted-foreground">Nenhum registro para a busca.</p>
        )}
      </div>
    </div>
  );
};

export const RecursosArrastaveisPanel: React.FC<Props> = ({
  motoristas,
  veiculos,
  desabilitado = false,
  onAplicarMotorista,
  onAplicarVeiculo,
}) => (
  <Card data-testid="ct3e-recursos-arrastaveis">
    <CardHeader className="pb-2">
      <CardTitle className="text-xs font-medium">Recursos do transporte</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <MiniLista
        titulo="Motoristas"
        mime={CT_DND_MIME_MOTORISTA}
        opcoes={motoristas}
        testId="ct3e-motoristas"
        desabilitado={desabilitado}
        onAplicar={onAplicarMotorista}
      />
      <MiniLista
        titulo="Veículos transportadores"
        mime={CT_DND_MIME_VEICULO}
        opcoes={veiculos}
        testId="ct3e-veiculos"
        desabilitado={desabilitado}
        onAplicar={onAplicarVeiculo}
      />
      <p className="text-[10px] text-muted-foreground">
        Arraste sobre o card da viagem — ou clique para aplicar na viagem em foco.
      </p>
    </CardContent>
  </Card>
);

export default RecursosArrastaveisPanel;
