
import React from "react";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { Camera, Upload } from "lucide-react";

interface ImageUploadProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  inputId: string;
  preview: string | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: "camera" | "upload";
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  form,
  name,
  label,
  inputId,
  preview,
  onImageChange,
  icon = "camera",
}) => {
  const IconComponent = icon === "camera" ? Camera : Upload;

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById(inputId)?.click()}
              >
                <IconComponent className="mr-2 h-4 w-4" />
                Anexar Imagem
              </Button>
              <Input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageChange}
              />
            </div>
            {preview && (
              <div className="relative w-full h-40 border rounded-md overflow-hidden">
                <img
                  src={preview}
                  alt={label}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default ImageUpload;
