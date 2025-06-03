
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI assistant powered by Sarvam AI. How can I help you today?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessageToSarvam = async (message: string) => {
    try {
      const response = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': '55e4a905-84c6-4b99-9ae2-0fe21f818fdc'
        },
        body: JSON.stringify({
          input: message,
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

      const data = await response.json();
      return data.translated_text || "I'm processing your request. This is a demo response from Sarvam AI integration.";
    } catch (error) {
      console.error('Error calling Sarvam AI:', error);
      return "I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment.";
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(async () => {
      const aiResponse = await sendMessageToSarvam(inputValue);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setIsTyping(false);
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Chat Header */}
      <div className="glass-card rounded-none border-x-0 border-t-0 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full glass flex items-center justify-center glow-subtle">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Sarvam AI Assistant</h2>
            <p className="text-sm text-muted-foreground">Always here to help</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              
              <div className={`max-w-[70%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                <div className={`glass-card rounded-2xl p-4 ${message.sender === 'user' ? 'bg-primary/10 glow-subtle' : ''}`}>
                  <p className="text-white leading-relaxed">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-2">
                  {formatTime(message.timestamp)}
                </p>
              </div>

              {message.sender === 'user' && (
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="glass-card rounded-2xl p-4 max-w-[70%]">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="glass-card rounded-none border-x-0 border-b-0 p-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1 glass rounded-2xl p-3 border-primary/20 focus-within:border-primary focus-within:glow transition-all duration-300">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="border-0 bg-transparent text-white placeholder:text-muted-foreground focus-visible:ring-0 resize-none min-h-[20px] max-h-32"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 text-black transition-all duration-300 hover:scale-105 hover:glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
