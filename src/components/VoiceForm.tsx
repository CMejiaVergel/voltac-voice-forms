'use client';

import { useState, useCallback, useEffect } from 'react';
import { Answer } from '@/types';
import { questions } from '@/lib/questions';
import { submitFormToN8N } from '@/lib/api';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { ProgressBar } from './ProgressBar';
import { QuestionCard } from './QuestionCard';
import { CompletionScreen } from './CompletionScreen';

export function VoiceForm() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [textFallbacks, setTextFallbacks] = useState<Record<number, string>>({});
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'submitting' | 'completed' | 'error'
  >('idle');
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [hasRetriedSubmit, setHasRetriedSubmit] = useState(false);
  const [submitTrigger, setSubmitTrigger] = useState(0);

  const {
    status,
    displayText,
    finalText,
    isSupported,
    startRecording,
    stopRecording,
    resetRecording,
  } = useSpeechToText();

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= questions.length - 1;
  const isFormComplete = currentQuestionIndex >= questions.length;

  // Pre-llenar el textarea con la transcripción cuando termina la grabación
  useEffect(() => {
    if (
      status === 'done' &&
      currentQuestion &&
      finalText.trim() &&
      !(textFallbacks[currentQuestion.id] ?? '').trim()
    ) {
      setTextFallbacks((prev) => ({
        ...prev,
        [currentQuestion.id]: finalText.trim(),
      }));
    }
  }, [status, currentQuestion?.id, finalText, textFallbacks]);

  // Texto final a enviar: prioriza el cuadro de texto (con correcciones del usuario) sobre la transcripción directa
  const effectiveTextForCurrent = (): string => {
    const fromText = (textFallbacks[currentQuestion?.id ?? 0] ?? '').trim();
    const fromVoice = finalText.trim();
    return fromText || fromVoice;
  };

  const handleNext = useCallback(() => {
    if (!currentQuestion) return;

    const text = effectiveTextForCurrent();
    if (!text) return;

    const answer: Answer = {
      questionId: currentQuestion.id,
      questionKey: currentQuestion.key,
      questionText: currentQuestion.text,
      transcription: text,
      timestamp: new Date().toISOString(),
    };

    setAnswers((prev) => [...prev, answer]);
    setTextFallbacks((prev) => ({ ...prev, [currentQuestion.id]: '' }));
    resetRecording();
    setCurrentQuestionIndex((prev) => prev + 1);
  }, [
    currentQuestion,
    finalText,
    textFallbacks,
    resetRecording,
  ]);

  const handleRepeat = useCallback(() => {
    setTextFallbacks((prev) => ({
      ...prev,
      [currentQuestion?.id ?? 0]: '',
    }));
    resetRecording();
  }, [currentQuestion?.id, resetRecording]);

  const handleTextFallbackChange = useCallback((value: string) => {
    if (!currentQuestion) return;
    setTextFallbacks((prev) => ({ ...prev, [currentQuestion.id]: value }));
  }, [currentQuestion]);

  const submitForm = useCallback(async () => {
    setSubmissionState('submitting');
    setSubmitError(undefined);

    const submission = {
      answers,
      metadata: {
        submittedAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        language: typeof navigator !== 'undefined' ? navigator.language : 'es',
      },
    };

    // Verificación previa al envío: ver en consola (F12) el payload que se enviaría a N8N
    if (process.env.NODE_ENV === 'development') {
      console.log('[Voltac Voice Forms] Payload que se enviará al webhook:', JSON.stringify(submission, null, 2));
    }

    const result = await submitFormToN8N(submission);

    if (result.success) {
      setSubmissionState('completed');
    } else {
      setSubmitError(result.error ?? 'Error desconocido');
      if (!hasRetriedSubmit) {
        setHasRetriedSubmit(true);
        const retryResult = await submitFormToN8N(submission);
        if (retryResult.success) {
          setSubmissionState('completed');
        } else {
          setSubmissionState('error');
          setSubmitError(retryResult.error ?? 'Error desconocido');
        }
      } else {
        setSubmissionState('error');
      }
    }
  }, [answers, hasRetriedSubmit]);

  // Enviar al webhook cuando se completan todas las preguntas (una sola vez)
  useEffect(() => {
    if (
      currentQuestionIndex < questions.length ||
      answers.length !== questions.length ||
      submissionState !== 'idle' ||
      submitTrigger > 0
    ) {
      return;
    }
    setSubmitTrigger(1);
    submitForm();
  }, [currentQuestionIndex, answers.length, submissionState, submitTrigger, submitForm]);

  if (submissionState === 'submitting') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="animate-spin w-10 h-10 border-2 border-voltac-accent border-t-transparent rounded-full" />
        <p className="mt-4 text-white/80">Enviando tu información...</p>
      </div>
    );
  }

  if (submissionState === 'completed' || submissionState === 'error') {
    return (
      <CompletionScreen
        error={submissionState === 'error' ? submitError : undefined}
        onRetry={
          submissionState === 'error'
            ? () => {
                setSubmissionState('idle');
                setSubmitError(undefined);
                submitForm();
              }
            : undefined
        }
      />
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const currentTextFallback = textFallbacks[currentQuestion.id] ?? '';
  const canGoNext = effectiveTextForCurrent().length > 0;

  return (
    <div className="space-y-6 transition-opacity duration-300">
      <ProgressBar current={currentQuestionIndex} total={questions.length} />

      <QuestionCard
        question={currentQuestion}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        status={status}
        isSupported={isSupported}
        displayText={displayText}
        finalText={finalText}
        textFallback={currentTextFallback}
        onTextFallbackChange={handleTextFallbackChange}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onRetryRecording={() => resetRecording()}
        onNext={handleNext}
        onRepeat={handleRepeat}
        canGoNext={canGoNext}
      />
    </div>
  );
}
