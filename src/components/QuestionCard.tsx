'use client';

import { Question } from '@/types';
import { VoiceRecorder } from './VoiceRecorder';
import { RecordingStatus } from '@/types';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  status: RecordingStatus;
  isSupported: boolean;
  displayText: string;
  finalText: string;
  textFallback: string;
  onTextFallbackChange: (value: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRetryRecording?: () => void;
  onNext: () => void;
  onRepeat: () => void;
  canGoNext: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  status,
  isSupported,
  displayText,
  finalText,
  textFallback,
  onTextFallbackChange,
  onStartRecording,
  onStopRecording,
  onRetryRecording,
  onNext,
  onRepeat,
  canGoNext,
}: QuestionCardProps) {
  const isDone = status === 'done';
  const effectiveText = (finalText || textFallback).trim();
  const hasTextInput = textFallback.trim().length > 0;
  const showNext = (isDone || hasTextInput) && canGoNext;
  const showRepeat = isDone || hasTextInput;

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-voltac-surface/80 backdrop-blur rounded-2xl border border-white/10 p-6 sm:p-8 shadow-xl transition-opacity duration-300">
        <p className="text-white/60 text-sm mb-2">
          Pregunta {questionNumber} de {totalQuestions}
        </p>
        <h2 className="text-xl sm:text-2xl font-medium text-white mb-8 leading-relaxed">
          {question.text}
        </h2>

        <div className="flex flex-col items-center gap-6">
          <VoiceRecorder
            status={status}
            isSupported={isSupported}
            onStart={onStartRecording}
            onStop={onStopRecording}
            onRetry={onRetryRecording}
          />

          {(status === 'recording' && displayText) || (isDone && effectiveText) ? (
            <div className="w-full text-center">
              <p className="text-white/90 text-sm sm:text-base min-h-[2.5rem]">
                {status === 'recording' ? displayText || 'Habla ahora...' : effectiveText}
              </p>
            </div>
          ) : null}

          <div className="w-full">
            <label htmlFor="text-fallback" className="sr-only">
              Escribe tu respuesta (alternativa al micrófono)
            </label>
            <textarea
              id="text-fallback"
              value={textFallback}
              onChange={(e) => onTextFallbackChange(e.target.value)}
              placeholder="O escribe tu respuesta aquí..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-voltac-accent focus:border-transparent resize-none text-sm sm:text-base"
            />
          </div>

          <div className="flex flex-wrap gap-3 justify-center w-full">
            {showNext && (
              <button
                type="button"
                onClick={onNext}
                className="px-6 py-3 rounded-xl bg-voltac-accent hover:bg-voltac-accentLight text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-voltac-blue focus:ring-offset-2 focus:ring-offset-voltac-bg"
              >
                Siguiente
              </button>
            )}
            {showRepeat && (
              <button
                type="button"
                onClick={onRepeat}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-voltac-bg"
              >
                Repetir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
