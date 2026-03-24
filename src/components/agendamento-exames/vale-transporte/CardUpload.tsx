import React, { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardUploadProps {
  title: string;
  icon: 'download' | 'upload';
  accept?: string;
  file?: File;
  done?: boolean;
  loading?: boolean;
  onClick?: () => void;
  onFileChange?: (file: File) => void;
}

export const CardUpload: React.FC<CardUploadProps> = ({
  title,
  icon,
  accept,
  file,
  done,
  loading,
  onClick,
  onFileChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (icon === 'upload' && inputRef.current) {
      inputRef.current.click();
    } else {
      onClick?.();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileChange?.(f);
    e.target.value = '';
  };

  const Icon = icon === 'download' ? Download : Upload;
  const isComplete = done || !!file;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/40',
        isComplete && 'border-primary/50 bg-primary/5'
      )}
      onClick={handleClick}
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 p-4 text-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : isComplete ? (
          <CheckCircle className="h-6 w-6 text-primary" />
        ) : (
          <Icon className="h-6 w-6 text-muted-foreground" />
        )}
        <span className="text-xs font-medium leading-tight">{title}</span>
        {file && (
          <span className="text-[10px] text-muted-foreground truncate max-w-full">
            📎 {file.name}
          </span>
        )}
        {icon === 'upload' && (
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={handleChange}
          />
        )}
      </CardContent>
    </Card>
  );
};
