import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-voltac-bg">
      <div className="max-w-xl mx-auto text-center space-y-8">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-voltac-accent to-voltac-blue bg-clip-text text-transparent">
          Voltac Voice Forms
        </h1>
        <p className="text-white/80 text-lg">
          Cuéntanos tu necesidad en voz alta. Respondemos unas breves preguntas y
          nos pondremos en contacto contigo.
        </p>
        <Link
          href="/formulario"
          className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-voltac-accent hover:bg-voltac-accentLight text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-voltac-blue focus:ring-offset-2 focus:ring-offset-voltac-bg"
        >
          Comenzar diagnóstico
        </Link>
      </div>
    </main>
  );
}
