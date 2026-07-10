import React, { useMemo, useEffect, useRef } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { useSubcategoriasQuery } from "@/hooks/vehicles/useVeiculoQueries";
import { useLinhasOperacionaisDropdown } from "@/hooks/vehicles/useRelacionalDropdowns";
import { Upload, Trash2 } from "lucide-react";

interface Props {
  form: UseFormReturn<any>;
  categorias: { id: string; nome_categoria: string }[];
  currentImage?: string | null;
  onImageChange: (file: File) => void;
  onImageRemove?: () => void;
}

const Step1Classificacao: React.FC<Props> = ({ form, categorias, currentImage, onImageChange, onImageRemove }) => {
  const categoriaId = form.watch("categoria_ativo_id");
  const { subcategoriasDropdown, isLoadingSubcategorias } = useSubcategoriasQuery(categoriaId);
  const { data: linhas = [], isLoading: isLoadingLinhas } = useLinhasOperacionaisDropdown();

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Preview local só para arquivo recém-selecionado; imagem persistida vem do form.
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const imagemUrlForm = form.watch("imagem_url") as string | null | undefined;

  // Ao trocar de veículo (currentImage muda), descartar qualquer preview local
  // para evitar "vazamento" da imagem do registro anterior.
  useEffect(() => {
    setLocalPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [currentImage]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalPreview(url);
      onImageChange(file);
    }
  };

  const handleImageRemove = () => {
    setLocalPreview(null);
    form.setValue("imagem_url", null, { shouldDirty: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
    onImageRemove?.();
  };

  const previewUrl = localPreview ?? (imagemUrlForm || null);



  const subcategoriaOptions = useMemo(() => [
    { value: "_none", label: "Nenhuma" },
    ...subcategoriasDropdown.map((s) => ({ value: s.id, label: s.nome_subcategoria })),
  ], [subcategoriasDropdown]);

  const linhaOptions = useMemo(() => [
    { value: "_none", label: "Selecione" },
    ...linhas.map((l) => ({ value: l.id, label: `${l.codigo} - ${l.nome}` })),
  ], [linhas]);


  const handleCategoriaChange = (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    form.setValue("subcategoria_ativo_id", "_none");
  };

  const selectedLinhaId = form.watch("linha_operacional_id");
  const selectedLinha = linhas.find((l) => l.id === selectedLinhaId);

  return (
    <div className="space-y-4">
      {/* Upload de Imagem */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          📷 Imagem do Ativo
        </h3>
        <div className="flex justify-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
          {!previewUrl ? (
            <button
              type="button"
              onClick={handleImageClick}
              className="w-full max-w-[280px] border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Clique para enviar</span>
              <span className="text-xs">ou arraste uma imagem aqui</span>
            </button>
          ) : (
            <div className="relative w-[160px] h-[160px] rounded-lg overflow-hidden border group">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
                >
                  <Upload className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleImageRemove}
                  className="p-2 bg-destructive/80 rounded-full hover:bg-destructive transition-colors text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Classificação */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          🧩 Classificação do Ativo
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Categoria */}
          <FormField
            control={form.control}
            name="categoria_ativo_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria do Ativo *</FormLabel>
                <FormControl>
                  <Select onValueChange={(v) => handleCategoriaChange(v, field.onChange)} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.nome_categoria}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Subcategoria */}
          <FormField
            control={form.control}
            name="subcategoria_ativo_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcategoria</FormLabel>
                <FormControl>
                  <Combobox
                    options={subcategoriaOptions}
                    value={field.value || "_none"}
                    onChange={field.onChange}
                    placeholder={isLoadingSubcategorias ? "Carregando..." : "Selecione a subcategoria"}
                    searchPlaceholder="Buscar subcategoria..."
                    emptyText="Nenhuma subcategoria encontrada"
                    disabled={!categoriaId || categoriaId === "_none" || isLoadingSubcategorias}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Linha Operacional */}
          <FormField
            control={form.control}
            name="linha_operacional_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Linha Operacional
                  {selectedLinha && (
                    <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: selectedLinha.cor_hex || "#ccc" }} />
                  )}
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={linhaOptions}
                    value={field.value || "_none"}
                    onChange={field.onChange}
                    placeholder={isLoadingLinhas ? "Carregando..." : "Selecione a linha"}
                    searchPlaceholder="Buscar linha..."
                    emptyText="Nenhuma linha encontrada"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>
      </div>
    </div>
  );
};

export default Step1Classificacao;
