
import React, { useState, useCallback } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VeiculoFormData } from "@/types/veiculo";
import { FileUploader } from "@/components/ui/file-uploader";
import { AlertCircle, CheckCircle2, Info, FileSpreadsheet, Download } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface ImportVeiculosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (veiculos: VeiculoFormData[] | File) => Promise<{ success: any[]; errors: any[] }>;
  onSuccess: () => void;
}

const ImportVeiculosModal: React.FC<ImportVeiculosModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [parseResults, setParseResults] = useState<any[]>([]);
  const [step, setStep] = useState<"upload" | "confirm" | "result">("upload");
  const [importResult, setImportResult] = useState<{
    success: any[];
    errors: any[];
  }>({ success: [], errors: [] });

  const resetModal = useCallback(() => {
    setFile(null);
    setImportErrors([]);
    setParseResults([]);
    setStep("upload");
    setImportResult({ success: [], errors: [] });
  }, []);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      setFile(files[0]);
      if (files[0].name.toLowerCase().endsWith(".csv")) {
        parseCSV(files[0]);
      } else if (files[0].name.toLowerCase().endsWith(".xlsx") || 
                files[0].name.toLowerCase().endsWith(".xls")) {
        setImportErrors([]);
        setStep("confirm");
      } else {
        setImportErrors(["Formato de arquivo não suportado. Use CSV, XLS ou XLSX."]);
      }
    }
  };

  const parseCSV = (file: File) => {
    const errors: string[] = [];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          errors.push(
            ...results.errors.map(
              (err) => `Linha ${err.row}: ${err.message}`
            )
          );
        }

        if (results.data.length === 0) {
          errors.push("O arquivo não contém dados válidos.");
        }

        setImportErrors(errors);
        setParseResults(results.data);
        
        if (errors.length === 0 && results.data.length > 0) {
          setStep("confirm");
        }
      },
      error: (error) => {
        errors.push(`Erro ao processar o arquivo: ${error.message}`);
        setImportErrors(errors);
      },
    });
  };

  const downloadTemplate = async () => {
    const { downloadEquipamentoTemplate } = await import("@/services/veiculo/importExport");
    downloadEquipamentoTemplate();
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      let result;
      
      if (file?.name.toLowerCase().endsWith(".xlsx") || 
          file?.name.toLowerCase().endsWith(".xls")) {
        console.log("Importing Excel file:", file.name);
        result = await onImport(file);
      } else {
        const formattedData = parseResults.map((item) => ({
          frota: item.Frota || item.frota || null,
          numero_frota: item["Número Frota"] || item["Numero Frota"] || item.numero_frota || null,
          departamento_id: null,
          placa: item.Placa || item.placa || null,
          fabricante: item.Fabricante || item.fabricante || item.Marca || item.marca || null,
          cor: item.Cor || item.cor || null,
          motor: item.Motor || item.motor || null,
          ano_fabricacao: item["Ano de Fabricação"] || item["Ano de Fabricacao"] || item.ano_fabricacao || null,
          tipo_combustivel: item["Tipo de Combustível"] || item["Tipo de Combustivel"] || item.tipo_combustivel || null,
          status_ipva: item["Status IPVA"] || item.status_ipva || null,
          situacao: item.Situação || item.Situacao || item.situacao || null,
          capacidade: item.Capacidade || item.capacidade || null,
          aluguel: item.Aluguel || item.aluguel || null,
          observacoes: item.Observações || item.Observacoes || item.observacoes || null,
          empresa_id: null,
          imagem_url: null,
          categoria_ativo_id: null,
          subcategoria_ativo_id: null,
          numero_serie: item["Número de Série"] || item["Numero de Serie"] || item.numero_serie || null,
          chassi: item.Chassi || item.chassi || null,
          informacoes_complementares: item["Informações Complementares"] || item["Informacoes Complementares"] || item.informacoes_complementares || null,
          status_cadastro: item["Status Cadastro"] || item.status_cadastro || 'ativo',
          status_disponibilidade: item["Status Disponibilidade"] || item.status_disponibilidade || 'disponivel',
          proprietario_tipo: item["Proprietário Tipo"] || item["Proprietario Tipo"] || item.proprietario_tipo || 'proprio',
          tipo_ativo: item["Tipo Ativo"] || item.tipo_ativo || 'proprio',
          empresa_locadora_id: null,
          linha_operacional_id: null,
          tipo_equipamento_id: null,
        }));

        console.log("Importing CSV data with entries:", formattedData.length);
        result = await onImport(formattedData);
      }
      
      console.log("Import result:", result);
      setImportResult(result);
      setStep("result");

      if (result.success.length > 0 && result.errors.length === 0) {
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao importar veículos:", error);
      setImportErrors([
        "Ocorreu um erro durante a importação. Por favor, tente novamente.",
      ]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Veículos/Equipamentos</DialogTitle>
          <DialogDescription>
            Importe veículos e equipamentos a partir de um arquivo Excel ou CSV.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Arquivo Excel ou CSV com os dados dos veículos
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="flex items-center gap-1 text-xs"
              >
                <Download className="h-3 w-3" />
                Modelo
              </Button>
            </div>

            <FileUploader
              accept=".csv,.xlsx,.xls"
              onFilesSelected={handleFileChange}
              label="Arraste e solte seu arquivo Excel/CSV aqui ou clique para selecionar"
              maxFiles={1}
            />

            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>Formato esperado</AlertTitle>
              <AlertDescription className="text-xs">
                <p>Baixe o modelo oficial (botão acima) com todas as colunas padronizadas.</p>
                <p className="mt-1">Colunas obrigatórias:</p>
                <ul className="list-disc ml-4 mt-1">
                  <li><strong>categoria</strong> (ex: EQUIPAMENTO, VEÍCULO)</li>
                  <li><strong>subcategoria</strong> (ex: ESCAVADEIRA, CAMINHÃO)</li>
                  <li><strong>frota_codigo</strong> (código da frota cadastrada)</li>
                  <li><strong>placa</strong> ou <strong>chassi</strong> (ao menos um)</li>
                </ul>
                <p className="mt-1">Colunas opcionais:</p>
                <ul className="list-disc ml-4 mt-1">
                  <li>linha_operacional, fabricante, modelo, ano_fabricacao</li>
                  <li>empresa, tipo_empresa, status_operacional, capacidade</li>
                </ul>
                <p className="mt-1 text-muted-foreground">Veja a aba INSTRUCOES no modelo para detalhes.</p>
              </AlertDescription>
            </Alert>

            {importErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 mt-2">
                    {importErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Confirmação</AlertTitle>
              <AlertDescription>
                Arquivo "{file?.name}" selecionado. 
                Confirme para continuar com a importação.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={resetModal}
                disabled={isImporting}
              >
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Importando..." : "Confirmar Importação"}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="space-y-4">
            {importResult.success.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Sucesso</AlertTitle>
                <AlertDescription className="text-green-700">
                  {importResult.success.length} veículos/equipamentos foram
                  importados com sucesso.
                </AlertDescription>
              </Alert>
            )}

            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>
                  <div className="mt-2">
                    {importResult.errors.map((error, index) => (
                      <div key={index}>{error.message}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isImporting}
            >
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportVeiculosModal;
