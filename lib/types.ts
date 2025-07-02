export interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Utterance {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker: number;
  words: Word[];
  translations?: {
    en?: string;
    fr?: string;
  };
  // Legacy field for backward compatibility
  translation?: string;
}

export interface TranscriptionData {
  title: string;
  date: string;
  duration: number;
  utterances: Utterance[];
  audioUrl: string;
}

export interface OptimizedTranscriptionData {
  title: string;
  date: string;
  duration: number;
  wordCount: number;
  audioUrl: string;
}