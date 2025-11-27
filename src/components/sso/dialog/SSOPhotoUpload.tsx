import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Camera, Image as ImageIcon } from 'lucide-react';
import { SSOFoto } from '@/types/sso';
import { toast } from 'sonner';

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface SSOPhotoUploadProps {
  itemId: string;
  fotos: SSOFoto[];
  onChange: (fotos: SSOFoto[]) => void;
  onFilesChange?: (files: File[]) => void;
  cameraOnly?: boolean;
}

export const SSOPhotoUpload = ({ itemId, fotos, onChange, onFilesChange, cameraOnly = false }: SSOPhotoUploadProps) => {
  const [previews, setPreviews] = useState<string[]>(
    fotos.map(f => f.url || f.path)
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allFiles = Array.from(files);

    // Filtrar apenas arquivos válidos
    const validFiles = allFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas imagens são permitidas');
        return false;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`Imagem muito grande. Máximo ${MAX_FILE_SIZE_MB}MB`);
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    const newFotos: SSOFoto[] = [];

    validFiles.forEach((file) => {
      newFiles.push(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        newPreviews.push(preview);
        
        newFotos.push({
          path: file.name,
          url: preview,
          created_at: new Date().toISOString(),
        });

        if (newPreviews.length === validFiles.length) {
          const updatedFiles = [...selectedFiles, ...newFiles];
          const updatedPreviews = [...previews, ...newPreviews];
          const updatedFotos = [...fotos, ...newFotos];
          
          setSelectedFiles(updatedFiles);
          setPreviews(updatedPreviews);
          onChange(updatedFotos);
          
          if (onFilesChange) {
            onFilesChange(updatedFiles);
          }
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    const newPreviews = previews.filter((_, i) => i !== index);
    const newFotos = fotos.filter((_, i) => i !== index);
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    
    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
    onChange(newFotos);
    
    if (onFilesChange) {
      onFilesChange(newFiles);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {previews.map((preview, index) => (
          <div key={index} className="relative group">
            <img
              src={preview}
              alt={`Foto ${index + 1}`}
              className="w-20 h-20 object-cover rounded border"
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        <label className="w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors border-blue-300 bg-blue-50/50">
          <Camera className="h-5 w-5 text-blue-500 mb-1" />
          <span className="text-xs text-blue-600 text-center leading-tight">Tirar Foto</span>
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>

        {!cameraOnly && (
          <label className="w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
            <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground text-center leading-tight">Galeria</span>
            <Input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}
      </div>

      {fotos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Adicione fotos para documentar a não conformidade
        </p>
      )}
    </div>
  );
};
