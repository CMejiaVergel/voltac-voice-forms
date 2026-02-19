'use client';

import { RecordingStatus } from '@/types';

interface VoiceRecorderProps {
  status: RecordingStatus;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
  onRetry?: () => void;
}

export function VoiceRecorder({
  status,
  isSupported,
  onStart,
  onStop,
  onRetry,
}: VoiceRecorderProps) {
  const isRecording = status === 'recording';
  const isDone = status === 'done';
  const isError = status === 'error';

  if (!isSupported) {
    return (
      <p className="text-amber-400 text-sm text-center">
        El reconocimiento de voz no está disponible en este navegador. Usa el
        campo de texto debajo.
      </p>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-red-400 text-sm text-center">
          Hubo un error con el micrófono. Revisa los permisos e intenta de nuevo.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={isRecording ? onStop : onStart}
      disabled={status === 'processing'}
      className={`
        relative w-20 h-20 rounded-full flex items-center justify-center
        transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-voltac-accent focus-visible:ring-offset-2 focus-visible:ring-offset-voltac-bg
        ${isRecording
          ? 'bg-red-500/90 hover:bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
          : 'bg-voltac-accent hover:bg-voltac-accentLight text-white shadow-lg shadow-voltac-accent/30'
        }
      `}
      aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación con voz'}
    >
      {isRecording && (
        <span
          className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40"
          aria-hidden
        />
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-10 h-10"
      >
        {isRecording ? (
          <rect x="6" y="6" width="12" height="12" rx="2" />
        ) : (
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
        )}
      </svg>
    </button>
  );
}
