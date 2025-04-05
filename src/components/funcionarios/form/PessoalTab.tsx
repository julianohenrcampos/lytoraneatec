
import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import ImageUploader from "./ImageUploader";
import { Funcionario } from "@/types/funcionario";

interface PessoalTabProps {
  form: UseFormReturn<any>;
  funcionario: Funcionario | null;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  imagePreview: string | null;
  setImagePreview: (value: string | null) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  isUploadingImage: boolean;
  setIsUploadingImage: (value: boolean) => void;
}

const PessoalTab: React.FC<PessoalTabProps> = ({
  form,
  funcionario,
  onClose,
  setActiveTab,
  imagePreview,
  setImagePreview,
  imageFile,
  setImageFile,
  isUploadingImage,
  setIsUploadingImage
}) => {
  return (
    <TabsContent value="pessoal" className="space-y-4">
      <ImageUploader 
        funcionario={funcionario}
        form={form}
        isUploadingImage={isUploadingImage}
        setIsUploadingImage={setIsUploadingImage}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
        imageFile={imageFile}
        setImageFile={setImageFile}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="nome_completo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo</FormLabel>
              <FormControl>
                <Input placeholder="Nome completo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="cpf"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CPF</FormLabel>
              <FormControl>
                <Input placeholder="CPF" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="data_nascimento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Nascimento</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="E-mail" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <FormField
        control={form.control}
        name="endereco_completo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Endereço Completo</FormLabel>
            <FormControl>
              <Input placeholder="Endereço completo" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="escolaridade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Escolaridade</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a escolaridade" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Ensino Fundamental Incompleto">Ensino Fundamental Incompleto</SelectItem>
                  <SelectItem value="Ensino Fundamental Completo">Ensino Fundamental Completo</SelectItem>
                  <SelectItem value="Ensino Médio Incompleto">Ensino Médio Incompleto</SelectItem>
                  <SelectItem value="Ensino Médio Completo">Ensino Médio Completo</SelectItem>
                  <SelectItem value="Ensino Superior Incompleto">Ensino Superior Incompleto</SelectItem>
                  <SelectItem value="Ensino Superior Completo">Ensino Superior Completo</SelectItem>
                  <SelectItem value="Pós-graduação">Pós-graduação</SelectItem>
                  <SelectItem value="Mestrado">Mestrado</SelectItem>
                  <SelectItem value="Doutorado">Doutorado</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="genero"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gênero</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o gênero" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Não-binário">Não-binário</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                  <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button 
          type="button" 
          onClick={() => setActiveTab("profissional")}
        >
          Próximo
        </Button>
      </div>
    </TabsContent>
  );
};

export default PessoalTab;
