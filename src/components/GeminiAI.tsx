
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
      console.log('Sending message to Gemini AI:', { message: message.substring(0, 100) });

      const enhancedSystemPrompt = systemPrompt || 
        "You are SarvaMind, a helpful AI assistant powered by Google's Gemini. Provide clear, accurate, and helpful responses. " +
        "Be conversational and engaging. Always provide detailed and informative answers. " +
        "If the user asks about anything, provide comprehensive explanations and examples when appropriate.";

      const cleanInput = this.cleanInputMessage(message);
      console.log('Cleaned input for Gemini:', cleanInput.substring(0, 100));

      const fullPrompt = `${enhancedSystemPrompt}\n\nUser: ${cleanInput}`;

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
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, response.statusText, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data: GeminiResponse = await response.json();
      console.log('Gemini AI raw response:', data);
      
      if (!data.candidates || data.candidates.length === 0) {
        console.error('No candidates in response:', data);
        throw new Error('No response candidates from Gemini');
      }

      const candidate = data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        console.error('Invalid candidate structure:', candidate);
        throw new Error('Invalid response structure from Gemini');
      }

      let aiResponse = candidate.content.parts[0].text;
      
      if (!aiResponse || aiResponse.trim().length === 0) {
        console.error('Empty response text from Gemini');
        throw new Error('Empty response from Gemini');
      }

      aiResponse = this.cleanAndValidateResponse(aiResponse, cleanInput);
      
      console.log('Final cleaned response:', aiResponse.substring(0, 100));
      return aiResponse;
      
    } catch (error) {
      console.error('Error calling Gemini AI:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
          return "I'm having trouble connecting to the AI service. Please check your internet connection and try again.";
        }
        if (error.message.includes('API key')) {
          return "There seems to be an issue with the API configuration. Please contact support.";
        }
        if (error.message.includes('quota') || error.message.includes('limit')) {
          return "I've reached my usage limit for now. Please try again in a moment.";
        }
      }
      
      return "I encountered an unexpected error. Please try rephrasing your question or try again.";
    }
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      console.log('Generating image with prompt:', prompt);
      
      // For now, we'll use a placeholder image service that creates themed images
      // Gemini doesn't have direct image generation capabilities yet
      const enhancedPrompt = prompt.toLowerCase().replace(/\s+/g, '+');
      
      // Create a more relevant image URL based on the prompt
      let imageUrl: string;
      
      if (prompt.toLowerCase().includes('cat') || prompt.toLowerCase().includes('kitten')) {
        imageUrl = `https://api.unsplash.com/photos/random?query=cat&client_id=demo&w=800&h=600`;
      } else if (prompt.toLowerCase().includes('dog') || prompt.toLowerCase().includes('puppy')) {
        imageUrl = `https://api.unsplash.com/photos/random?query=dog&client_id=demo&w=800&h=600`;
      } else if (prompt.toLowerCase().includes('nature') || prompt.toLowerCase().includes('landscape')) {
        imageUrl = `https://api.unsplash.com/photos/random?query=nature&client_id=demo&w=800&h=600`;
      } else if (prompt.toLowerCase().includes('city') || prompt.toLowerCase().includes('urban')) {
        imageUrl = `https://api.unsplash.com/photos/random?query=city&client_id=demo&w=800&h=600`;
      } else if (prompt.toLowerCase().includes('food')) {
        imageUrl = `https://api.unsplash.com/photos/random?query=food&client_id=demo&w=800&h=600`;
      } else {
        // Fallback to a themed image service
        imageUrl = `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 10000)}`;
      }
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Generated image URL:', imageUrl);
      return imageUrl;
      
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Fallback image generation
      const imageUrl = `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 10000)}`;
      return imageUrl;
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
