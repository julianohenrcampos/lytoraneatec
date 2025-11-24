import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, ZoomIn } from 'lucide-react';

interface SSOPhotoGalleryProps {
  photos: Array<{ url?: string; path: string }>;
}

export const SSOPhotoGallery = ({ photos }: SSOPhotoGalleryProps) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nenhuma foto anexada
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 print:gap-1">
        {photos.slice(0, 4).map((foto, index) => (
          <div
            key={index}
            className="relative aspect-video rounded-md overflow-hidden cursor-pointer border border-border print:break-inside-avoid hover:border-primary transition-colors"
            onClick={() => setSelectedPhoto(foto.url || foto.path)}
          >
      <img
        src={foto.url || foto.path}
        alt={`Foto ${index + 1}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
            <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
              {index + 1}
            </div>
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </div>
        ))}
      </div>
      
      {photos.length > 4 && (
        <div className="text-center text-[10px] text-muted-foreground py-1.5 bg-muted/20 rounded-md mt-1.5">
          + {photos.length - 4} {photos.length - 4 === 1 ? 'foto adicional' : 'fotos adicionais'}
        </div>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Visualização da foto</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>
            {selectedPhoto && (
              <img
                src={selectedPhoto}
                alt="Foto ampliada"
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
