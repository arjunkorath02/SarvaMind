
import React, { useState } from 'react';
import { Languages, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TranslationFeatureProps {
  text: string;
  onTranslate: (translatedText: string, targetLang: string) => void;
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

const TranslationFeature: React.FC<TranslationFeatureProps> = ({ text, onTranslate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    try {
      // Mock translation - replace with actual translation API
      const mockTranslation = `[Translated to ${languages.find(l => l.code === targetLanguage)?.name}] ${text}`;
      setTranslatedText(mockTranslation);
      onTranslate(mockTranslation, targetLanguage);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-white flex items-center gap-2"
      >
        <Languages className="w-4 h-4" />
        Translate
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>

      {isExpanded && (
        <div className="glass-card p-3 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger className="w-full bg-transparent border-primary/30">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleTranslate}
              disabled={isTranslating}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              {isTranslating ? 'Translating...' : 'Translate'}
            </Button>
          </div>

          {translatedText && (
            <div className="p-3 bg-primary/10 rounded border border-primary/20">
              <p className="text-sm text-white">{translatedText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranslationFeature;
