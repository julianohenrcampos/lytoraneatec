import React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CentroCustoSelecionado } from "@/lib/planejamentoMacro/importarCronograma/tipos";

interface UploadStepProps {
  cc: CentroCustoSelecionado;
  parsing: boolean;
  onFileSelected: (file: File) => void;
}

const UploadStep: React.FC<UploadStepProps> = ({ cc, parsing, onFileSelected }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handlePick = (file?: File | null) => {
    if (!file) return;
    onFileSelected(file);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Centro de Custo</Label>
        <Input
          disabled
          value={`${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`}
          aria-label="Centro de Custo selecionado"
        />
        <p className="text-xs text-muted-foreground">
          A importação fica vinculada exclusivamente ao Centro de Custo selecionado.
        </p>
      </div>

      <div
        className="rounded-lg border-2 border-dashed border-border p-8 text-center hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handlePick(e.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          {parsing ? "Lendo arquivo…" : "Clique ou arraste um arquivo aqui"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Formatos aceitos: .xml (MS Project), .csv, .xlsx, .xls (máx. 5.000 linhas)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xml,.csv,.xlsx,.xls"
          className="hidden"
          disabled={parsing}
          onChange={(e) => handlePick(e.target.files?.[0])}
        />
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Colunas reconhecidas (qualquer ordem):</p>
        <p>
          Nome / Tarefa, Data Início, Data Fim, WBS, Frente, Descrição, Unidade, Quantidade,
          Produção, Prioridade, Centro de Custo (opcional).
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={parsing}>
          Selecionar arquivo
        </Button>
      </div>
    </div>
  );
};

export default UploadStep;
