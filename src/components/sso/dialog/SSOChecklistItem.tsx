import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AvaliacaoTipo, SSOChecklistItem as SSOChecklistItemType } from '@/types/sso';
import { CheckCircle2, XCircle, Ban } from 'lucide-react';
import { SSOPhotoUpload } from './SSOPhotoUpload';

interface SSOChecklistItemProps {
  item: SSOChecklistItemType;
  index: number;
  onChange: (itemId: string, field: keyof SSOChecklistItemType, value: any) => void;
  onFilesChange?: (itemId: string, files: File[]) => void;
  cameraOnly?: boolean;
}

export const SSOChecklistItem = ({ item, index, onChange, onFilesChange, cameraOnly = false }: SSOChecklistItemProps) => {
  const isNaoConforme = item.avaliacao === 'Não Conforme';

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
          {index + 1}
        </span>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{item.tema}</p>
            <p className="font-medium">{item.descricao}</p>
          </div>

          <div>
            <Label htmlFor={`avaliacao-${item.id}`}>Avaliação *</Label>
            <Select
              value={item.avaliacao}
              onValueChange={(value: AvaliacaoTipo) => onChange(item.id, 'avaliacao', value)}
            >
              <SelectTrigger id={`avaliacao-${item.id}`}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="Conforme">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Conforme</span>
                  </div>
                </SelectItem>
                <SelectItem value="Não Conforme">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Não Conforme</span>
                  </div>
                </SelectItem>
                <SelectItem value="NA">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-gray-500" />
                    <span>N/A (Não Aplicável)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNaoConforme && (
            <>
              <div>
                <Label htmlFor={`evidencia-${item.id}`}>Evidência Objetiva</Label>
                <Textarea
                  id={`evidencia-${item.id}`}
                  value={item.evidencia || ''}
                  onChange={(e) => onChange(item.id, 'evidencia', e.target.value)}
                  placeholder="Descreva a não conformidade encontrada..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Fotos (Não Conformidade)</Label>
                <SSOPhotoUpload
                  itemId={item.id}
                  fotos={item.fotos}
                  onChange={(newFotos) => onChange(item.id, 'fotos', newFotos)}
                  onFilesChange={(files) => {
                    if (onFilesChange) {
                      onFilesChange(item.id, files);
                    }
                  }}
                  cameraOnly={cameraOnly}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
