import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { SSOFoto } from '@/types/sso';
import { toast } from 'sonner';

interface SSOPhotoUploadProps {
  itemId: string;
  fotos: SSOFoto[];
  onChange: (fotos: SSOFoto[]) => void;
}

export const SSOPhotoUpload = ({ itemId, fotos, onChange }: SSOPhotoUploadProps) => {
  const [previews, setPreviews] = useState<string[]>(
    fotos.map(f => f.url || f.path)
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPreviews: string[] = [];
    const newFotos: SSOFoto[] = [];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas imagens são permitidas');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        newPreviews.push(preview);
        
        // Criar objeto SSOFoto temporário (será enviado ao salvar)
        newFotos.push({
          path: file.name, // Temporário - será substituído no upload
          url: preview,
          created_at: new Date().toISOString(),
        });

        if (newPreviews.length === files.length) {
          setPreviews([...previews, ...newPreviews]);
          onChange([...fotos, ...newFotos]);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    const newPreviews = previews.filter((_, i) => i !== index);
    const newFotos = fotos.filter((_, i) => i !== index);
    setPreviews(newPreviews);
    onChange(newFotos);
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

        <label className="w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
          <Upload className="h-5 w-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Upload</span>
          <Input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
      </div>

      {fotos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Adicione fotos para documentar a não conformidade
        </p>
      )}
    </div>
  );
};
