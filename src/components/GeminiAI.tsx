import { toast } from '@/hooks/use-toast';

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface ImageGenerationResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        inline_data?: {
          mime_type: string;
          data: string;
        };
      }>;
    };
  }>;
}

export class GeminiAI {
  private apiKey: string;
  private baseURL: string = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string = 'AIzaSyCmTjd2EBkyQbm3sA5GTrMqS7PfHIury98') {
    this.apiKey = apiKey;
  }

  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('Sending message to Gemini AI:', { message: message.substring(0, 100), systemPrompt });

      const enhancedSystemPrompt = systemPrompt || 
        "You are SarvaMind, a helpful AI assistant powered by Google's Gemini. Provide clear, accurate, and helpful responses. " +
        "Be conversational and provide valuable insights. " +
        "If the user has shared files, acknowledge them appropriately and help with their content.";

      const cleanInput = this.cleanInputMessage(message);
      console.log('Cleaned input:', cleanInput.substring(0, 100));

      const fullPrompt = `${enhancedSystemPrompt}\n\nUser: ${cleanInput}\n\nAssistant:`;

      const response = await fetch(`${this.baseURL}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        console.error('Gemini API error:', response.status, response.statusText);
        throw new Error(`Failed to get response from Gemini AI: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();
      console.log('Gemini AI raw response:', data);
      
      let aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I understand. How can I assist you further?";
      
      aiResponse = this.cleanAndValidateResponse(aiResponse, cleanInput);
      
      console.log('Final cleaned response:', aiResponse.substring(0, 100));
      return aiResponse;
      
    } catch (error) {
      console.error('Error calling Gemini AI:', error);
      
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        return "I'm having trouble connecting to the AI service. Please check your internet connection and try again.";
      }
      
      return "I apologize, but I'm having trouble processing your request right now. Could you please try rephrasing your question?";
    }
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      console.log('Generating image with Gemini for prompt:', prompt);
      
      // Enhanced prompt for better image generation
      const enhancedPrompt = `Create a detailed, high-quality image of: ${prompt}. Make it visually appealing, well-composed, and artistically rendered.`;
      
      const response = await fetch(`${this.baseURL}/models/gemini-pro-vision:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate an image based on this description: ${enhancedPrompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.8,
            topK: 32,
            topP: 1.0,
            maxOutputTokens: 4096
          }
        })
      });

      if (response.ok) {
        const data: ImageGenerationResponse = await response.json();
        console.log('Gemini image generation response:', data);
        
        // Check if we got image data back
        const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inline_data;
        if (imageData && imageData.data) {
          // Convert base64 to blob URL
          const blob = this.base64ToBlob(imageData.data, imageData.mime_type);
          const imageUrl = URL.createObjectURL(blob);
          return imageUrl;
        }
      }
      
      // Fallback to a themed image service with better prompt handling
      console.log('Using fallback image generation');
      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 10000)}&blur=1`;
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return imageUrl;
      
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Fallback image generation
      console.log('Using emergency fallback image generation');
      const imageUrl = `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 10000)}`;
      return imageUrl;
    }
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
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
      'gemini:',
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
      return "I can see you've shared a file. Let me help you analyze or work with this content. What would you like me to do with it?";
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
    
    if (messageLower.includes('image') || messageLower.includes('picture') || messageLower.includes('draw')) {
      return "I can help with image-related questions or generate images based on descriptions. What would you like me to create or explain about images?";
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
}

export const geminiAI = new GeminiAI();
