import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { getUserId } from '../lib/userId';

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

// Memoized Word Component
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
    className={`inline-block mr-1 text-2xl sm:text-3xl font-medium transition-colors duration-300 cursor-pointer hover:text-gray-200 select-none break-words ${
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
    <div className="mb-1 leading-relaxed">
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
  const [currentWordGlobal, setCurrentWordGlobal] = useState({ utteranceIdx: 0, wordIdx: 0 });
  const [userId, setUserId] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef(0);
  
  // Initialize user ID on component mount
  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);
  
  // Optimized current word tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      if (Math.abs(time - lastTimeRef.current) < 0.05) return;
      lastTimeRef.current = time;
      
      let found = false;
      let newUtteranceIdx = currentWordGlobal.utteranceIdx;
      let newWordIdx = currentWordGlobal.wordIdx;
      
      const currentUtterance = data.utterances[newUtteranceIdx];
      if (currentUtterance) {
        const currentWord = currentUtterance.words[newWordIdx];
        if (currentWord && time >= currentWord.start && time < currentWord.end) {
          return;
        }
      }
      
      if (currentUtterance && newWordIdx < currentUtterance.words.length - 1) {
        const nextWord = currentUtterance.words[newWordIdx + 1];
        if (time >= nextWord.start && time < nextWord.end) {
          setCurrentWordGlobal({ utteranceIdx: newUtteranceIdx, wordIdx: newWordIdx + 1 });
          return;
        }
      }
      
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
  // Track word clicks asynchronously (fire and forget)
  const trackWordClick = useCallback((utteranceIdx: number, wordIdx: number, word: string) => {
    if (!userId) return;
    
    const utterance = data.utterances[utteranceIdx];
    if (!utterance) return;
    
    const fullUtterance = utterance.words.map(w => w.word).join(' ');
    
    // Fire and forget - don't await or block UI
    fetch('/api/word-clicks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        utterance: fullUtterance,
        word: word,
      }),
    }).catch(error => {
      console.error('Failed to track word click:', error);
    });
  }, [userId, data.utterances]);

  const handleTranscriptClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.dataset.utterance) return;
    
    const utteranceIdx = parseInt(target.dataset.utterance);
    const wordIdx = parseInt(target.dataset.word || '0');
    const startTime = parseFloat(target.dataset.start || '0');
    const word = target.textContent || '';
    
    // Track word click asynchronously (no delay for user)
    trackWordClick(utteranceIdx, wordIdx, word);
    
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      seekToTime(startTime);
    } else {
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
  }, [data.utterances, trackWordClick]);
  
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
  
  // Auto-scroll
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
    <div className="fixed inset-0 bg-gradient-to-b from-teal-900 to-teal-700 text-white flex flex-col overflow-hidden">
      {/* Title */}
      <div className="flex-shrink-0 px-4 py-2 text-center">
        <h1 className="font-semibold truncate">{data.title}</h1>
      </div>
      
      {/* Transcription */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 min-h-0"
        onClick={handleTranscriptClick}
      >
        <div className="pb-8 w-full">
          {data.utterances.map((utterance, idx) => (
            <UtteranceBlock
              key={idx}
              utterance={utterance}
              utteranceIdx={idx}
              currentWordGlobal={currentWordGlobal}
            />
          ))}
        </div>
      </div>
      
      {/* Translation Overlay */}
      {showingTranslation && (
        <div 
          className="absolute left-4 right-4 bg-black bg-opacity-90 backdrop-blur-sm rounded-lg p-4 z-10"
          style={{ bottom: 'calc(180px + env(safe-area-inset-bottom))' }}
        >
          <div className="text-sm text-gray-300 mb-1">English Translation:</div>
          <div className="text-lg text-white break-words">
            {data.utterances[showingTranslation.utteranceIdx]?.translation}
          </div>
        </div>
      )}
      
      {/* Player Controls - Fixed positioning */}
      <div 
        className="flex-shrink-0 bg-teal-800 bg-opacity-50 backdrop-blur-sm"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
      >
        <div className="p-4">
          {/* Progress Bar */}
          <div className="mb-3">
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
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>
          </div>
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