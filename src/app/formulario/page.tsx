import Link from 'next/link';
import { BrowserCheck } from '@/components/BrowserCheck';
import { VoiceForm } from '@/components/VoiceForm';

export default function FormularioPage() {
  return (
    <main className="min-h-screen py-8 pb-16">
      <header className="w-full max-w-2xl mx-auto px-4 mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-white/70 hover:text-white text-sm transition-colors"
        >
          ← Volver
        </Link>
        <span className="text-white/50 text-sm">Voltac Intake</span>
      </header>

      <BrowserCheck>
        <VoiceForm />
      </BrowserCheck>
    </main>
  );
}
