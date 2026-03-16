
import React, { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import VeiculoImageUpload from "../VeiculoImageUpload";
import { useSubcategoriasQuery } from "@/hooks/vehicles/useVeiculoQueries";

interface VeiculoDetailsTabProps {
  form: UseFormReturn<any>;
  departamentos: { id: string, nome_departamento: string }[];
  empresas: { id: string, nome_empresa: string }[];
  categorias: { id: string, nome_categoria: string }[];
  currentImage?: string | null;
  onImageChange: (file: File) => void;
}

const VeiculoDetailsTab: React.FC<VeiculoDetailsTabProps> = ({
  form,
  departamentos,
  empresas,
  categorias,
  currentImage,
  onImageChange,
}) => {
  const categoriaId = form.watch('categoria_ativo_id');
  const { subcategoriasDropdown, isLoadingSubcategorias } = useSubcategoriasQuery(categoriaId);

  const subcategoriaOptions = useMemo(() => [
    { value: "_none", label: "Nenhuma" },
    ...subcategoriasDropdown.map((sub) => ({ value: sub.id, label: sub.nome_subcategoria })),
  ], [subcategoriasDropdown]);

  const departamentoOptions = useMemo(() => [
    { value: "_none", label: "Nenhum" },
    ...departamentos.map((dep) => ({ value: dep.id, label: dep.nome_departamento })),
  ], [departamentos]);

  const handleCategoriaChange = (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    form.setValue('subcategoria_ativo_id', '_none');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 order-2 lg:order-1">
        <VeiculoImageUpload 
          currentImage={currentImage}
          onImageChange={onImageChange}
        />
      </div>
      
      <div className="lg:col-span-2 order-1 lg:order-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Categoria do Ativo */}
        <FormField
          control={form.control}
          name="categoria_ativo_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria do Ativo *</FormLabel>
              <FormControl>
                <Select 
                  onValueChange={(v) => handleCategoriaChange(v, field.onChange)} 
                  value={field.value || ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nome_categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Subcategoria do Ativo */}
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
                  disabled={!categoriaId || categoriaId === '_none' || isLoadingSubcategorias}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Frota */}
        <FormField
          control={form.control}
          name="frota"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frota *</FormLabel>
              <FormControl>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma frota" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="LYE">LYE</SelectItem>
                    <SelectItem value="LYC">LYC</SelectItem>
                    <SelectItem value="LOC">LOC</SelectItem>
                    <SelectItem value="LOK">LOK</SelectItem>
                    <SelectItem value="LYU">LYU</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Número Frota */}
        <FormField
          control={form.control}
          name="numero_frota"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número Frota</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 001" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Fabricante */}
        <FormField
          control={form.control}
          name="fabricante"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fabricante</FormLabel>
              <FormControl>
                <Input placeholder="Volvo, Caterpillar, etc." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Modelo */}
        <FormField
          control={form.control}
          name="modelo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modelo</FormLabel>
              <FormControl>
                <Input placeholder="FH 540, 320D, etc." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Placa */}
        <FormField
          control={form.control}
          name="placa"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Placa</FormLabel>
              <FormControl>
                <Input placeholder="ABC-1234" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Número de Série */}
        <FormField
          control={form.control}
          name="numero_serie"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Série</FormLabel>
              <FormControl>
                <Input placeholder="Nº de série do equipamento" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Chassi */}
        <FormField
          control={form.control}
          name="chassi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chassi</FormLabel>
              <FormControl>
                <Input placeholder="Número do chassi" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cor */}
        <FormField
          control={form.control}
          name="cor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cor</FormLabel>
              <FormControl>
                <Input placeholder="Branco, Amarelo, etc." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Proprietário */}
        <FormField
          control={form.control}
          name="empresa_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Proprietário</FormLabel>
              <FormControl>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um proprietário" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Departamento */}
        <FormField
          control={form.control}
          name="departamento_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento</FormLabel>
              <FormControl>
                <Combobox
                  options={departamentoOptions}
                  value={field.value || "_none"}
                  onChange={field.onChange}
                  placeholder="Selecione um departamento"
                  searchPlaceholder="Buscar departamento..."
                  emptyText="Nenhum departamento encontrado"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default VeiculoDetailsTab;
