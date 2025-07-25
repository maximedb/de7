import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, ChevronDown, List, FileText, SkipBack, SkipForward } from 'lucide-react';
import { Word, Utterance, TranscriptionData } from '../lib/types';
import { insertWordClick, getWordClicksByDate, WordClick } from '../lib/supabase';

type Language = 'en' | 'fr';
type Tab = 'transcription' | 'clicks';

// Simple Word Component
interface WordSpanProps {
  word: Word;
  isPast: boolean;
}

const WordSpan: React.FC<WordSpanProps> = ({ word, isPast }) => (
  <span
    className={`inline-block mr-1 text-2xl sm:text-3xl font-medium transition-all duration-300 cursor-pointer select-none break-words ${
      isPast ? 'text-gray-200' : 'text-gray-400'
    }`}
  >
    {word.word}
  </span>
);

// Simple Utterance Component
interface UtteranceBlockProps {
  utterance: Utterance;
  utteranceIdx: number;
  currentTime: number;
  showingTranslation: { utteranceIdx: number } | null;
  selectedLanguage: Language;
  setShowingTranslation: (value: { utteranceIdx: number } | null) => void;
  previousUtterance?: Utterance;
}

const UtteranceBlock: React.FC<UtteranceBlockProps> = ({ 
  utterance, 
  utteranceIdx,
  currentTime,
  showingTranslation,
  selectedLanguage,
  setShowingTranslation,
  previousUtterance
}) => {
  const hasLargeGap = previousUtterance ? 
    (utterance.start - previousUtterance.end) > 1.0 : false;
  
  const isShowingTranslation = showingTranslation?.utteranceIdx === utteranceIdx;
  const translation = utterance?.translations?.[selectedLanguage] || 
                     (selectedLanguage === 'en' && utterance?.translation);
  
  return (
    <div className={`leading-relaxed ${hasLargeGap ? 'mt-6' : 'mt-1'}`}>
      <div 
        className="utterance-words cursor-pointer"
        onClick={() => {
          if (translation) {
            setShowingTranslation(isShowingTranslation ? null : { utteranceIdx });
          }
        }}
      >
        {utterance.words.map((word, wordIdx) => (
          <WordSpan
            key={`${utteranceIdx}-${wordIdx}`}
            word={word}
            isPast={currentTime >= word.start}
          />
        ))}
      </div>
      
      {isShowingTranslation && translation && (
        <div 
          className="my-2 -mx-4 bg-black bg-opacity-60 p-4 transition-all duration-300 ease-out cursor-pointer hover:bg-opacity-70"
          style={{
            boxShadow: 'inset rgba(0, 0, 0, 0.3) 0px 8px 32px, inset rgba(0, 0, 0, 0.2) 0px 2px 16px',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowingTranslation(null);
          }}
        >
          <div className="text-lg text-white leading-relaxed">
            {translation}
          </div>
        </div>
      )}
    </div>
  );
};

// Clicks List Component
interface ClicksListProps {
  clicks: WordClick[];
}

const ClicksList: React.FC<ClicksListProps> = ({ clicks }) => {
  const [showingTranslation, setShowingTranslation] = useState<number | null>(null);

  const formatTimestamp = (timestamp: string | Date): string => {
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
                <p className="text-gray-100 text-base leading-relaxed">
                  {click.utterance}
                </p>
              </div>
              
              {isShowingTranslation && click.translation && (
                <div 
                  className="mx-2 mb-2 bg-black bg-opacity-60 p-4 rounded-lg transition-all duration-300 ease-out"
                  style={{
                    boxShadow: 'inset rgba(0, 0, 0, 0.3) 0px 8px 32px, inset rgba(0, 0, 0, 0.2) 0px 2px 16px',
                    backdropFilter: 'blur(8px)',
                  }}
                >
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
};

// Main Component Props
interface TranscriptionPlayerProps {
  data: TranscriptionData;
  currentDate?: string;
  availableDates?: string[];
}

export default function TranscriptionPlayer({ 
  data, 
  currentDate, 
  availableDates 
}: TranscriptionPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [showingTranslation, setShowingTranslation] = useState<{ utteranceIdx: number } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab>('transcription');
  const [wordClicks, setWordClicks] = useState<WordClick[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState<boolean>(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize language preference
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferred_language') as Language | null;
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

  // Track audio loading state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsLoading(false);
      setHasStartedPlayback(true);
    };
    const handlePause = () => setIsLoading(false);
    const handleError = () => setIsLoading(false);
    
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [data.audioUrl]);

  // Reset when switching dates
  useEffect(() => {
    setIsPlaying(false);
    setIsLoading(false);
    setHasStartedPlayback(false);
    setCurrentTime(0);
    setShowingTranslation(null);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      delete audioRef.current.dataset.pendingPosition;
    }
  }, [currentDate]);

  // Save/restore audio position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentPath = window.location.pathname;
    const positionKey = `audio_position${currentPath}`;
    
    const savedPosition = localStorage.getItem(positionKey);
    if (savedPosition) {
      const position = parseFloat(savedPosition);
      
      // Always update React state immediately
      setCurrentTime(position);
      
      // Try to set audio position, with fallback for iOS/restrictions
      try {
        if (audio.readyState >= 1) {
          audio.currentTime = position;
        } else {
          // Store for later setting
          audio.dataset.pendingPosition = position.toString();
        }
      } catch (e) {
        // Store for later setting if immediate setting fails
        audio.dataset.pendingPosition = position.toString();
      }
    }
  }, []);

  // Handle pending position setting for cases where immediate setting failed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      const pendingPosition = audio.dataset.pendingPosition;
      if (pendingPosition) {
        const position = parseFloat(pendingPosition);
        try {
          audio.currentTime = Math.min(position, audio.duration || 0);
          setCurrentTime(audio.currentTime);
          delete audio.dataset.pendingPosition;
        } catch (e) {
          console.warn('Could not set audio position:', e);
        }
      }
    };
    
    const handlePlaying = () => {
      // Fallback: try to set position once playing starts
      const pendingPosition = audio.dataset.pendingPosition;
      if (pendingPosition) {
        setTimeout(() => {
          try {
            const position = parseFloat(pendingPosition);
            audio.currentTime = Math.min(position, audio.duration || 0);
            setCurrentTime(audio.currentTime);
            delete audio.dataset.pendingPosition;
          } catch (e) {
            console.warn('Could not set audio position during playback:', e);
          }
        }, 100);
      }
    };
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('playing', handlePlaying);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('playing', handlePlaying);
    };
  }, []);

  // Save position periodically
  useEffect(() => {
    const currentPath = window.location.pathname;
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
    }, 5000);

    if (!isPlaying && audioRef.current) {
      savePosition();
    }

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Simple time update every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to center
  useEffect(() => {
    if (!scrollContainerRef.current || !isPlaying) return;
    
    const container = scrollContainerRef.current;
    const utterances = data.utterances;
    
    // Find current utterance based on time
    let currentUtteranceElement: HTMLElement | null = null;
    for (let i = 0; i < utterances.length; i++) {
      const utterance = utterances[i];
      if (currentTime >= utterance.start && currentTime <= utterance.end) {
        currentUtteranceElement = container.querySelector(`[data-utterance="${i}"]`);
        break;
      }
    }
    
    if (currentUtteranceElement) {
      currentUtteranceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime, isPlaying, data.utterances]);

  const handleUtteranceClick = useCallback(async (utteranceIdx: number) => {
    pauseAudio();
    
    const utterance = data.utterances[utteranceIdx];
    if (!utterance) return;
    
    // Track the click
    const fullUtterance = utterance.words.map(w => w.word).join(' ');
    const translation = utterance?.translations?.[selectedLanguage] || 
                       (selectedLanguage === 'en' && utterance?.translation);
    
    try {
      await insertWordClick({
        transcript_id: data.date,
        utterance_id: utteranceIdx,
        utterance: fullUtterance,
        word: fullUtterance.split(' ')[0], // Just use first word for simplicity
        translation: translation || undefined,
      });
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }, [data.utterances, data.date, selectedLanguage]);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    setShowingTranslation(null);
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        setIsLoading(true);
        
        // Get saved position before starting playback
        const currentPath = window.location.pathname;
        const positionKey = `audio_position${currentPath}`;
        const savedPosition = localStorage.getItem(positionKey);
        
        // If we have a saved position and haven't started playback yet, set it
        if (savedPosition && !hasStartedPlayback) {
          const position = parseFloat(savedPosition);
          
          // Try to set position immediately
          try {
            audio.currentTime = position;
            setCurrentTime(position);
          } catch (e) {
            // If immediate setting fails, we'll try again after metadata loads
            audio.dataset.pendingPosition = position.toString();
          }
        }
        
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          await playPromise;
        }
        
        setIsPlaying(true);
        
      } catch (error) {
        console.error('Playback failed:', error);
        setIsPlaying(false);
        setIsLoading(false);
        // Optionally show user-friendly error message
      }
    }
  }, [isPlaying, hasStartedPlayback]);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.pause();
    setIsPlaying(false);
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-teal-900 to-teal-700 text-white flex flex-col overflow-hidden">
      
      {/* Tab Toggle */}
      <div className="z-10 bg-teal-900 absolute w-full flex-shrink-0 px-4 py-4 flex justify-center">
        <div className="relative bg-teal-800 rounded-full p-1 w-full">
          <button
            onClick={() => {
              const newTab: Tab = activeTab === 'transcription' ? 'clicks' : 'transcription';
              setActiveTab(newTab);
              if (newTab === 'clicks') {
                loadWordClicks();
              }
            }}
            className="relative w-full h-6 rounded-full"
          >
            <div 
              className={`absolute top-0 left-0 w-1/2 h-full bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out ${
                activeTab === 'clicks' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
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
      
      {/* Main Content */}
      {activeTab === 'transcription' ? (
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 min-h-0 pt-16"
        >
          <div className="pb-8 w-full">
            {data.utterances.map((utterance, idx) => (
              <div key={idx} data-utterance={idx} onClick={() => handleUtteranceClick(idx)}>
                <UtteranceBlock
                  utterance={utterance}
                  utteranceIdx={idx}
                  currentTime={currentTime}
                  showingTranslation={showingTranslation}
                  selectedLanguage={selectedLanguage}
                  setShowingTranslation={setShowingTranslation}
                  previousUtterance={idx > 0 ? data.utterances[idx - 1] : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ClicksList clicks={wordClicks} />
      )}
      
      {/* Player Controls */}
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
              <span>-{formatTime(data.duration - currentTime)}</span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="relative flex items-center justify-center">
            {/* Date Dropdown */}
            <div className="absolute left-0">
              {availableDates && availableDates.length > 0 && (
                <select
                  value={currentDate || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    if (e.target.value) {
                      window.location.href = `/${e.target.value}`;
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
              )}
            </div>
            
            {/* Play Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={seekBackward}
                className="w-10 h-10 bg-teal-700 hover:bg-teal-600 rounded-full flex items-center justify-center text-white transition-colors shadow-md"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              
              <button
                onClick={togglePlayPause}
                className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all bg-white text-black hover:scale-105 cursor-pointer"
              >
                {isLoading && (
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gray-400 animate-spin"></div>
                )}
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>
              
              <button
                onClick={seekForward}
                className="w-10 h-10 bg-teal-700 hover:bg-teal-600 rounded-full flex items-center justify-center text-white transition-colors shadow-md"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            
            {/* Language Selector */}
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