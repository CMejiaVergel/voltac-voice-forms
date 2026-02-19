export interface Question {
  id: number;
  text: string;
  key: string;
}

export interface Answer {
  questionId: number;
  questionKey: string;
  questionText: string;
  transcription: string;
  timestamp: string;
}

export interface FormSubmission {
  answers: Answer[];
  metadata: {
    submittedAt: string;
    userAgent: string;
    language: string;
  };
}

export type RecordingStatus =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'done'
  | 'error';
