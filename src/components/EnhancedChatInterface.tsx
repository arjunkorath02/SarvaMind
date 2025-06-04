
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, LogOut, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import MediaUpload from './MediaUpload';
import AudioRecorder from './AudioRecorder';
import TranslationFeature from './TranslationFeature';
import TextToSpeech from './TextToSpeech';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  mediaFiles?: MediaFile[];
  translatedText?: string;
  targetLanguage?: string;
}

interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'document' | 'audio';
  url?: string;
}

interface EnhancedChatInterfaceProps {
  user: SupabaseUser;
}

const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({ user }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        
        if (formattedMessages.length === 0) {
          const welcomeMessage: Message = {
            id: 'welcome',
            content: 'Hello! I\'m your enhanced AI assistant powered by Sarvam AI. I can help with text, images, documents, and even voice messages. How can I assist you today?',
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
      const aiResponse = data.translated_text || "I understand your message. How can I assist you further?";
      
      if (aiResponse.toLowerCase().trim() === message.toLowerCase().trim()) {
        return "I understand what you're saying. Could you please provide more details so I can help you better?";
      }
      
      return aiResponse;
    } catch (error) {
      console.error('Error calling Sarvam AI:', error);
      return "I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment.";
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && selectedFiles.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue || 'Shared media files',
      sender: 'user',
      timestamp: new Date(),
      mediaFiles: selectedFiles.length > 0 ? [...selectedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputValue;
    setInputValue('');
    setSelectedFiles([]);
    setShowMediaUpload(false);
    setIsLoading(true);
    setIsTyping(true);

    await saveMessageToDatabase(messageContent || 'Shared media files', 'user');

    setTimeout(async () => {
      const aiResponse = await sendMessageToSarvam(messageContent || 'User shared media files');
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setIsTyping(false);
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

      await saveMessageToDatabase(aiResponse, 'ai');
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = async () => {
    const welcomeMessage: Message = {
      id: 'welcome-new',
      content: 'Hello! I\'m your enhanced AI assistant powered by Sarvam AI. I can help with text, images, documents, and even voice messages. How can I assist you today?',
      sender: 'ai',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
    setSelectedFiles([]);
    setShowMediaUpload(false);
    
    toast({
      title: "New chat started",
      description: "Previous messages are still saved in your history.",
    });
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

  const handleAudioRecorded = async (audioBlob: Blob) => {
    // Convert audio to text using speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        // For demo purposes, add audio as a media file
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        const mediaFile: MediaFile = {
          id: Math.random().toString(36).substring(2),
          file: audioFile,
          type: 'audio',
          url: URL.createObjectURL(audioBlob)
        };
        setSelectedFiles(prev => [...prev, mediaFile]);
      } catch (error) {
        console.error('Error processing audio:', error);
      }
    }
  };

  const handleTranslate = (translatedText: string, targetLang: string) => {
    // Update the message with translation
    console.log('Translation:', translatedText, targetLang);
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
              <h2 className="font-semibold text-white">Enhanced Sarvam AI Assistant</h2>
              <p className="text-sm text-muted-foreground">Rich media & multilingual support</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleNewChat}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-white"
              title="Start new chat"
            >
              <Plus className="w-4 h-4" />
            </Button>
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

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 pb-40">
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
                  
                  {/* Media Files */}
                  {message.mediaFiles && message.mediaFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.mediaFiles.map((file) => (
                        <div key={file.id} className="glass rounded p-2">
                          {file.type === 'image' && file.preview && (
                            <img src={file.preview} alt="Shared image" className="max-w-full h-auto rounded" />
                          )}
                          {file.type === 'video' && file.url && (
                            <video src={file.url} controls className="max-w-full h-auto rounded" />
                          )}
                          {file.type === 'audio' && file.url && (
                            <audio src={file.url} controls className="w-full" />
                          )}
                          {file.type === 'document' && (
                            <p className="text-sm text-muted-foreground">{file.file.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-2 px-2">
                  <p className="text-xs text-muted-foreground">
                    {formatTime(message.timestamp)}
                  </p>
                  
                  {message.sender === 'ai' && (
                    <div className="flex items-center gap-2">
                      <TextToSpeech text={message.content} />
                      <TranslationFeature text={message.content} onTranslate={handleTranslate} />
                    </div>
                  )}
                </div>
              </div>

              {message.sender === 'user' && (
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                  <User className="w-4 h-4 text-accent" />
                </div>
              )}
            </div>
          ))}

          {/* Thinking Indicator */}
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

      {/* Enhanced Floating Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Media Upload Area */}
          {showMediaUpload && (
            <div className="glass-card rounded-2xl p-4 border-primary/40">
              <MediaUpload
                onFilesSelected={setSelectedFiles}
                selectedFiles={selectedFiles}
                onRemoveFile={(id) => setSelectedFiles(prev => prev.filter(f => f.id !== id))}
              />
            </div>
          )}

          {/* Input Container */}
          <div className="glass-input rounded-2xl p-3 border-primary/40 glow-subtle">
            <div className="space-y-3">
              {/* Text Input */}
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="border-0 bg-transparent text-white placeholder:text-muted-foreground focus-visible:ring-0 resize-none min-h-[2.5rem] max-h-32"
                disabled={isLoading}
              />
              
              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowMediaUpload(!showMediaUpload)}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-white"
                    title="Upload media"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                  
                  <AudioRecorder onAudioRecorded={handleAudioRecorded} />
                </div>
                
                <Button
                  onClick={handleSendMessage}
                  disabled={(!inputValue.trim() && selectedFiles.length === 0) || isLoading}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white transition-all duration-300 hover:scale-105 glow disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatInterface;
