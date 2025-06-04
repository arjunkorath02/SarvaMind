
import React, { useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TextToSpeechProps {
  text: string;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

  const speak = () => {
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      const newUtterance = new SpeechSynthesisUtterance(text);
      newUtterance.rate = 0.9;
      newUtterance.pitch = 1;
      newUtterance.volume = 1;

      newUtterance.onstart = () => setIsPlaying(true);
      newUtterance.onend = () => setIsPlaying(false);
      newUtterance.onerror = () => setIsPlaying(false);

      setUtterance(newUtterance);
      window.speechSynthesis.speak(newUtterance);
    }
  };

  const stop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  if (!('speechSynthesis' in window)) {
    return null;
  }

  return (
    <Button
      onClick={isPlaying ? stop : speak}
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-white"
      title={isPlaying ? "Stop speaking" : "Listen to message"}
    >
      {isPlaying ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </Button>
  );
};

export default TextToSpeech;
