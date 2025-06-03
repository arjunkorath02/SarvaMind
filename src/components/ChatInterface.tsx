
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ChatInterfaceProps {
  user: SupabaseUser;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ user }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
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

  // Load chat history when component mounts
  useEffect(() => {
    loadChatHistory();
  }, [user.id]);

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        toast({
          title: "Error loading chat history",
          description: "Could not load your previous messages.",
          variant: "destructive",
        });
      } else {
        const formattedMessages: Message[] = data.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender as 'user' | 'ai',
          timestamp: new Date(msg.created_at)
        }));
        
        setMessages(formattedMessages);
        
        // If no history, show welcome message
        if (formattedMessages.length === 0) {
          const welcomeMessage: Message = {
            id: 'welcome',
            content: 'Hello! I\'m your AI assistant powered by Sarvam AI. How can I help you today?',
            sender: 'ai',
            timestamp: new Date()
          };
          setMessages([welcomeMessage]);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveMessageToDatabase = async (content: string, sender: 'user' | 'ai') => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          content,
          sender
        });

      if (error) {
        console.error('Error saving message:', error);
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

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
    const messageContent = inputValue;
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    // Save user message to database
    await saveMessageToDatabase(messageContent, 'user');

    // Simulate AI thinking time
    setTimeout(async () => {
      const aiResponse = await sendMessageToSarvam(messageContent);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setIsTyping(false);
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

      // Save AI message to database
      await saveMessageToDatabase(aiResponse, 'ai');
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoadingHistory) {
    return (
      <div className="flex flex-col h-screen bg-black items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full glass animate-pulse glow"></div>
          <p className="text-muted-foreground">Loading your chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black relative">
      {/* Chat Header */}
      <div className="glass-card rounded-none border-x-0 border-t-0 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center glow-subtle">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Sarvam AI Assistant</h2>
              <p className="text-sm text-muted-foreground">Always here to help</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area - with bottom padding for floating input */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 pb-32">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              
              <div className={`max-w-[70%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                <div className={`glass-card rounded-2xl p-4 ${
                  message.sender === 'user' 
                    ? 'bg-gradient-to-r from-primary/20 to-accent/20 glow-subtle border-primary/30' 
                    : 'border-primary/20'
                }`}>
                  <p className="text-white leading-relaxed">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-2">
                  {formatTime(message.timestamp)}
                </p>
              </div>

              {message.sender === 'user' && (
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                  <User className="w-4 h-4 text-accent" />
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 justify-start max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="glass-card rounded-2xl p-4 max-w-[70%] border-primary/20">
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

      {/* Floating Input Area */}
      <div className="floating-input">
        <div className="glass-input rounded-3xl p-4 mx-4 border-primary/40 glow-subtle">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 bg-black/20 rounded-2xl p-3 border border-primary/20 focus-within:border-primary/50 focus-within:glow transition-all duration-300">
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
              className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white transition-all duration-300 hover:scale-105 glow disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
