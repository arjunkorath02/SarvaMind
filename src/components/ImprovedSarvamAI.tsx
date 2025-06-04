
import { toast } from '@/hooks/use-toast';

interface SarvamResponse {
  translated_text?: string;
  audio_base64?: string;
  text?: string;
}

export class ImprovedSarvamAI {
  private apiKey: string;
  private baseURL: string = 'https://api.sarvam.ai';

  constructor(apiKey: string = '55e4a905-84c6-4b99-9ae2-0fe21f818fdc') {
    this.apiKey = apiKey;
  }

  // Improved message sending with echo prevention
  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    try {
      // Enhanced system prompt to prevent echoing
      const enhancedSystemPrompt = systemPrompt || 
        "You are a helpful AI assistant. Always provide unique, informative responses. " +
        "Never repeat the user's message back to them. If you don't understand something, ask clarifying questions. " +
        "Be conversational and helpful.";

      const response = await fetch(`${this.baseURL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.apiKey
        },
        body: JSON.stringify({
          input: `${enhancedSystemPrompt}\n\nUser: ${message}\nAssistant:`,
          source_language_code: 'hi-IN',
          target_language_code: 'en-IN',
          speaker_gender: 'Male',
          mode: 'formal',
          model: 'mayura:v1',
          enable_preprocessing: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Sarvam AI');
      }

      const data: SarvamResponse = await response.json();
      let aiResponse = data.translated_text || "I understand your message. How can I assist you further?";
      
      // Enhanced echo detection and prevention
      if (this.isEchoResponse(message, aiResponse)) {
        console.log('Echo detected, generating alternative response');
        
        // Try with a more specific prompt
        const retryResponse = await this.retryWithAlternativePrompt(message);
        if (retryResponse && !this.isEchoResponse(message, retryResponse)) {
          return retryResponse;
        }
        
        // If still echoing, return a helpful fallback
        return this.generateFallbackResponse(message);
      }
      
      return aiResponse;
    } catch (error) {
      console.error('Error calling Sarvam AI:', error);
      return "I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment.";
    }
  }

  // Enhanced echo detection
  private isEchoResponse(userMessage: string, aiResponse: string): boolean {
    const userLower = userMessage.toLowerCase().trim();
    const aiLower = aiResponse.toLowerCase().trim();
    
    // Direct match
    if (userLower === aiLower) return true;
    
    // Check if AI response starts with user message
    if (aiLower.startsWith(userLower) && aiLower.length < userLower.length + 20) return true;
    
    // Check similarity ratio
    const similarity = this.calculateSimilarity(userLower, aiLower);
    if (similarity > 0.8) return true;
    
    // Check if response is just a slight variation
    const words1 = userLower.split(' ');
    const words2 = aiLower.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    const similarityRatio = commonWords.length / Math.max(words1.length, words2.length);
    
    return similarityRatio > 0.9;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async retryWithAlternativePrompt(message: string): Promise<string | null> {
    try {
      const alternativePrompt = 
        "You are an intelligent AI assistant. The user has sent you a message. " +
        "Please provide a thoughtful, relevant response that adds value to the conversation. " +
        "Do not echo or repeat their message. Engage meaningfully with their query.";

      const response = await fetch(`${this.baseURL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.apiKey
        },
        body: JSON.stringify({
          input: `${alternativePrompt}\n\nUser message: "${message}"\n\nYour response:`,
          source_language_code: 'hi-IN',
          target_language_code: 'en-IN',
          speaker_gender: 'Female',
          mode: 'casual',
          model: 'mayura:v1',
          enable_preprocessing: true
        })
      });

      if (response.ok) {
        const data: SarvamResponse = await response.json();
        return data.translated_text || null;
      }
    } catch (error) {
      console.error('Error in retry attempt:', error);
    }
    return null;
  }

  private generateFallbackResponse(message: string): string {
    const fallbacks = [
      "That's an interesting point. Could you tell me more about what you're looking for?",
      "I'd be happy to help you with that. What specific aspect would you like me to focus on?",
      "Thank you for sharing that. How can I assist you further with this topic?",
      "I understand. What would you like to know more about regarding this?",
      "That's a good question. Let me help you explore that further. What's your main concern?"
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Translation functionality
  async translateText(text: string, targetLanguage: string, sourceLanguage: string = 'auto'): Promise<string> {
    try {
      const response = await fetch(`${this.baseURL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.apiKey
        },
        body: JSON.stringify({
          input: text,
          source_language_code: sourceLanguage === 'auto' ? 'en-IN' : sourceLanguage,
          target_language_code: targetLanguage,
          speaker_gender: 'Male',
          mode: 'formal',
          model: 'mayura:v1',
          enable_preprocessing: true
        })
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data: SarvamResponse = await response.json();
      return data.translated_text || text;
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Translation failed",
        description: "Could not translate the text. Please try again.",
        variant: "destructive",
      });
      return text;
    }
  }

  // Text-to-Speech functionality
  async textToSpeech(text: string, language: string = 'en-IN'): Promise<string | null> {
    try {
      // Since Sarvam AI doesn't have a direct TTS endpoint in the provided API,
      // we'll use a placeholder that could be replaced with actual Sarvam TTS when available
      const response = await fetch(`${this.baseURL}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.apiKey
        },
        body: JSON.stringify({
          input: text,
          target_language_code: language,
          speaker_gender: 'Male',
          model: 'bulbul:v1'
        })
      });

      if (!response.ok) {
        // Fallback to Web Speech API if Sarvam TTS is not available
        return this.fallbackTTS(text);
      }

      const data: SarvamResponse = await response.json();
      return data.audio_base64 || null;
    } catch (error) {
      console.error('TTS error:', error);
      return this.fallbackTTS(text);
    }
  }

  private fallbackTTS(text: string): Promise<string | null> {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        utterance.onend = () => resolve(null);
        utterance.onerror = () => resolve(null);
        
        window.speechSynthesis.speak(utterance);
        resolve(null); // Return null as we're using browser TTS directly
      } else {
        resolve(null);
      }
    });
  }

  // Auto-detect language
  async detectLanguage(text: string): Promise<string> {
    // Simple language detection based on character patterns
    const hindiPattern = /[\u0900-\u097F]/;
    const arabicPattern = /[\u0600-\u06FF]/;
    const chinesePattern = /[\u4e00-\u9fff]/;
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
    
    if (hindiPattern.test(text)) return 'hi-IN';
    if (arabicPattern.test(text)) return 'ar';
    if (chinesePattern.test(text)) return 'zh';
    if (japanesePattern.test(text)) return 'ja';
    
    return 'en-IN'; // Default to English
  }
}

export const sarvamAI = new ImprovedSarvamAI();
