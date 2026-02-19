'use client';

import { useState, useEffect } from 'react';

type CheckStatus = 'checking' | 'ok' | 'no-speech-api' | 'no-https' | 'no-mic';

export function BrowserCheck({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CheckStatus>('checking');

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setStatus('no-speech-api');
      return;
    }

    const isSecure =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    if (!isSecure) {
      setStatus('no-https');
      return;
    }

    // Comprobar permisos de micrófono si la API está disponible
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          if (result.state === 'denied') {
            setStatus('no-mic');
          } else {
            setStatus('ok');
          }
        })
        .catch(() => setStatus('ok'));
    } else {
      setStatus('ok');
    }
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="animate-spin w-8 h-8 border-2 border-voltac-accent border-t-transparent rounded-full" />
        <p className="mt-3 text-white/70 text-sm">Comprobando navegador...</p>
      </div>
    );
  }

  if (status === 'no-speech-api') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 max-w-md mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7 text-amber-400"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Navegador no compatible con voz
        </h2>
        <p className="text-white/80 text-sm mb-6">
          Este formulario funciona mejor en <strong>Chrome</strong>,{' '}
          <strong>Edge</strong> o <strong>Brave</strong>. Por favor, ábrelo en
          uno de estos navegadores para usar el micrófono.
        </p>
        <p className="text-white/60 text-sm">
          Puedes continuar aquí y escribir tus respuestas en el campo de texto
          de cada pregunta.
        </p>
        <div className="mt-8 w-full">{children}</div>
      </div>
    );
  }

  if (status === 'no-https') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 max-w-md mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7 text-red-400"
          >
            <path
              fillRule="evenodd"
              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Se requiere HTTPS
        </h2>
        <p className="text-white/80 text-sm">
          El reconocimiento de voz solo funciona en sitios seguros (HTTPS) o en
          localhost. Abre esta página usando <strong>https://</strong> o
          ejecútala en <strong>localhost</strong> para desarrollo.
        </p>
      </div>
    );
  }

  if (status === 'no-mic') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 max-w-md mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7 text-amber-400"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 .55-.45 1-1 1h-2v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H8c-.55 0-1-.45-1-1s.45-1 1-1h2V9c0-.55.45-1 1-1s1 .45 1 1v2h2c.55 0 1 .45 1 1z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Permisos de micrófono
        </h2>
        <p className="text-white/80 text-sm mb-6">
          Para usar el micrófono, permite el acceso en la configuración de tu
          navegador (icono de candado o información en la barra de direcciones)
          y recarga la página.
        </p>
        <p className="text-white/60 text-sm">
          También puedes completar el formulario escribiendo en el campo de
          texto de cada pregunta.
        </p>
        <div className="mt-8 w-full">{children}</div>
      </div>
    );
  }

  return <>{children}</>;
}
