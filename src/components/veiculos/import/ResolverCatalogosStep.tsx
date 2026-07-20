import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MapaCatalogoLinha, CatalogoTipo } from '@/services/veiculo/import/types';
import type {
  DecisaoUsuarioCatalogoItem,
  DecisaoUsuarioCatalogo,
} from '@/services/veiculo/import/tiposResolucao';
import {
  chaveDecisaoUsuario,
  chaveDecisaoUsuarioLinha,
  tipoDestinoDeCatalogo,
  campoDoCatalogo,
  isCampoBloqueante,
} from '@/services/veiculo/import/tiposResolucao';

interface Props {
  mapaCatalogo: MapaCatalogoLinha[];
  decisoes: Map<string, DecisaoUsuarioCatalogoItem>;
  onChange: (novo: Map<string, DecisaoUsuarioCatalogoItem>) => void;
  onVoltar: () => void;
  onConfirmar: () => void;
}

const LABEL: Record<CatalogoTipo, string> = {
  FABRICANTE: 'Fabricante',
  MODELO: 'Modelo',
  SUBCATEGORIA: 'Subcategoria',
  PROPRIETARIO_EMPRESA: 'Proprietário (empresa)',
  PROPRIETARIO_LOCADORA: 'Proprietário (locadora)',
  CENTRO_CUSTO: 'Centro de custo',
  DEPARTAMENTO: 'Departamento',
};

interface Candidato {
  id: string;
  nome: string;
}

function extrairCandidatos(linha: MapaCatalogoLinha): Candidato[] {
  const ids = (linha.candidatos_ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const nomes = (linha.candidatos_nomes ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
  const n = Math.min(ids.length, nomes.length);
  const out: Candidato[] = [];
  for (let i = 0; i < n; i += 1) out.push({ id: ids[i], nome: nomes[i] });
  return out;
}

const ResolverCatalogosStep: React.FC<Props> = ({
  mapaCatalogo,
  decisoes,
  onChange,
  onVoltar,
  onConfirmar,
}) => {
  const pendentes = mapaCatalogo.filter(
    (m) =>
      m.status_resolucao === 'NAO_RESOLVIDO' ||
      m.status_resolucao === 'AMBIGUO' ||
      m.match_tipo === 'ALIAS_SUGERIDO',
  );

  const keyDe = (l: MapaCatalogoLinha) => chaveDecisaoUsuario(l.catalogo_tipo, l.valor_normalizado);
  const decisaoAtual = (l: MapaCatalogoLinha): DecisaoUsuarioCatalogoItem | undefined => {
    // Placeholders/vazios: leitura reflete a primeira decisão per-linha existente (todas iguais por design).
    if (l.status_resolucao === 'PLACEHOLDER' || l.valor_normalizado === '') {
      const linhas = (l.linhas_excel ?? '').split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
      for (const le of linhas) {
        const v = decisoes.get(chaveDecisaoUsuarioLinha(l.catalogo_tipo, le));
        if (v) return v;
      }
      return undefined;
    }
    return decisoes.get(keyDe(l));
  };

  const linhasExcelDoRow = (l: MapaCatalogoLinha): number[] =>
    (l.linhas_excel ?? '').split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);

  const escreverPerLinha = (
    novo: Map<string, DecisaoUsuarioCatalogoItem>,
    linha: MapaCatalogoLinha,
    payloadBase: Omit<DecisaoUsuarioCatalogoItem, 'linha_excel'>,
  ) => {
    for (const le of linhasExcelDoRow(linha)) {
      novo.set(chaveDecisaoUsuarioLinha(linha.catalogo_tipo, le), { ...payloadBase, linha_excel: le });
    }
  };

  const limparPerLinha = (novo: Map<string, DecisaoUsuarioCatalogoItem>, linha: MapaCatalogoLinha) => {
    for (const le of linhasExcelDoRow(linha)) {
      novo.delete(chaveDecisaoUsuarioLinha(linha.catalogo_tipo, le));
    }
  };

  const setDecisao = (linha: MapaCatalogoLinha, decisao: DecisaoUsuarioCatalogo, destino?: Candidato | null) => {
    const key = keyDe(linha);
    const campo = campoDoCatalogo(linha.catalogo_tipo);
    // Gate 1.2.1: IGNORAR_CAMPO_OPCIONAL não é aceito para campos bloqueantes.
    if (decisao === 'IGNORAR_CAMPO_OPCIONAL' && campo && isCampoBloqueante(campo)) return;
    // Gate 1.2.1: CONFIRMAR_SUGESTAO exige exatamente 1 candidato.
    if (decisao === 'CONFIRMAR_SUGESTAO' && extrairCandidatos(linha).length !== 1) return;
    // Gate 1.2.1: SELECIONAR_OUTRO exige destino escolhido.
    if (decisao === 'SELECIONAR_OUTRO' && (!destino || !destino.id)) {
      // Ainda persiste (sem destino) para refletir estado da UI; recomputeDecisions ignora.
    }
    const contextual = linha.status_resolucao === 'PLACEHOLDER' || linha.valor_normalizado === '';
    const novo = new Map(decisoes);

    if (decisao === 'AGUARDANDO_REVISAO') {
      if (contextual) limparPerLinha(novo, linha);
      else novo.delete(key);
      onChange(novo);
      return;
    }

    const escolha =
      decisao === 'CONFIRMAR_SUGESTAO' ? (extrairCandidatos(linha)[0] ?? null) :
      decisao === 'SELECIONAR_OUTRO' ? (destino ?? null) : null;

    const payloadBase: Omit<DecisaoUsuarioCatalogoItem, 'linha_excel'> = {
      catalogo_tipo: linha.catalogo_tipo,
      valor_normalizado: linha.valor_normalizado,
      decisao,
      destino_id_selecionado: escolha?.id ?? null,
      destino_nome_selecionado: escolha?.nome ?? null,
      cadastro_destino_tipo:
        decisao === 'CONFIRMAR_SUGESTAO' || decisao === 'SELECIONAR_OUTRO'
          ? tipoDestinoDeCatalogo(linha.catalogo_tipo)
          : null,
    };

    if (contextual) {
      escreverPerLinha(novo, linha, payloadBase);
    } else {
      novo.set(key, payloadBase);
    }
    onChange(novo);
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Resolva catálogos ambíguos ou com alias. Casos ambíguos (ex.: LYTORANEA matriz/filial) exigem
        seleção manual via <strong>SELECIONAR OUTRO</strong>. Campos bloqueantes (proprietário,
        subcategoria e centro de custo) não podem ser marcados como "ignorar".
      </div>
      <div className="max-h-[55vh] overflow-y-auto border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor planilha</TableHead>
              <TableHead>Ocor.</TableHead>
              <TableHead>Candidatos</TableHead>
              <TableHead>Decisão</TableHead>
              <TableHead>Seleção</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendentes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                  Nenhum catálogo pendente. Você pode confirmar diretamente.
                </TableCell>
              </TableRow>
            )}
            {pendentes.map((m) => {
              const campo = campoDoCatalogo(m.catalogo_tipo);
              const bloqueante = !!campo && isCampoBloqueante(campo);
              const candidatos = extrairCandidatos(m);
              const atual = decisaoAtual(m);
              const decisaoValor: DecisaoUsuarioCatalogo = atual?.decisao ?? 'AGUARDANDO_REVISAO';
              const permiteConfirmar = m.match_tipo === 'ALIAS_SUGERIDO' && candidatos.length === 1;
              const opcoes: Array<{ v: DecisaoUsuarioCatalogo; l: string; disabled?: boolean }> = [
                { v: 'AGUARDANDO_REVISAO', l: 'Aguardando' },
                { v: 'CONFIRMAR_SUGESTAO', l: 'Confirmar sugestão', disabled: !permiteConfirmar },
                { v: 'SELECIONAR_OUTRO', l: 'Selecionar outro', disabled: candidatos.length === 0 },
                { v: 'DEIXAR_PENDENTE', l: 'Deixar pendente' },
                {
                  v: 'IGNORAR_CAMPO_OPCIONAL',
                  l: bloqueante ? 'Ignorar (indisponível)' : 'Ignorar (opcional)',
                  disabled: bloqueante,
                },
              ];
              return (
                <TableRow key={`${m.catalogo_tipo}-${m.valor_normalizado}`}>
                  <TableCell className="text-xs">
                    {LABEL[m.catalogo_tipo]}{' '}
                    {bloqueante && <Badge variant="secondary" className="ml-1">bloqueante</Badge>}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{m.valor_origem}</TableCell>
                  <TableCell className="text-xs">{m.ocorrencias}</TableCell>
                  <TableCell className="text-xs">
                    {candidatos.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      candidatos.map((c) => c.nome).join(' | ')
                    )}
                    {m.match_tipo === 'AMBIGUO' && (
                      <Badge variant="destructive" className="ml-2">AMBÍGUO</Badge>
                    )}
                    {m.match_tipo === 'ALIAS_SUGERIDO' && (
                      <Badge variant="secondary" className="ml-2">ALIAS</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <select
                      className="text-xs border rounded p-1 bg-background"
                      value={decisaoValor}
                      onChange={(e) => setDecisao(m, e.target.value as DecisaoUsuarioCatalogo)}
                    >
                      {opcoes.map((o) => (
                        <option key={o.v} value={o.v} disabled={o.disabled}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {decisaoValor === 'SELECIONAR_OUTRO' ? (
                      <select
                        className="text-xs border rounded p-1 bg-background max-w-[240px]"
                        value={atual?.destino_id_selecionado ?? ''}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          const escolhido = candidatos.find((c) => c.id === id) ?? null;
                          setDecisao(m, 'SELECIONAR_OUTRO', escolhido);
                        }}
                      >
                        <option value="">— escolher —</option>
                        {candidatos.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onVoltar}>Voltar</Button>
        <Button onClick={onConfirmar}>Aplicar decisões e recalcular</Button>
      </div>
    </div>
  );
};

export default ResolverCatalogosStep;
