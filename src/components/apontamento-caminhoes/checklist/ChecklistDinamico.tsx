import React, { useMemo, useState } from "react";
import {
  CHECKLIST_CE_TEMPLATES,
  type ChecklistCeTemplateCodigo,
  type ChecklistCeItemDef,
} from "@/constants/checklistCeTemplates";
import type { ChecklistValor } from "@/types/checklistCe";
import ChecklistGrupo from "./ChecklistGrupo";
import ChecklistItemRow from "./ChecklistItemRow";
import ChecklistSaveBar from "./ChecklistSaveBar";

export interface FotoLocal {
  localId: string;
  file: File;
  previewUrl: string;
}

export interface ChecklistItemState {
  status?: ChecklistValor;
  observacao: string;
  fotosSalvas: string[];
  fotosNovas: FotoLocal[];
}

export type ChecklistDetalhadoState = Record<string, ChecklistItemState>;

/** Legado: inicializa itens sem status (usado apenas em hidratação/EDIT). */
export function novoEstadoDetalhado(
  templateCodigo: ChecklistCeTemplateCodigo
): ChecklistDetalhadoState {
  const t = CHECKLIST_CE_TEMPLATES[templateCodigo];
  const s: ChecklistDetalhadoState = {};
  t.grupos.forEach((g) =>
    g.itens.forEach((i) => {
      s[i.codigo] = { observacao: "", fotosSalvas: [], fotosNovas: [] };
    })
  );
  return s;
}

/** CREATE: inicializa todos os itens como "OK" (Conforme). */
export function novoEstadoDetalhadoOK(
  templateCodigo: ChecklistCeTemplateCodigo
): ChecklistDetalhadoState {
  const t = CHECKLIST_CE_TEMPLATES[templateCodigo];
  const s: ChecklistDetalhadoState = {};
  t.grupos.forEach((g) =>
    g.itens.forEach((i) => {
      s[i.codigo] = { status: "OK", observacao: "", fotosSalvas: [], fotosNovas: [] };
    })
  );
  return s;
}

interface Props {
  templateCodigo: ChecklistCeTemplateCodigo;
  state: ChecklistDetalhadoState;
  onChangeItem: (codigo: string, patch: Partial<ChecklistItemState>) => void;
  showValidation?: boolean;
  showInitialHint?: boolean;
  disabled?: boolean;
}

const ChecklistDinamico: React.FC<Props> = ({
  templateCodigo,
  state,
  onChangeItem,
  showValidation,
  showInitialHint,
  disabled,
}) => {
  const template = CHECKLIST_CE_TEMPLATES[templateCodigo];
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    template.grupos.forEach((g, idx) => (m[g.codigo] = idx === 0));
    return m;
  });

  const stats = useMemo(() => {
    let totalObrig = 0;
    let respObrig = 0;
    let nao = 0;
    template.grupos.forEach((g) =>
      g.itens.forEach((i) => {
        const s = state[i.codigo];
        if (i.obrigatorio) totalObrig++;
        if (s?.status) {
          if (i.obrigatorio) respObrig++;
          if (s.status === "NAO_OK") nao++;
        }
      })
    );
    return { totalObrig, respObrig, nao, pendencias: totalObrig - respObrig };
  }, [template, state]);

  const isItemInvalido = (item: ChecklistCeItemDef): boolean => {
    if (!showValidation) return false;
    const s = state[item.codigo];
    if (item.obrigatorio && !s?.status) return true;
    if (s?.status === "NAO_OK" && !s.observacao.trim()) return true;
    if (
      s?.status === "NAO_OK" &&
      item.exigeFotoNaoOk &&
      s.fotosSalvas.length + s.fotosNovas.length === 0
    )
      return true;
    return false;
  };

  return (
    <div className="space-y-4">
      <ChecklistSaveBar
        respondidosObrigatorios={stats.respObrig}
        totalObrigatorios={stats.totalObrig}
        pendencias={stats.pendencias}
        naoConformes={stats.nao}
        showInitialHint={showInitialHint}
      />
      {template.grupos.map((g) => {
        const resp = g.itens.filter((i) => state[i.codigo]?.status).length;
        const nao = g.itens.filter((i) => state[i.codigo]?.status === "NAO_OK").length;
        return (
          <ChecklistGrupo
            key={g.codigo}
            grupo={g}
            respondidos={resp}
            naoConformes={nao}
            aberto={!!abertos[g.codigo]}
            onToggle={() => setAbertos((p) => ({ ...p, [g.codigo]: !p[g.codigo] }))}
          >
            {g.itens.map((i) => {
              const s = state[i.codigo] || {
                observacao: "",
                fotosSalvas: [],
                fotosNovas: [],
              };
              return (
                <ChecklistItemRow
                  key={i.codigo}
                  item={i}
                  status={s.status}
                  observacao={s.observacao}
                  fotosSalvas={s.fotosSalvas}
                  fotosNovas={s.fotosNovas}
                  disabled={disabled}
                  invalid={isItemInvalido(i)}
                  onStatus={(v) => onChangeItem(i.codigo, { status: v })}
                  onObservacao={(v) => onChangeItem(i.codigo, { observacao: v })}
                  onAddFiles={(files) => {
                    const novas: FotoLocal[] = files
                      .filter(
                        (f) =>
                          ["image/jpeg", "image/png", "image/webp"].includes(f.type) &&
                          f.size <= 5 * 1024 * 1024
                      )
                      .map((file) => ({
                        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        file,
                        previewUrl: URL.createObjectURL(file),
                      }));
                    onChangeItem(i.codigo, {
                      fotosNovas: [...s.fotosNovas, ...novas],
                    });
                  }}
                  onRemoveLocal={(localId) => {
                    const alvo = s.fotosNovas.find((x) => x.localId === localId);
                    if (alvo) URL.revokeObjectURL(alvo.previewUrl);
                    onChangeItem(i.codigo, {
                      fotosNovas: s.fotosNovas.filter((x) => x.localId !== localId),
                    });
                  }}
                  onRemoveSalva={(path) =>
                    onChangeItem(i.codigo, {
                      fotosSalvas: s.fotosSalvas.filter((p) => p !== path),
                    })
                  }
                />
              );
            })}
          </ChecklistGrupo>
        );
      })}
    </div>
  );
};

export default ChecklistDinamico;
