import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, PlayCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DecisaoLinha } from '@/services/veiculo/import/types';
import { formatarNumeroFrota } from '@/services/veiculo/import/splitCodigoAtivo';
import type { ProgressoImportacao } from '@/services/veiculo/import/executarImportacao';

interface Props {
  decisoes: DecisaoLinha[];
  selecionadas: Set<number>;
  onChangeSelecionadas: (s: Set<number>) => void;
  onVoltar: () => void;
  onConfirmar: () => void;
  temPermissaoCriar: boolean;
  ocupado: boolean;
  batchSize: number;
  onChangeBatchSize: (n: number) => void;
  progresso: ProgressoImportacao | null;
}

const BATCH_SIZES = [25, 50, 100];

const ConfirmarImportacaoStep: React.FC<Props> = ({
  decisoes,
  selecionadas,
  onChangeSelecionadas,
  onVoltar,
  onConfirmar,
  temPermissaoCriar,
  ocupado,
  batchSize,
  onChangeBatchSize,
  progresso,
}) => {
  const validas = useMemo(
    () =>
      decisoes.filter(
        (d) =>
          d.acao_base === 'INSERIR' &&
          d.status_validacao === 'VALIDA' &&
          d.linha.numero_frota_canonico &&
          d.linha.numero_frota_canonico.toUpperCase() !== 'LYE246',
      ),
    [decisoes],
  );

  const [confirmText, setConfirmText] = useState('');
  const total = selecionadas.size;
  const textoEsperado = `IMPORTAR ${total} NOVOS ATIVOS`;
  const podeConfirmar =
    temPermissaoCriar && total > 0 && confirmText.trim().toUpperCase() === textoEsperado;

  const toggle = (linha: number) => {
    const s = new Set(selecionadas);
    if (s.has(linha)) s.delete(linha);
    else s.add(linha);
    onChangeSelecionadas(s);
  };

  const selecionarTodos = () => {
    onChangeSelecionadas(new Set(validas.map((d) => d.linha.linha_excel)));
  };

  const limpar = () => onChangeSelecionadas(new Set());

  const codigoExibicao = (d: DecisaoLinha): string => {
    const p = (d.linha.numero_frota_prefixo ?? '').toUpperCase();
    const n = d.linha.numero_frota_numero ?? '';
    return p && n ? `${p}${formatarNumeroFrota(n)}` : (d.linha.numero_frota_canonico ?? '');
  };

  const totalLotes = total > 0 ? Math.max(1, Math.ceil(total / batchSize)) : 0;

  return (
    <div className="space-y-3">
      <Alert>
        <PlayCircle className="h-4 w-4" />
        <AlertTitle>Etapa 3 — Confirmar importação (Rodada 2A.2)</AlertTitle>
        <AlertDescription className="text-xs">
          Somente linhas <strong>INSERIR + VALIDA</strong> aparecem aqui. LYE246 está bloqueada.
          A execução ocorre em lotes sequenciais no frontend; falhas em uma linha não interrompem o lote.
          O backend revalida cada linha antes de gravar e armazena o número com padding de 3 dígitos.
        </AlertDescription>
      </Alert>

      {!temPermissaoCriar && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Sem permissão</AlertTitle>
          <AlertDescription>
            Você não possui a ação <code>criar</code> em <code>gestao_maquinas_caminhoes_view</code>.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button size="sm" variant="outline" onClick={selecionarTodos} disabled={ocupado || !temPermissaoCriar}>
          Selecionar todos válidos ({validas.length})
        </Button>
        <Button size="sm" variant="ghost" onClick={limpar} disabled={ocupado}>
          Limpar seleção
        </Button>
        <label className="flex items-center gap-1">
          Lote:
          <select
            className="border rounded p-1 bg-background"
            value={batchSize}
            onChange={(e) => onChangeBatchSize(parseInt(e.target.value, 10))}
            disabled={ocupado}
          >
            {BATCH_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <Badge variant="secondary">
          {total} selecionadas · {validas.length} elegíveis · {totalLotes} lote(s) de {batchSize}
        </Badge>
      </div>

      {progresso && (
        <Alert>
          <PlayCircle className="h-4 w-4" />
          <AlertTitle>
            Lote {progresso.loteAtual} de {progresso.totalLotes} — {progresso.processadasGeral}/{progresso.totalGeral}
          </AlertTitle>
          <AlertDescription className="text-xs">
            Sucessos: {progresso.sucessos} · Já processadas: {progresso.ja_processados} · Erros: {progresso.erros} · Pendentes: {progresso.totalGeral - progresso.processadasGeral}
          </AlertDescription>
        </Alert>
      )}

      <div className="border rounded max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Linha</TableHead>
              <TableHead>Código (exibição)</TableHead>
              <TableHead>Frota</TableHead>
              <TableHead>Nº formatado</TableHead>
              <TableHead>Subcategoria</TableHead>
              <TableHead>Proprietário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Alertas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validas.map((d) => {
              const res = d.resolucao_catalogos;
              const sel = selecionadas.has(d.linha.linha_excel);
              const numeroFormatado = d.linha.numero_frota_numero
                ? formatarNumeroFrota(d.linha.numero_frota_numero)
                : '—';
              return (
                <TableRow key={d.linha.linha_excel} data-selected={sel}>
                  <TableCell>
                    <Checkbox
                      checked={sel}
                      onCheckedChange={() => toggle(d.linha.linha_excel)}
                      disabled={ocupado}
                    />
                  </TableCell>
                  <TableCell>{d.linha.linha_excel}</TableCell>
                  <TableCell className="font-mono text-xs">{codigoExibicao(d)}</TableCell>
                  <TableCell>{d.linha.numero_frota_prefixo}</TableCell>
                  <TableCell className="font-mono text-xs">{numeroFormatado}</TableCell>
                  <TableCell className="text-xs">{res?.subcategoria.cadastro_destino_nome ?? '—'}</TableCell>
                  <TableCell className="text-xs">{res?.proprietario.cadastro_destino_nome ?? '—'}</TableCell>
                  <TableCell className="text-xs">{res?.proprietario.cadastro_destino_tipo ?? '—'}</TableCell>
                  <TableCell className="text-xs">{res?.centro_custo.cadastro_destino_nome ?? '—'}</TableCell>
                  <TableCell className="text-xs">{res?.fabricante.cadastro_destino_nome ?? '—'}</TableCell>
                  <TableCell className="text-xs">{res?.modelo.cadastro_destino_nome ?? '—'}</TableCell>
                  <TableCell className="text-xs">{d.linha.ano_fabricacao_raw ?? '—'}</TableCell>
                  <TableCell className="text-[10px]">
                    {(d.alertas_catalogo ?? []).length > 0 ? (d.alertas_catalogo ?? []).join(', ') : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
            {validas.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-xs text-muted-foreground">
                  Nenhuma linha INSERIR+VALIDA disponível.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          Digite exatamente <code className="font-mono">{textoEsperado}</code> para liberar o botão:
        </label>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={textoEsperado}
          disabled={ocupado || total === 0 || !temPermissaoCriar}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onVoltar} disabled={ocupado}>
          Voltar
        </Button>
        <Button onClick={onConfirmar} disabled={!podeConfirmar || ocupado}>
          {ocupado ? 'Importando…' : `Confirmar importação (${total} em ${totalLotes} lote(s))`}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmarImportacaoStep;
