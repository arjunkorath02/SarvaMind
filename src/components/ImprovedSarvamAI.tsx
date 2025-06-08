
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

  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('Sending message to Sarvam AI:', { message: message.substring(0, 100), systemPrompt });

      const enhancedSystemPrompt = systemPrompt || 
        "You are SarvaMind, a helpful AI assistant. Provide clear, accurate, and helpful responses. " +
        "Be conversational and provide valuable insights. " +
        "If the user has shared files, acknowledge them appropriately.";

      const cleanInput = this.cleanInputMessage(message);
      console.log('Cleaned input:', cleanInput.substring(0, 100));

      const prompt = `${enhancedSystemPrompt}\n\nUser Query: ${cleanInput}\n\nAssistant Response:`;

      const response = await fetch(`${this.baseURL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.apiKey
        },
        body: JSON.stringify({
          input: prompt,
          source_language_code: 'hi-IN',
          target_language_code: 'en-IN',
          speaker_gender: 'Male',
          mode: 'formal',
          model: 'mayura:v1',
          enable_preprocessing: true
        })
      });

      if (!response.ok) {
        console.error('Sarvam API error:', response.status, response.statusText);
        throw new Error(`Failed to get response from Sarvam AI: ${response.status}`);
      }

      const data: SarvamResponse = await response.json();
      console.log('Sarvam AI raw response:', data);
      
      let aiResponse = data.translated_text || "I understand. How can I assist you further?";
      
      aiResponse = this.cleanAndValidateResponse(aiResponse, cleanInput);
      
      console.log('Final cleaned response:', aiResponse.substring(0, 100));
      return aiResponse;
      
    } catch (error) {
      console.error('Error calling Sarvam AI:', error);
      
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        return "I'm having trouble connecting to the AI service. Please check your internet connection and try again.";
      }
      
      return "I apologize, but I'm having trouble processing your request right now. Could you please try rephrasing your question?";
    }
  }

  private cleanInputMessage(message: string): string {
    let cleaned = message.replace(/^(Previous conversation:|Current user message:|Context:|User Query:|Assistant Response:)/gm, '').trim();
    cleaned = cleaned.replace(/^(user|assistant):\s*/gm, '').trim();
    cleaned = cleaned.replace(/^\[.*?\]\s*/gm, '');
    return cleaned;
  }

  private cleanAndValidateResponse(response: string, userInput: string): string {
    console.log('Cleaning response:', { response: response.substring(0, 50), userInput: userInput.substring(0, 50) });
    
    const prefixesToRemove = [
      'user query:',
      'assistant response:',
      'user:',
      'assistant:',
      'ai:',
      'sarvamind:',
      'response:',
      'answer:',
      'here is the response:',
      'here\'s the response:'
    ];
    
    let cleaned = response;
    for (const prefix of prefixesToRemove) {
      const regex = new RegExp(`^${prefix}\\s*`, 'i');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '').trim();
      }
    }
    
    if (this.isEchoOrPoorResponse(userInput, cleaned)) {
      console.log('Echo detected, generating alternative response');
      return this.generateContextualFallback(userInput);
    }
    
    if (cleaned.length < 10) {
      console.log('Response too short, generating fallback');
      return this.generateContextualFallback(userInput);
    }
    
    if (userInput.length > 10 && cleaned.toLowerCase().includes(userInput.toLowerCase().substring(0, 20))) {
      const parts = cleaned.split(userInput.substring(0, 20));
      if (parts.length > 1 && parts[1].trim().length > 0) {
        cleaned = parts[1].trim();
      }
    }
    
    return cleaned;
  }

  private isEchoOrPoorResponse(userMessage: string, aiResponse: string): boolean {
    const userLower = userMessage.toLowerCase().trim();
    const aiLower = aiResponse.toLowerCase().trim();
    
    if (userLower === aiLower) return true;
    if (aiLower.startsWith(userLower) && aiLower.length < userLower.length + 30) return true;
    
    const similarity = this.calculateSimilarity(userLower, aiLower);
    if (similarity > 0.8) return true;
    
    const poorResponses = [
      'i understand your message',
      'thank you for sharing',
      'i see what you mean',
      'that makes sense',
      'i comprehend',
      'how can i assist you further',
      'what can i help with'
    ];
    
    return poorResponses.some(poor => aiLower.includes(poor) && aiLower.length < 80);
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

  private generateContextualFallback(message: string): string {
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('file') || messageLower.includes('upload') || messageLower.includes('image')) {
      return "I can see you've shared a file. Could you tell me more about what you'd like me to help you with regarding this file?";
    }
    
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
    
    const fallbacks = [
      "That's an interesting topic. What specific aspect would you like to explore further?",
      "I'd be happy to help you with that. Could you provide more details about your question?",
      "Thank you for your message. What would you like to know more about?",
      "I understand you're looking for information. What specific details can I help you with?",
      "That's a good point. How can I assist you in exploring this topic further?"
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

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

  async textToSpeech(text: string, language: string = 'en-IN'): Promise<string | null> {
    try {
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
        resolve(null);
      } else {
        resolve(null);
      }
    });
  }

  async detectLanguage(text: string): Promise<string> {
    const hindiPattern = /[\u0900-\u097F]/;
    const arabicPattern = /[\u0600-\u06FF]/;
    const chinesePattern = /[\u4e00-\u9fff]/;
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
    
    if (hindiPattern.test(text)) return 'hi-IN';
    if (arabicPattern.test(text)) return 'ar';
    if (chinesePattern.test(text)) return 'zh';
    if (japanesePattern.test(text)) return 'ja';
    
    return 'en-IN';
  }
}

export const sarvamAI = new ImprovedSarvamAI();
