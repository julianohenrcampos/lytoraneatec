
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Truck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface VeiculoImageUploadProps {
  currentImage?: string | null;
  onImageChange: (file: File) => void;
}

const VeiculoImageUpload: React.FC<VeiculoImageUploadProps> = ({ 
  currentImage, 
  onImageChange 
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onImageChange(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const displayImage = previewUrl || currentImage;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar className="h-32 w-32">
          {displayImage ? (
            <AvatarImage src={displayImage} alt="Imagem do veículo" />
          ) : (
            <AvatarFallback className="bg-primary-50">
              <Truck className="h-16 w-16 text-primary" />
            </AvatarFallback>
          )}
        </Avatar>
      </div>
      
      <div className="w-full">
        <Label htmlFor="vehicle-image">Imagem do Veículo</Label>
        <Input
          id="vehicle-image"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mt-1"
        />
      </div>
    </div>
  );
};

export default VeiculoImageUpload;
