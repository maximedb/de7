import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, ChevronDown, List, FileText, SkipBack, SkipForward } from 'lucide-react';
import { useRouter } from 'next/router';
import { getUserId } from '../lib/userId';
import { insertWordClick, getWordClicksByDate, WordClick } from '../lib/supabase';
import { Word, Utterance, TranscriptionData } from '../lib/types';

type Language = 'en' | 'fr';
type Tab = 'transcription' | 'clicks';

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
  previousUtterance,
  showingTranslation,
  selectedLanguage,
  setShowingTranslation
}: {
  utterance: Utterance;
  utteranceIdx: number;
  currentWordGlobal: { utteranceIdx: number; wordIdx: number };
  clickedWord: { utteranceIdx: number; wordIdx: number } | null;
  previousUtterance?: Utterance;
  showingTranslation: { utteranceIdx: number } | null;
  selectedLanguage: Language;
  setShowingTranslation: (value: { utteranceIdx: number } | null) => void;
}) => {
  // Calculate gap between this utterance and the previous one
  const hasLargeGap = previousUtterance ? 
    (utterance.start - previousUtterance.end) > 1.0 : false;
  
  const isShowingTranslation = showingTranslation?.utteranceIdx === utteranceIdx;
  const translation = utterance?.translations?.[selectedLanguage] || 
                     (selectedLanguage === 'en' && utterance?.translation);
  
  return (
    <div className={`leading-relaxed ${hasLargeGap ? 'mt-6' : 'mt-1'}`}>
      {/* Words */}
      <div className="utterance-words">
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
      
      {/* Translation Panel - appears below utterance */}
      {isShowingTranslation && translation && (
        <div className="my-2 -mx-4 bg-black bg-opacity-60 p-4 inset-shadow-2xl transform transition-all duration-300 ease-out cursor-pointer hover:bg-opacity-70"
             style={{
               boxShadow: 'inset rgba(0, 0, 0, 0.3) 0px 8px 32px, inset rgba(0, 0, 0, 0.2) 0px 2px 16px',
               backdropFilter: 'blur(8px)',
             }}
             onClick={(e) => {
               e.stopPropagation();
               setShowingTranslation(null);
             }}>
          {/* <div className="text-xs text-gray-300 mb-2 font-medium">
            {selectedLanguage === 'en' ? 'English Translation:' : 'Traduction française :'}
          </div> */}
          <div className="text-lg text-white leading-relaxed">
            {translation}
          </div>
        </div>
      )}
    </div>
  );
});

// Clicks List Component
const ClicksList = React.memo(({ 
  clicks, 
  onClickClick 
}: { 
  clicks: WordClick[];
  onClickClick: (click: WordClick) => void;
}) => {
  const [showingTranslation, setShowingTranslation] = useState<number | null>(null);

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (clicks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <List className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No clicks yet</p>
          <p className="text-sm">Click on words in the transcription to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pt-16">
      <div className="space-y-3">
        {clicks.map((click, index) => {
          const isShowingTranslation = showingTranslation === index;
          return (
            <div key={click.id || index}>
              <div
                onClick={() => {
                  if (click.translation) {
                    setShowingTranslation(isShowingTranslation ? null : index);
                  }
                }}
                className="bg-teal-800 bg-opacity-30 rounded-lg p-4 cursor-pointer hover:bg-opacity-50 transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-yellow-300 font-semibold text-lg">
                    "{click.word}"
                  </span>
                  <span className="text-gray-300 text-sm">
                    {formatTimestamp(click.timestamp || new Date())}
                  </span>
                </div>
                <p className="text-gray-100 text-base leading-relaxed">
                  {click.utterance}
                </p>
              </div>
              
              {/* Translation Panel */}
              {isShowingTranslation && click.translation && (
                <div className="mx-2 mb-2 bg-black bg-opacity-60 p-4 rounded-lg transition-all duration-300 ease-out"
                     style={{
                       boxShadow: 'inset rgba(0, 0, 0, 0.3) 0px 8px 32px, inset rgba(0, 0, 0, 0.2) 0px 2px 16px',
                       backdropFilter: 'blur(8px)',
                     }}>
                  <div className="text-lg text-white leading-relaxed">
                    {click.translation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default function TranscriptionPlayer({ 
  data, 
  currentDate, 
  availableDates 
}: { 
  data: TranscriptionData;
  currentDate?: string;
  availableDates?: string[];
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showingTranslation, setShowingTranslation] = useState<{utteranceIdx: number} | null>(null);
  const [currentWordGlobal, setCurrentWordGlobal] = useState({ utteranceIdx: 0, wordIdx: 0 });
  const [userId, setUserId] = useState<string>('');
  const [clickedWord, setClickedWord] = useState<{utteranceIdx: number, wordIdx: number} | null>(null);
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('transcription');
  const [wordClicks, setWordClicks] = useState<WordClick[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef(0);
  const router = useRouter();
  
  // Reset state when switching between dates/URLs
  useEffect(() => {
    // Reset audio state when date changes
    setIsPlaying(false);
    setCurrentTime(0);
    setShowingTranslation(null);
    setCurrentWordGlobal({ utteranceIdx: 0, wordIdx: 0 });
    setClickedWord(null);
    setHasRestoredPosition(false);
    
    // Reset audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [currentDate]);
  
  // Initialize user ID and language preference on component mount
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const id = await getUserId();
        setUserId(id);
      } catch (error) {
        console.error('Failed to initialize user:', error);
      }
    };
    
    initializeUser();
    
    // Restore saved language preference
    const savedLanguage = localStorage.getItem('preferred_language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'fr')) {
      setSelectedLanguage(savedLanguage);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.language-selector')) {
        setShowLanguageDropdown(false);
      }
    };

    if (showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLanguageDropdown]);

  // Save/restore audio position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || hasRestoredPosition) return;

    // Use current URL path as the key for position tracking
    const currentPath = window.location.pathname; // e.g., "/2025-10-05"
    const positionKey = `audio_position${currentPath}`;
    
    // Try to restore saved position for this specific URL
    const savedPosition = localStorage.getItem(positionKey);
    if (savedPosition) {
      const position = parseFloat(savedPosition);
      audio.currentTime = position;
      setCurrentTime(position);
      
      // Immediately sync word highlighting with restored position
      const syncWordHighlighting = () => {
        const time = position;
        let found = false;
        
        for (let uIdx = 0; uIdx < data.utterances.length && !found; uIdx++) {
          const utterance = data.utterances[uIdx];
          for (let wIdx = 0; wIdx < utterance.words.length; wIdx++) {
            const word = utterance.words[wIdx];
            if (time >= word.start && time < word.end) {
              setCurrentWordGlobal({ utteranceIdx: uIdx, wordIdx: wIdx });
              found = true;
              break;
            }
          }
        }
      };
      
      syncWordHighlighting();
    }
    // If no saved position, start from beginning (default behavior)
    
    setHasRestoredPosition(true);
  }, [hasRestoredPosition, data.utterances]);

  // Save position periodically while playing
  useEffect(() => {
    if (!hasRestoredPosition) return;
    
    const currentPath = window.location.pathname; // e.g., "/2025-10-05"
    const positionKey = `audio_position${currentPath}`;
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
  }, [isPlaying, hasRestoredPosition]);
  
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
  const trackWordClick = useCallback(async (utteranceIdx: number, wordIdx: number, word: string) => {
    const utterance = data.utterances[utteranceIdx];
    if (!utterance) return;
    
    const fullUtterance = utterance.words.map(w => w.word).join(' ');
    // Get the translation that was shown to the user
    const translation = utterance?.translations?.[selectedLanguage] || 
                       (selectedLanguage === 'en' && utterance?.translation);
    
    // Fire and forget - don't await or block UI
    (async () => {
      try {
        // Insert word click directly to Supabase (user auth is handled automatically)
        await insertWordClick({
          transcript_id: data.date,
          utterance_id: utteranceIdx,
          utterance: fullUtterance,
          word: word,
          translation: translation || undefined,
        });
      } catch (error) {
        console.error('Failed to track word click:', error);
      }
    })();
  }, [data.utterances, selectedLanguage]);

  const handleTranscriptClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.dataset.utterance) return;
    
    const utteranceIdx = parseInt(target.dataset.utterance);
    const wordIdx = parseInt(target.dataset.word || '0');
    const word = target.textContent || '';
    
    // Show click highlight immediately
    setClickedWord({ utteranceIdx, wordIdx });
    setTimeout(() => setClickedWord(null), 400);
    
    // Single click - pause audio and show translation immediately
    pauseAudio();
    const utterance = data.utterances[utteranceIdx];
    // Support both new translations object and legacy translation field
    const hasTranslation = utterance?.translations?.[selectedLanguage] || 
                          (selectedLanguage === 'en' && utterance?.translation);
    if (hasTranslation) {
      setShowingTranslation({ utteranceIdx });
    }
    
    // Track word click immediately
    trackWordClick(utteranceIdx, wordIdx, word);
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
  
  const seekBackward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = Math.max(0, audio.currentTime - 15);
  }, []);
  
  const seekForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = Math.min(data.duration, audio.currentTime + 15);
  }, [data.duration]);
  
  const changeLanguage = useCallback((language: Language) => {
    setSelectedLanguage(language);
    localStorage.setItem('preferred_language', language);
    setShowLanguageDropdown(false);
    setShowingTranslation(null);
  }, []);
  
  const loadWordClicks = useCallback(async () => {
    if (!data.date) return;
    try {
      const clicks = await getWordClicksByDate(data.date);
      setWordClicks(clicks);
    } catch (error) {
      console.error('Failed to load word clicks:', error);
      setWordClicks([]);
    }
  }, [data.date]);
  
  const switchToClicksTab = useCallback(() => {
    setActiveTab('clicks');
    loadWordClicks();
  }, [loadWordClicks]);
  
  const handleClickClick = useCallback((click: WordClick) => {
    // This function is no longer used since translations show in place
    // Kept for interface compatibility
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
      
      {/* iOS-style Toggle Button */}
      <div className="bg-teal-900 absolute w-full flex-shrink-0 px-4 py-4 flex justify-center">
        <div className="relative bg-teal-800 rounded-full p-1 w-full">
          <button
            onClick={() => {
              const newTab = activeTab === 'transcription' ? 'clicks' : 'transcription';
              setActiveTab(newTab);
              if (newTab === 'clicks') {
                loadWordClicks();
              }
            }}
            className="relative w-full h-6 rounded-full"
          >
            {/* Sliding pill */}
            <div 
              className={`absolute top-0 left-0 w-1/2 h-full bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out ${
                activeTab === 'clicks' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            
            {/* Labels */}
            <div className="relative z-10 flex h-full">
              <div className={`flex-1 flex items-center justify-center text-sm font-medium transition-colors duration-300 ${
                activeTab === 'transcription' ? 'text-teal-800' : 'text-white'
              }`}>
                Text
              </div>
              <div className={`flex-1 flex items-center justify-center text-sm font-medium transition-colors duration-300 ${
                activeTab === 'clicks' ? 'text-teal-800' : 'text-white'
              }`}>
                Clicks
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      {activeTab === 'transcription' ? (
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 min-h-0 pt-16"
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
                showingTranslation={showingTranslation}
                selectedLanguage={selectedLanguage}
                setShowingTranslation={setShowingTranslation}
              />
            ))}
          </div>
        </div>
      ) : (
        <ClicksList
          clicks={wordClicks}
          onClickClick={handleClickClick}
        />
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
          
          {/* Bottom Controls: Date Dropdown, Play Button, Language Selector */}
          <div className="relative flex items-center justify-center">
            {/* Date Dropdown - Absolute positioned to left */}
            <div className="absolute left-0">
              {availableDates && availableDates.length > 0 && (
                <div className="relative">
                  <select
                    value={currentDate || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        router.push(`/${e.target.value}`);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value) {
                        router.push(`/${e.target.value}`);
                      }
                    }}
                    className="bg-teal-800 hover:bg-teal-700 text-white px-2 py-1 rounded-md text-xs font-medium border-none outline-none cursor-pointer"
                  >
                    {availableDates.map(date => (
                      <option key={date} value={date} className="bg-teal-800">
                        {new Date(date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit'
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {/* Play Controls - Centered */}
            <div className="flex items-center space-x-3">
              {/* -15s Button */}
              <button
                onClick={seekBackward}
                className="w-10 h-10 bg-teal-700 hover:bg-teal-600 rounded-full flex items-center justify-center text-white transition-colors shadow-md"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              
              {/* Play Button */}
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
              
              {/* +15s Button */}
              <button
                onClick={seekForward}
                className="w-10 h-10 bg-teal-700 hover:bg-teal-600 rounded-full flex items-center justify-center text-white transition-colors shadow-md"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            
            {/* Language Selector - Absolute positioned to right */}
            <div className="absolute right-0 language-selector">
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center space-x-1 bg-teal-800 hover:bg-teal-700 px-2 py-1 rounded-md transition-colors"
              >
                <span className="text-xs font-medium">{selectedLanguage.toUpperCase()}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showLanguageDropdown && (
                <div className="absolute right-0 bottom-full mb-1 bg-teal-800 rounded-md shadow-lg z-20 min-w-[60px]">
                  <button
                    onClick={() => changeLanguage('en')}
                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-teal-700 rounded-t-md ${
                      selectedLanguage === 'en' ? 'bg-teal-700' : ''
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => changeLanguage('fr')}
                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-teal-700 rounded-b-md ${
                      selectedLanguage === 'fr' ? 'bg-teal-700' : ''
                    }`}
                  >
                    FR
                  </button>
                </div>
              )}
            </div>
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