import { FormSubmission } from '@/types';

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

export async function submitFormToN8N(
  submission: FormSubmission
): Promise<{ success: boolean; error?: string }> {
  if (!WEBHOOK_URL) {
    console.error('NEXT_PUBLIC_N8N_WEBHOOK_URL no está configurada');
    return { success: false, error: 'URL del webhook no configurada' };
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error enviando formulario a N8N:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
