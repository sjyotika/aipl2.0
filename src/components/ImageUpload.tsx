import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Paperclip, X } from 'lucide-react';

const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10);
const SUPPORTED_IMAGE_TYPES = (process.env.SUPPORTED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');

export default function ImageUpload({ onUpload, sessionId }: { onUpload: (url: string) => void; sessionId?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!SUPPORTED_IMAGE_TYPES.includes(f.type)) {
      toast.error('Unsupported file type');
      return;
    }
    if (f.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_IMAGE_SIZE_MB} MB size limit`);
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const upload = async () => {
    if (!file) return;
    setIsUploading(true);
    const form = new FormData();
    form.append('image', file);
    if (sessionId) form.append('sessionId', sessionId);
    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        onUpload(data.url);
        toast.success('Image uploaded');
        setPreview(null);
        setFile(null);
        setHasUploadedImage(true);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload error');
    } finally {
      setIsUploading(false);
    }
  };

  const remove = () => {
    setPreview(null);
    setFile(null);
    setHasUploadedImage(false);
    onUpload('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
          <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{hasUploadedImage ? 'Add another file' : 'Choose image'}</span>
          <Input className="sr-only" type="file" accept={SUPPORTED_IMAGE_TYPES.join(',')} onChange={handleChange} />
        </label>
        {hasUploadedImage && <span className="text-xs text-success">Image attached</span>}
      </div>
      {preview && (
        <div className="relative mt-2 w-fit rounded-lg border border-border p-2">
          <img src={preview} alt="Selected diagram preview" className="max-h-48 max-w-xs object-contain" />
          <Button type="button" variant="ghost" size="icon-sm" onClick={remove} className="absolute right-1 top-1" aria-label="Remove image">
            <X className="size-4" />
          </Button>
          <Button type="button" onClick={upload} disabled={isUploading} className="mt-2 w-full">
            {isUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {isUploading ? 'Uploading...' : 'Attach Image'}
          </Button>
        </div>
      )}
    </div>
  );
}
