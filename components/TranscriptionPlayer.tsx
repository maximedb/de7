import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';

// Types
interface Word {
  word: string;
  start: number;
  end: number;
}

interface Utterance {
  words: Word[];
  translation?: string;
}

interface TranscriptionData {
  title: string;
  duration: number;
  audioUrl: string;
  utterances: Utterance[];
}

// Memoized Word Component - Only re-renders when its active state changes
const WordSpan = React.memo(({ 
  word, 
  utteranceIdx, 
  wordIdx, 
  isActive, 
  isPast 
}: {
  word: Word;
  utteranceIdx: number;
  wordIdx: number;
  isActive: boolean;
  isPast: boolean;
}) => (
  <span
    data-utterance={utteranceIdx}
    data-word={wordIdx}
    data-start={word.start}
    data-end={word.end}
    className={`inline-block mr-2 text-3xl font-medium transition-colors duration-300 cursor-pointer hover:text-gray-200 select-none ${
      isActive 
        ? 'text-white current-word' 
        : isPast 
          ? 'text-gray-200' 
          : 'text-gray-400'
    }`}
  >
    {word.word}
  </span>
));

// Memoized Utterance Component
const UtteranceBlock = React.memo(({ 
  utterance, 
  utteranceIdx, 
  currentWordGlobal 
}: {
  utterance: Utterance;
  utteranceIdx: number;
  currentWordGlobal: { utteranceIdx: number; wordIdx: number };
}) => {
  return (
    <div className="mb-1">
      {utterance.words.map((word, wordIdx) => {
        const isActive = currentWordGlobal.utteranceIdx === utteranceIdx && 
                        currentWordGlobal.wordIdx === wordIdx;
        const isPast = currentWordGlobal.utteranceIdx > utteranceIdx || 
                       (currentWordGlobal.utteranceIdx === utteranceIdx && 
                        currentWordGlobal.wordIdx > wordIdx);
        
        return (
          <WordSpan
            key={`${utteranceIdx}-${wordIdx}`}
            word={word}
            utteranceIdx={utteranceIdx}
            wordIdx={wordIdx}
            isActive={isActive}
            isPast={isPast}
          />
        );
      })}
    </div>
  );
});

export default function TranscriptionPlayer({ data }: { data: TranscriptionData }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showingTranslation, setShowingTranslation] = useState<{utteranceIdx: number, wordIdx: number} | null>(null);
  
  // Track current word position efficiently
  const [currentWordGlobal, setCurrentWordGlobal] = useState({ utteranceIdx: 0, wordIdx: 0 });
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef(0);
  
  // Optimized current word tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      // Only update if time changed significantly (more than 0.05 seconds)
      if (Math.abs(time - lastTimeRef.current) < 0.05) return;
      lastTimeRef.current = time;
      
      // Find current word efficiently
      let found = false;
      let newUtteranceIdx = currentWordGlobal.utteranceIdx;
      let newWordIdx = currentWordGlobal.wordIdx;
      
      // First, check if we're still in the same word
      const currentUtterance = data.utterances[newUtteranceIdx];
      if (currentUtterance) {
        const currentWord = currentUtterance.words[newWordIdx];
        if (currentWord && time >= currentWord.start && time < currentWord.end) {
          return; // Still in the same word, no update needed
        }
      }
      
      // Check next word (most common case during playback)
      if (currentUtterance && newWordIdx < currentUtterance.words.length - 1) {
        const nextWord = currentUtterance.words[newWordIdx + 1];
        if (time >= nextWord.start && time < nextWord.end) {
          setCurrentWordGlobal({ utteranceIdx: newUtteranceIdx, wordIdx: newWordIdx + 1 });
          return;
        }
      }
      
      // Check next utterance
      if (newUtteranceIdx < data.utterances.length - 1) {
        const nextUtterance = data.utterances[newUtteranceIdx + 1];
        if (nextUtterance.words.length > 0) {
          const firstWord = nextUtterance.words[0];
          if (time >= firstWord.start && time < firstWord.end) {
            setCurrentWordGlobal({ utteranceIdx: newUtteranceIdx + 1, wordIdx: 0 });
            return;
          }
        }
      }
      
      // If not found, do a full search (only happens during seeking)
      for (let uIdx = 0; uIdx < data.utterances.length && !found; uIdx++) {
        const utterance = data.utterances[uIdx];
        for (let wIdx = 0; wIdx < utterance.words.length; wIdx++) {
          const word = utterance.words[wIdx];
          if (time >= word.start && time < word.end) {
            if (uIdx !== newUtteranceIdx || wIdx !== newWordIdx) {
              setCurrentWordGlobal({ utteranceIdx: uIdx, wordIdx: wIdx });
            }
            found = true;
            break;
          }
        }
      }
    };
    
    audio.addEventListener('timeupdate', updateTime);
    return () => audio.removeEventListener('timeupdate', updateTime);
  }, [currentWordGlobal, data.utterances]);
  
  // Event delegation for word clicks
  const handleTranscriptClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.dataset.utterance) return;
    
    const utteranceIdx = parseInt(target.dataset.utterance);
    const wordIdx = parseInt(target.dataset.word || '0');
    const startTime = parseFloat(target.dataset.start || '0');
    
    if (clickTimerRef.current) {
      // Double click - seek to word position
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      seekToTime(startTime);
    } else {
      // Single click - show translation
      clickTimerRef.current = setTimeout(() => {
        pauseAudio();
        const utterance = data.utterances[utteranceIdx];
        if (utterance?.translation) {
          setShowingTranslation({ utteranceIdx, wordIdx });
          setTimeout(() => setShowingTranslation(null), 3000);
        }
        clickTimerRef.current = null;
      }, 250);
    }
  }, [data.utterances]);
  
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);
  
  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.pause();
    setIsPlaying(false);
  }, []);
  
  const seekToTime = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = time;
    audio.play();
    setIsPlaying(true);
  }, []);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getRemainingTime = () => {
    return data.duration - currentTime;
  };
  
  // Auto-scroll with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentWordElement = document.querySelector('.current-word');
      if (currentWordElement && scrollContainerRef.current) {
        currentWordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentWordGlobal]);
  
  return (
    <div className="h-screen bg-gradient-to-b from-teal-900 to-teal-700 text-white flex flex-col">
      {/* Title */}
      <div className="px-4 py-2 text-center">
        <h1 className="font-semibold truncate">{data.title}</h1>
      </div>
      
      {/* Transcription with Event Delegation */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4"
        onClick={handleTranscriptClick}
      >
        <div className="space-y-1 pb-32">
          {data.utterances.map((utterance, idx) => (
            <UtteranceBlock
              key={idx}
              utterance={utterance}
              utteranceIdx={idx}
              currentWordGlobal={currentWordGlobal}
            />
          ))}
        </div>
        
        {/* Translation Overlay */}
        {showingTranslation && (
          <div className="fixed inset-x-4 bottom-32 bg-black bg-opacity-90 backdrop-blur-sm rounded-lg p-4 z-10">
            <div className="text-sm text-gray-300 mb-1">English Translation:</div>
            <div className="text-lg text-white">
              {data.utterances[showingTranslation.utteranceIdx]?.translation}
            </div>
          </div>
        )}
      </div>
      
      {/* Player Controls */}
      <div className="backdrop-blur-sm p-4 pb-safe-bottom">
        {/* Progress Bar */}
        <div className="mb-2">
          <div className="relative h-1 bg-gray-600 rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-white transition-all duration-300"
              style={{ width: `${(currentTime / data.duration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-sm text-gray-300">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(getRemainingTime())}</span>
          </div>
        </div>
        
        {/* Play Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={togglePlayPause}
            className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 ml-0.5" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </button>
        </div>
      </div>
      
      <audio
        ref={audioRef}
        src={data.audioUrl}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}