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

  // Improved message sending with better context handling and echo prevention
  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    try {
      // Enhanced system prompt to prevent echoing and maintain context
      const enhancedSystemPrompt = systemPrompt || 
        "You are SarvaMind, a helpful AI assistant. Provide clear, accurate, and helpful responses. " +
        "Do not repeat the user's input in your response. " +
        "If you see conversation history, respond naturally to continue the conversation. " +
        "Be conversational and provide valuable insights.";

      // Clean the input to remove any formatting that might cause echo
      const cleanInput = message.replace(/^(Previous conversation:|Current user message:|Context:)/gm, '').trim();

      const response = await fetch(`${this.baseURL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.apiKey
        },
        body: JSON.stringify({
          input: `${enhancedSystemPrompt}\n\nUser: ${cleanInput}\nAssistant:`,
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
      let aiResponse = data.translated_text || "I understand. How can I assist you further?";
      
      // Enhanced echo detection and prevention
      if (this.isEchoOrPoorResponse(cleanInput, aiResponse)) {
        console.log('Echo or poor response detected, generating alternative');
        
        // Try with a more specific prompt
        const retryResponse = await this.retryWithAlternativePrompt(cleanInput);
        if (retryResponse && !this.isEchoOrPoorResponse(cleanInput, retryResponse)) {
          return retryResponse;
        }
        
        // If still echoing, return a helpful fallback
        return this.generateContextualFallback(cleanInput);
      }
      
      // Clean up the response to remove any unwanted prefixes
      aiResponse = this.cleanResponse(aiResponse, cleanInput);
      
      return aiResponse;
    } catch (error) {
      console.error('Error calling Sarvam AI:', error);
      return "I apologize, but I'm having trouble connecting right now. Could you please try again?";
    }
  }

  // Enhanced echo detection
  private isEchoOrPoorResponse(userMessage: string, aiResponse: string): boolean {
    const userLower = userMessage.toLowerCase().trim();
    const aiLower = aiResponse.toLowerCase().trim();
    
    // Direct match
    if (userLower === aiLower) return true;
    
    // Check if AI response starts with user message
    if (aiLower.startsWith(userLower) && aiLower.length < userLower.length + 30) return true;
    
    // Check if response contains too much of the user input
    if (userMessage.length > 10 && aiLower.includes(userLower)) {
      const similarity = this.calculateSimilarity(userLower, aiLower);
      if (similarity > 0.7) return true;
    }
    
    // Check for generic/poor responses
    const poorResponses = [
      'i understand your message',
      'thank you for sharing',
      'i see what you mean',
      'that makes sense',
      'i comprehend'
    ];
    
    if (poorResponses.some(poor => aiLower.includes(poor) && aiLower.length < 50)) {
      return true;
    }
    
    // Check similarity ratio
    const similarity = this.calculateSimilarity(userLower, aiLower);
    if (similarity > 0.85) return true;
    
    return false;
  }

  private cleanResponse(response: string, userInput: string): string {
    // Remove common unwanted prefixes
    const prefixesToRemove = [
      'user:',
      'assistant:',
      'ai:',
      'sarvamind:',
      'response:',
      'answer:'
    ];
    
    let cleaned = response;
    for (const prefix of prefixesToRemove) {
      if (cleaned.toLowerCase().startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }
    
    // If response still contains the user input, try to extract just the AI part
    if (userInput.length > 10 && cleaned.toLowerCase().includes(userInput.toLowerCase())) {
      const parts = cleaned.split(userInput);
      if (parts.length > 1 && parts[1].trim().length > 0) {
        cleaned = parts[1].trim();
      }
    }
    
    return cleaned;
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
        "You are SarvaMind, an intelligent AI assistant. The user has asked you something. " +
        "Provide a helpful, informative response that directly addresses their query. " +
        "Be specific and add value to the conversation. Do not repeat their question.";

      const response = await fetch(`${this.baseURL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.apiKey
        },
        body: JSON.stringify({
          input: `${alternativePrompt}\n\nQuery: ${message}\n\nResponse:`,
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

  private generateContextualFallback(message: string): string {
    // Analyze the message to provide more contextual fallbacks
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('code') || messageLower.includes('program')) {
      return "I can help you with coding questions. What specific programming language or problem are you working on?";
    }
    
    if (messageLower.includes('help') || messageLower.includes('assist')) {
      return "I'm here to help! Could you provide more details about what you need assistance with?";
    }
    
    if (messageLower.includes('explain') || messageLower.includes('what is')) {
      return "I'd be happy to explain that for you. Could you be more specific about which aspect you'd like me to focus on?";
    }
    
    if (messageLower.includes('how')) {
      return "That's a great question! To give you the most helpful answer, could you provide a bit more context about your situation?";
    }
    
    // Generic fallbacks
    const fallbacks = [
      "That's an interesting topic. What specific aspect would you like to explore further?",
      "I'd be happy to help you with that. Could you provide more details about your question?",
      "Thank you for your message. What would you like to know more about?",
      "I understand you're looking for information. What specific details can I help you with?",
      "That's a good point. How can I assist you in exploring this topic further?"
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
