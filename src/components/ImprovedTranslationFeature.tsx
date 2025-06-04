
import React, { useState } from 'react';
import { Languages, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { sarvamAI } from './ImprovedSarvamAI';

interface ImprovedTranslationFeatureProps {
  text: string;
  onTranslate: (translatedText: string, targetLang: string) => void;
}

const languages = [
  { code: 'en-IN', name: 'English' },
  { code: 'hi-IN', name: 'Hindi' },
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
];

const ImprovedTranslationFeature: React.FC<ImprovedTranslationFeatureProps> = ({ text, onTranslate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('hi-IN');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [showOriginal, setShowOriginal] = useState(true);

  const handleTranslate = async () => {
    setIsTranslating(true);
    try {
      // Auto-detect source language
      const detected = await sarvamAI.detectLanguage(text);
      setDetectedLanguage(detected);

      // Translate using Sarvam AI
      const translated = await sarvamAI.translateText(text, targetLanguage, detected);
      setTranslatedText(translated);
      onTranslate(translated, targetLanguage);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const getLanguageName = (code: string) => {
    return languages.find(lang => lang.code === code)?.name || code;
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

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent className="space-y-3">
          <div className="glass-card p-3 rounded-lg space-y-3">
            {/* Language Detection */}
            {detectedLanguage && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="w-3 h-3" />
                Detected: {getLanguageName(detectedLanguage)}
              </div>
            )}

            {/* Translation Controls */}
            <div className="flex items-center gap-2">
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="flex-1 bg-transparent border-primary/30">
                  <SelectValue placeholder="Select target language" />
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

            {/* Translation Results */}
            {translatedText && (
              <div className="space-y-2">
                {/* Toggle View */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowOriginal(!showOriginal)}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-white"
                  >
                    {showOriginal ? 'Show Translation Only' : 'Show Both'}
                  </Button>
                </div>

                {/* Original Text */}
                {showOriginal && (
                  <div className="p-3 bg-muted/10 rounded border border-muted/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Original ({getLanguageName(detectedLanguage || 'en-IN')})
                      </span>
                    </div>
                    <p className="text-sm text-white">{text}</p>
                  </div>
                )}

                {/* Translated Text */}
                <div className="p-3 bg-primary/10 rounded border border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-primary">
                      Translation ({getLanguageName(targetLanguage)})
                    </span>
                  </div>
                  <p className="text-sm text-white">{translatedText}</p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ImprovedTranslationFeature;
