import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import LanguageSelector from '@/components/LanguageSelector';
import ImageUpload from '@/components/ImageUpload';

export default function ExplainInput({
  value,
  onChange,
  onSubmit,
  sessionId,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string, imageUrl?: string) => void;
  sessionId?: string;
}) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const handleSend = () => {
    if (!value.trim()) return;
    onSubmit(value.trim(), imageUrl || undefined);
    onChange('');
    setImageUrl(null);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-w-0 items-end gap-2">
        <div className="min-w-0 flex-1">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Explain the concept to your peer..."
        className="min-h-[44px] max-h-[160px] resize-none text-sm"
        rows={1}
      />
        </div>
        <LanguageSelector />
        <Button onClick={handleSend} disabled={!value.trim()} className="shrink-0 mb-0.5 bg-gradient-brand hover:opacity-90 transition-opacity">
        Send
        </Button>
      </div>
      <ImageUpload onUpload={setImageUrl} sessionId={sessionId} />
    </div>
  );
}
