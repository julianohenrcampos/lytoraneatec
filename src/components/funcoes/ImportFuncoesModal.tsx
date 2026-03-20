
import React, { useState } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { processImportData } from "@/services/funcaoService";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Check, X, Minus, FileText, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { parseFuncoesExcel, generateFuncoesTemplate } from "@/lib/excel";

interface ImportFuncoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ImportFuncoesModal: React.FC<ImportFuncoesModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    created: string[];
    updated: string[];
    unchanged: string[];
    errors: string[];
    success: string[];
  } | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
    }
  };
  
  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo para importar.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const data = await parseFuncoesExcel(file);
      
      if (data.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados para importação.",
          variant: "destructive"
        });
        return;
      }
      
      const importResults = await processImportData(data);
      setResults(importResults);
      
      const totalProcessed = importResults.created.length + importResults.updated.length;
      
      if (totalProcessed > 0) {
        toast({
          title: "Importação concluída",
          description: `${importResults.created.length} criadas, ${importResults.updated.length} atualizadas, ${importResults.unchanged.length} sem alteração.`
        });
        
        queryClient.invalidateQueries({ queryKey: ["funcoes"] });
        onSuccess();
      } else if (importResults.unchanged.length > 0) {
        toast({
          title: "Nenhuma alteração necessária",
          description: `${importResults.unchanged.length} funções já estão atualizadas.`
        });
      } else {
        toast({
          title: "Importação falhou",
          description: `${importResults.errors.length} erros encontrados.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao importar dados.";
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadTemplate = () => {
    generateFuncoesTemplate();
  };
  
  const handleCloseModal = () => {
    setFile(null);
    setResults(null);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Importar Funções</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="file">Selecione um arquivo Excel para importar</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={downloadTemplate}
                disabled={isLoading}
                className="whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-2" />
                Modelo
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Colunas esperadas: Nome Função, Valor Diária (R$), Diária Exclusiva (R$), Valor Refeição (R$), Salário Base (R$)
            </p>
          </div>
          
          {file && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {(file.size / 1024).toFixed(2)} KB
              </span>
            </div>
          )}
          
          {results && (
            <div className="space-y-3 max-h-60 overflow-auto border rounded-md p-3">
              {results.created.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold flex items-center">
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                    Criadas ({results.created.length})
                  </h4>
                  <ul className="text-sm space-y-1 ml-6 list-disc">
                    {results.created.map((item, index) => (
                      <li key={`created-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {results.updated.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold flex items-center text-blue-600">
                    <Check className="h-4 w-4 mr-1 text-blue-500" />
                    Atualizadas ({results.updated.length})
                  </h4>
                  <ul className="text-sm space-y-1 ml-6 list-disc">
                    {results.updated.map((item, index) => (
                      <li key={`updated-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {results.unchanged.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold flex items-center text-muted-foreground">
                    <Minus className="h-4 w-4 mr-1" />
                    Sem alteração ({results.unchanged.length})
                  </h4>
                  <ul className="text-sm space-y-1 ml-6 list-disc text-muted-foreground">
                    {results.unchanged.map((item, index) => (
                      <li key={`unchanged-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {results.errors.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold flex items-center">
                    <X className="h-4 w-4 mr-1 text-destructive" />
                    Erros ({results.errors.length})
                  </h4>
                  <ul className="text-sm space-y-1 ml-6 list-disc">
                    {results.errors.map((error, index) => (
                      <li key={`error-${index}`} className="text-destructive">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCloseModal}
            disabled={isLoading}
          >
            {results ? "Fechar" : "Cancelar"}
          </Button>
          
          {!results && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={!file || isLoading}
              className="gap-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Iniciar Importação
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportFuncoesModal;
