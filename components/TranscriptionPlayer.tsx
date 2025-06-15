import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, ChevronDown, Flag, Share } from 'lucide-react';
import { TranscriptionData, Word } from '@/lib/types';

interface TranscriptionPlayerProps {
  data: TranscriptionData;
}

export default function TranscriptionPlayer({ data }: TranscriptionPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Get all words with timing
  const allWords = data.utterances.flatMap(utterance => utterance.words);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    audio.addEventListener('timeupdate', updateTime);
    return () => audio.removeEventListener('timeupdate', updateTime);
  }, []);
  
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getRemainingTime = () => {
    return data.duration - currentTime;
  };
  
  // Auto-scroll to current word
  useEffect(() => {
    const currentWordElement = document.querySelector('.current-word');
    if (currentWordElement && scrollContainerRef.current) {
      currentWordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime]);
  
  return (
    <div className="h-screen-safe bg-gradient-to-b from-teal-900 to-teal-700 text-white flex flex-col">
      {/* Header */}

      
      {/* Title */}
      <div className="px-4 py-2 text-center">
        <h1 className="font-semibold truncate">{data.title}</h1>
      </div>
      
      {/* Transcription */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide"
      >
        <div className="space-y-1 pb-32">
          {data.utterances.map((utterance, idx) => (
            <div key={idx} className="">
              {utterance.words.map((word, wordIdx) => {
                const isCurrentWord = currentTime >= word.start && currentTime < word.end;
                const isPastWord = currentTime >= word.end;
                
                return (
                  <span
                    key={`${idx}-${wordIdx}`}
                    className={`inline-block mr-2 text-2xl font-medium transition-colors duration-300 ${
                      isCurrentWord 
                        ? 'text-white current-word' 
                        : isPastWord 
                          ? 'text-gray-400' 
                          : 'text-gray-500'
                    }`}
                  >
                    {word.word}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Player Controls */}
      <div className="backdrop-blur-sm p-4">
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