import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Voltac Voice Forms | Diagnóstico por voz',
  description:
    'Cuéntanos tu necesidad y te contactaremos. Formulario de captura por voz para clientes potenciales de Voltac.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased text-white bg-voltac-bg min-h-screen">
        {children}
      </body>
    </html>
  );
}
