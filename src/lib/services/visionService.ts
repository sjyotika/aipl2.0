import { Buffer } from 'buffer';
import { createClient } from '@supabase/supabase-js';

/**
 * Calls Google Gemini Pro Vision API to analyze an image and return a description.
 * Expects the environment variable GEMINI_API_KEY to be set.
 */
export async function describeImage(imageUrl: string, prompt: string = 'Please describe the content of this image in detail.') : Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // Fetch image and convert to base64
  const { data: signedData, error: signedError } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!).storage.from('images').createSignedUrl(imageUrl, 300);
  if (signedError || !signedData?.signedUrl) throw new Error('Unable to access image')
  const { base64, mimeType } = await fetchBase64(signedData.signedUrl);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${process.env.GEMINI_VISION_MODEL || 'gemini-pro-vision'}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini vision API error: ${response.status} ${errText}`);
  }

  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    return '';
  }
  return parts[0].text ?? '';
}

/**
 * Helper to fetch an image URL and convert it to a base64 string.
 */
async function fetchBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const fetch = (await import('node-fetch')).default
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image at ${url}: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  return { base64: Buffer.from(buffer).toString('base64'), mimeType: res.headers.get('content-type') || 'image/png' };
}
