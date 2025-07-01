import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { getUserId } from '../lib/userId';
import { Word, Utterance, TranscriptionData } from '../lib/types';

// Memoized Word Component
const WordSpan = React.memo(({ 
  word, 
  utteranceIdx, 
  wordIdx, 
  isActive, 
  isPast,
  isClicked 
}: {
  word: Word;
  utteranceIdx: number;
  wordIdx: number;
  isActive: boolean;
  isPast: boolean;
  isClicked: boolean;
}) => (
  <span
    data-utterance={utteranceIdx}
    data-word={wordIdx}
    data-start={word.start}
    data-end={word.end}
    className={`inline-block mr-1 text-2xl sm:text-3xl font-medium transition-all duration-300 cursor-pointer hover:text-gray-200 select-none break-words ${
      isClicked
        ? 'text-yellow-300 bg-yellow-400 bg-opacity-20 rounded'
        : isActive 
          ? 'text-white current-word' 
          : isPast 
            ? 'text-gray-200' 
            : 'text-gray-400'
    }`}
    style={isClicked ? { boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.3)' } : undefined}
  >
    {word.word}
  </span>
));

// Memoized Utterance Component
const UtteranceBlock = React.memo(({ 
  utterance, 
  utteranceIdx, 
  currentWordGlobal,
  clickedWord,
  previousUtterance 
}: {
  utterance: Utterance;
  utteranceIdx: number;
  currentWordGlobal: { utteranceIdx: number; wordIdx: number };
  clickedWord: { utteranceIdx: number; wordIdx: number } | null;
  previousUtterance?: Utterance;
}) => {
  // Calculate gap between this utterance and the previous one
  const hasLargeGap = previousUtterance ? 
    (utterance.start - previousUtterance.end) > 1.0 : false;
  
  return (
    <div className={`leading-relaxed ${hasLargeGap ? 'mt-6' : 'mt-1'}`}>
      {utterance.words.map((word, wordIdx) => {
        const isActive = currentWordGlobal.utteranceIdx === utteranceIdx && 
                        currentWordGlobal.wordIdx === wordIdx;
        const isPast = currentWordGlobal.utteranceIdx > utteranceIdx || 
                       (currentWordGlobal.utteranceIdx === utteranceIdx && 
                        currentWordGlobal.wordIdx > wordIdx);
        const isClicked = clickedWord?.utteranceIdx === utteranceIdx && 
                         clickedWord?.wordIdx === wordIdx;
        
        return (
          <WordSpan
            key={`${utteranceIdx}-${wordIdx}`}
            word={word}
            utteranceIdx={utteranceIdx}
            wordIdx={wordIdx}
            isActive={isActive}
            isPast={isPast}
            isClicked={isClicked}
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
  const [clickedWord, setClickedWord] = useState<{utteranceIdx: number, wordIdx: number} | null>(null);
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef(0);
  
  // Initialize user ID on component mount
  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);

  // Save/restore audio position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || hasRestoredPosition) return;

    const positionKey = `audio_position_${data.date}`;
    const lastTranscriptionKey = 'last_transcription_date';
    
    // Check if this is a new transcription
    const lastTranscriptionDate = localStorage.getItem(lastTranscriptionKey);
    const isNewTranscription = lastTranscriptionDate !== data.date;
    
    if (isNewTranscription) {
      // New transcription - start from beginning and clear old positions
      localStorage.setItem(lastTranscriptionKey, data.date);
      // Clear all old position keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('audio_position_') && key !== positionKey) {
          localStorage.removeItem(key);
        }
      });
      setHasRestoredPosition(true);
    } else {
      // Same transcription - restore position
      const savedPosition = localStorage.getItem(positionKey);
      if (savedPosition) {
        const position = parseFloat(savedPosition);
        audio.currentTime = position;
        setCurrentTime(position);
      }
      setHasRestoredPosition(true);
    }
  }, [data.date, hasRestoredPosition]);

  // Save position periodically while playing
  useEffect(() => {
    if (!hasRestoredPosition) return;
    
    const positionKey = `audio_position_${data.date}`;
    const savePosition = () => {
      if (audioRef.current) {
        localStorage.setItem(positionKey, audioRef.current.currentTime.toString());
      }
    };

    const interval = setInterval(() => {
      if (isPlaying) {
        savePosition();
      }
    }, 5000); // Save every 5 seconds

    // Also save on pause
    if (!isPlaying && audioRef.current) {
      savePosition();
    }

    return () => clearInterval(interval);
  }, [isPlaying, data.date, hasRestoredPosition]);
  
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
        transcript_id: data.date,
        utterance_id: utteranceIdx,
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
    
    // Show click highlight immediately
    setClickedWord({ utteranceIdx, wordIdx });
    setTimeout(() => setClickedWord(null), 400);
    
    if (clickTimerRef.current) {
      // Double click detected - seek to word position
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      seekToTime(startTime);
      // No tracking for double clicks
    } else {
      // Single click - pause audio and show translation immediately
      pauseAudio();
      const utterance = data.utterances[utteranceIdx];
      if (utterance?.translation) {
        setShowingTranslation({ utteranceIdx, wordIdx });
      }
      
      // Set timer to confirm single click and track it
      clickTimerRef.current = setTimeout(() => {
        // Track word click only after confirming it's a single click
        trackWordClick(utteranceIdx, wordIdx, word);
        clickTimerRef.current = null;
      }, 250);
    }
  }, [data.utterances, trackWordClick]);
  
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Hide translation when play button is clicked
    setShowingTranslation(null);
    
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
              clickedWord={clickedWord}
              previousUtterance={idx > 0 ? data.utterances[idx - 1] : undefined}
            />
          ))}
        </div>
      </div>
      
      {/* Translation Overlay */}
      {showingTranslation && (
        <div 
          className="absolute left-4 right-4 bg-black bg-opacity-90 backdrop-blur-sm rounded-lg p-4 z-10 cursor-pointer"
          style={{ bottom: 'calc(180px + env(safe-area-inset-bottom))' }}
          onClick={() => {
            setShowingTranslation(null);
            const audio = audioRef.current;
            if (audio) {
              audio.play();
              setIsPlaying(true);
            }
          }}
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