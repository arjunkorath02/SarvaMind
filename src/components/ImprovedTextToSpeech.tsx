
import React, { useState } from 'react';
import { Play, Pause, Volume2, Speaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sarvamAI } from './ImprovedSarvamAI';

interface ImprovedTextToSpeechProps {
  text: string;
  language?: string;
}

const ImprovedTextToSpeech: React.FC<ImprovedTextToSpeechProps> = ({ text, language = 'en-IN' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const speak = async () => {
    if (isPlaying && currentAudio) {
      // Stop current playback
      stop();
      return;
    }

    setIsLoading(true);
    try {
      // Try Sarvam AI TTS first
      const audioBase64 = await sarvamAI.textToSpeech(text, language);
      
      if (audioBase64) {
        // Play Sarvam AI generated audio
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audio.onplay = () => {
          setIsPlaying(true);
          setIsLoading(false);
        };
        audio.onended = () => {
          setIsPlaying(false);
          setCurrentAudio(null);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          setIsLoading(false);
          // Fallback to browser TTS
          fallbackTTS();
        };
        
        setCurrentAudio(audio);
        audio.play();
      } else {
        // Fallback to browser TTS
        fallbackTTS();
      }
    } catch (error) {
      console.error('TTS error:', error);
      fallbackTTS();
    }
  };

  const fallbackTTS = () => {
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Try to set language-specific voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.includes(language.substring(0, 2)) || 
        voice.lang.includes('en')
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };
      utterance.onend = () => {
        setIsPlaying(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setIsLoading(false);
    }
  };

  const stop = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setIsPlaying(false);
  };

  if (!('speechSynthesis' in window) && !currentAudio) {
    return null;
  }

  return (
    <Button
      onClick={speak}
      variant="ghost"
      size="sm"
      disabled={isLoading}
      className="text-muted-foreground hover:text-white"
      title={isPlaying ? "Stop speaking" : "Listen to message"}
    >
      {isLoading ? (
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : isPlaying ? (
        <Pause className="w-4 h-4" />
      ) : (
        <Speaker className="w-4 h-4" />
      )}
    </Button>
  );
};

export default ImprovedTextToSpeech;
