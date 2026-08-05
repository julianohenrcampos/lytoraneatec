// Dialog de criação de POP e de edição da revisão em preparação.
// Todas as mutações passam por RPC / Edge Function.

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  atualizarRascunho,
  criarPop,
  enviarArquivoRascunho,
} from '@/services/popsService';
import { usePopsSetores, useInvalidatePops } from '@/hooks/pops/usePopsData';
import { formatBytes, podeEditarCodigo, validarArquivoPop } from '@/utils/pops/versao';
import type { PopComRascunho } from '@/types/pops';

interface PopFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = criação de novo POP; preenchido = edição do rascunho existente. */
  pop: PopComRascunho | null;
}

const PopFormDialog: React.FC<PopFormDialogProps> = ({ open, onOpenChange, pop }) => {
  const { toast } = useToast();
  const invalidate = useInvalidatePops();
  const { data: setores = [] } = usePopsSetores(open);

  const rascunho = pop?.rascunho ?? null;
  const modoEdicao = Boolean(pop && rascunho);

  const [codigo, setCodigo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [setorId, setSetorId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    if (rascunho) {
      setCodigo(rascunho.codigo);
      setTitulo(rascunho.titulo);
      setCategoria(rascunho.categoria ?? '');
      setSetorId(rascunho.setor_id);
      setMotivo(rascunho.motivo_revisao ?? '');
    } else {
      setCodigo('');
      setTitulo('');
      setCategoria('');
      setSetorId('');
      setMotivo('');
    }
  }, [open, rascunho]);

  const codigoEditavel = pop
    ? podeEditarCodigo(pop.status, pop.publicado_em)
    : true;

  const handleFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    const v = validarArquivoPop(f);
    if (v.ok === false) {
      toast({ title: 'Arquivo inválido', description: v.motivo, variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast({ title: 'Informe o título', variant: 'destructive' });
      return;
    }
    if (!setorId) {
      toast({ title: 'Selecione o setor', variant: 'destructive' });
      return;
    }
    if (!modoEdicao && !codigo.trim()) {
      toast({ title: 'Informe o código', variant: 'destructive' });
      return;
    }

    setSalvando(true);
    try {
      let popId = pop?.id ?? '';
      if (modoEdicao) {
        await atualizarRascunho({
          pop_id: popId,
          codigo: codigoEditavel ? codigo.trim() : undefined,
          titulo: titulo.trim(),
          setor_id: setorId,
          categoria: categoria.trim() || undefined,
          motivo: motivo.trim() || undefined,
        });
      } else {
        popId = await criarPop({
          codigo: codigo.trim(),
          titulo: titulo.trim(),
          setor_id: setorId,
          categoria: categoria.trim() || undefined,
        });
      }

      if (file) {
        await enviarArquivoRascunho(popId, file);
      }

      toast({
        title: modoEdicao ? 'Revisão atualizada' : 'POP criado',
        description: file
          ? 'Documento anexado à revisão em preparação.'
          : 'Anexe o PDF antes de publicar.',
      });
      invalidate();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: 'Não foi possível salvar',
        description: e?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{modoEdicao ? 'Editar revisão em preparação' : 'Novo POP'}</DialogTitle>
          <DialogDescription>
            {modoEdicao
              ? 'Ajuste os metadados e o PDF da revisão. Nada é publicado até a aprovação.'
              : 'O POP é criado como revisão em preparação e recebe a versão v1.0 na publicação.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pop-codigo">Código</Label>
            <Input
              id="pop-codigo"
              value={codigo}
              disabled={!codigoEditavel}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="POP-OP-001"
            />
            {!codigoEditavel && (
              <p className="text-xs text-muted-foreground">
                O código não pode ser alterado após a primeira publicação.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pop-setor">Setor</Label>
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger id="pop-setor">
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome_departamento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pop-titulo">Título</Label>
            <Input
              id="pop-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Procedimento de aplicação de CBUQ"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pop-categoria">Categoria</Label>
            <Input
              id="pop-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pop-arquivo">Documento PDF (até 20 MB)</Label>
            <Input
              id="pop-arquivo"
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — {formatBytes(file.size)}
              </p>
            )}
            {!file && rascunho?.arquivo_nome_original && (
              <p className="text-xs text-muted-foreground">
                Atual: {rascunho.arquivo_nome_original} ({formatBytes(rascunho.arquivo_tamanho_bytes)})
              </p>
            )}
          </div>

          {modoEdicao && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pop-motivo">Motivo da revisão</Label>
              <Textarea
                id="pop-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={salvando}>
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {modoEdicao ? 'Salvar revisão' : 'Criar POP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PopFormDialog;
