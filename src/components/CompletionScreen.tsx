'use client';

interface CompletionScreenProps {
  onRetry?: () => void;
  error?: string;
}

export function CompletionScreen({ onRetry, error }: CompletionScreenProps) {
  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 text-center">
        <div className="bg-voltac-surface/80 backdrop-blur rounded-2xl border border-red-500/30 p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-8 h-8 text-red-400"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Hubo un error al enviar
          </h2>
          <p className="text-white/80 text-sm mb-6">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-6 py-3 rounded-xl bg-voltac-accent hover:bg-voltac-accentLight text-white font-medium transition-colors"
            >
              Reintentar envío
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 text-center">
      <div className="bg-voltac-surface/80 backdrop-blur rounded-2xl border border-white/10 p-8 sm:p-10 shadow-xl">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-voltac-accent/20 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-10 h-10 text-voltac-accent"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-3">
          ¡Gracias por tu tiempo!
        </h2>
        <p className="text-white/80 text-base leading-relaxed">
          Hemos recibido tu información. Nos pondremos en contacto contigo pronto.
        </p>
      </div>
    </div>
  );
}
