
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, LogOut, Plus, Upload, Menu, Image as ImageIcon, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import MediaUpload from './MediaUpload';
import AudioRecorder from './AudioRecorder';
import ImprovedTranslationFeature from './ImprovedTranslationFeature';
import ImprovedTextToSpeech from './ImprovedTextToSpeech';
import ChatSidebar from './ChatSidebar';
import { sarvamAI } from './ImprovedSarvamAI';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  mediaFiles?: MediaFile[];
  translatedText?: string;
  targetLanguage?: string;
  session_id: string;
}

interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'archive';
  url?: string;
}

interface EnhancedChatInterfaceProps {
  user: SupabaseUser;
}

const formatAIResponse = (content: string): string => {
  // Remove repeated greetings and intro text
  const greetingPatterns = [
    /^Hello! I'm.*?(?=\n|$)/gim,
    /^Hi! I'm.*?(?=\n|$)/gim,
    /^I'm SarvaMind.*?(?=\n|$)/gim,
    /^I'm your.*?assistant.*?(?=\n|$)/gim,
  ];
  
  let cleanedContent = content;
  greetingPatterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '').trim();
  });
  
  // Convert numbered lists
  cleanedContent = cleanedContent.replace(/^(\d+)\.\s+(.+$)/gm, '<li>$2</li>');
  
  // Convert bullet points
  cleanedContent = cleanedContent.replace(/^[-•]\s+(.+$)/gm, '<li>$1</li>');
  
  // Wrap consecutive list items in <ol> or <ul>
  cleanedContent = cleanedContent.replace(/(<li>.*<\/li>)/gs, (match) => {
    const hasNumbers = /^\d+\./.test(match);
    const tag = hasNumbers ? 'ol' : 'ul';
    return `<${tag}>${match}</${tag}>`;
  });
  
  // Convert line breaks to paragraphs for better formatting
  cleanedContent = cleanedContent.replace(/\n\n/g, '</p><p>');
  cleanedContent = `<p>${cleanedContent}</p>`;
  
  // Clean up empty paragraphs
  cleanedContent = cleanedContent.replace(/<p><\/p>/g, '');
  
  return cleanedContent;
};

const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({
  user
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  }, [user.id, currentSessionId]);

  const loadChatHistory = async () => {
    try {
      let query = supabase.from('messages').select('*').eq('user_id', user.id).order('created_at', {
        ascending: true
      });

      if (currentSessionId) {
        query = query.eq('session_id', currentSessionId);
      } else {
        query = query.is('session_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading chat history:', error);
        toast({
          title: "Error loading chat history",
          description: "Could not load your previous messages.",
          variant: "destructive"
        });
      } else {
        const formattedMessages: Message[] = (data || []).map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender as 'user' | 'ai',
          timestamp: new Date(msg.created_at),
          session_id: msg.session_id || 'legacy'
        }));
        
        setMessages(formattedMessages);
        
        if (formattedMessages.length === 0 && !currentSessionId) {
          const welcomeMessage: Message = {
            id: 'welcome',
            content: 'What can I help with?',
            sender: 'ai',
            timestamp: new Date(),
            session_id: 'welcome'
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

  const saveMessageToDatabase = async (content: string, sender: 'user' | 'ai', sessionId: string) => {
    try {
      const messageData: any = {
        user_id: user.id,
        content,
        sender
      };
      
      if (sessionId && sessionId !== 'temp-session' && sessionId !== 'welcome') {
        messageData.session_id = sessionId;
      }
      
      const { error } = await supabase.from('messages').insert(messageData);
      
      if (error) {
        console.error('Error saving message:', error);
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const createNewSession = async (firstMessage: string): Promise<string> => {
    const generateTitle = (message: string): string => {
      const words = message.trim().split(' ').slice(0, 4);
      let title = words.join(' ');
      if (message.length > 30) {
        title += '...';
      }
      return title || 'New Chat';
    };

    try {
      const { data, error } = await supabase
        .from('chat_sessions' as any)
        .insert({
          user_id: user.id,
          title: generateTitle(firstMessage)
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return 'temp-session';
      }

      return data.id;
    } catch (error) {
      console.error('Error creating session:', error);
      return 'temp-session';
    }
  };

  const getConversationHistory = (): string => {
    // Get recent messages but filter out repeated greetings
    const recentMessages = messages
      .filter(msg => !msg.content.toLowerCase().includes("i'm sarvamind") && 
                     !msg.content.toLowerCase().includes("how can i help"))
      .slice(-4); // Reduced to 4 messages for better context
    
    return recentMessages
      .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0 || isLoading) return;

    let sessionId = currentSessionId;

    if (!sessionId && inputValue.trim()) {
      sessionId = await createNewSession(inputValue);
      setCurrentSessionId(sessionId);
    }

    if (!sessionId) sessionId = 'temp-session';

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue || 'Shared media files',
      sender: 'user',
      timestamp: new Date(),
      mediaFiles: selectedFiles.length > 0 ? [...selectedFiles] : undefined,
      session_id: sessionId
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputValue;
    setInputValue('');
    setSelectedFiles([]);
    setShowMediaUpload(false);
    setIsLoading(true);
    setIsTyping(true);

    await saveMessageToDatabase(messageContent || 'Shared media files', 'user', sessionId);

    setTimeout(async () => {
      try {
        const conversationHistory = getConversationHistory();
        let contextualPrompt = messageContent || 'User shared media files';
        
        // Only add context if there's meaningful conversation history
        if (conversationHistory && conversationHistory.trim().length > 0) {
          contextualPrompt = `Context: ${conversationHistory}\n\nCurrent: ${messageContent || 'User shared media files'}`;
        }

        const aiResponse = await sarvamAI.sendMessage(contextualPrompt);
        const formattedResponse = formatAIResponse(aiResponse);
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: formattedResponse,
          sender: 'ai',
          timestamp: new Date(),
          session_id: sessionId
        };

        setIsTyping(false);
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);

        await saveMessageToDatabase(formattedResponse, 'ai', sessionId);
      } catch (error) {
        console.error('Error getting AI response:', error);
        setIsTyping(false);
        setIsLoading(false);
      }
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = async () => {
    setCurrentSessionId(null);
    setMessages([]);
    setSelectedFiles([]);
    setShowMediaUpload(false);

    const welcomeMessage: Message = {
      id: 'welcome-new',
      content: 'What can I help with?',
      sender: 'ai',
      timestamp: new Date(),
      session_id: 'welcome'
    };
    setMessages([welcomeMessage]);
    
    toast({
      title: "New chat started",
      description: "Previous messages are saved in your chat history."
    });
  };

  const handleSessionSelect = (sessionId: string | null) => {
    setCurrentSessionId(sessionId);
    setMessages([]);
    setSelectedFiles([]);
    setShowMediaUpload(false);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleAudioRecorded = async (audioBlob: Blob) => {
    try {
      const audioFile = new File([audioBlob], 'recording.webm', {
        type: 'audio/webm'
      });
      
      const mediaFile: MediaFile = {
        id: Math.random().toString(36).substring(2),
        file: audioFile,
        type: 'audio',
        url: URL.createObjectURL(audioBlob)
      };
      
      setSelectedFiles(prev => [...prev, mediaFile]);
      toast({
        title: "Audio recorded",
        description: "Audio file ready for upload."
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Error processing audio",
        description: "Could not process the audio recording.",
        variant: "destructive"
      });
    }
  };

  const handleTranslate = (translatedText: string, targetLang: string) => {
    console.log('Translation:', translatedText, targetLang);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoadingHistory) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden animate-pulse glow">
            <img 
              src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
              alt="SarvaMind"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-muted-foreground">Loading your chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black relative overflow-hidden">
      {/* Hamburger Menu Button - Fixed positioning */}
      <Button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 text-muted-foreground hover:text-white glass-card glow-subtle md:hidden"
        title="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <ChatSidebar 
          user={user} 
          currentSessionId={currentSessionId} 
          onSessionSelect={handleSessionSelect} 
          onNewChat={handleNewChat} 
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Mobile Sliding Sidebar */}
      <div className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <ChatSidebar 
          user={user} 
          currentSessionId={currentSessionId} 
          onSessionSelect={handleSessionSelect} 
          onNewChat={handleNewChat} 
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-black min-w-0">
        {/* Chat Header */}
        <div className="glass-card rounded-none border-x-0 border-t-0 p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between md:ml-0 ml-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden glow-subtle">
                <img 
                  src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
                  alt="SarvaMind"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="font-semibold text-white">SarvaMind</h2>
                <p className="text-xs text-muted-foreground">AI Assistant with contextual memory</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-32">
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

        {/* Messages Area - Increased bottom padding for translate menu visibility */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 pb-40">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full overflow-hidden glow-subtle flex-shrink-0">
                    <img 
                      src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
                      alt="SarvaMind"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className={`max-w-[85%] sm:max-w-[70%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                  <div className={`glass-card rounded-2xl p-4 mb-4 ${
                    message.sender === 'user' 
                      ? 'bg-gradient-to-r from-primary/20 to-accent/20 glow-subtle border-primary/30' 
                      : 'border-primary/20'
                  }`}>
                    {message.sender === 'ai' && message.content.includes('<') ? (
                      <div 
                        className="text-white leading-relaxed break-words prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: message.content }}
                      />
                    ) : (
                      <p className="text-white leading-relaxed break-words">{message.content}</p>
                    )}
                    
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
                            {(file.type === 'document' || file.type === 'archive') && (
                              <p className="text-sm text-muted-foreground">{file.file.name}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Message metadata and actions with proper spacing */}
                  <div className="flex items-center justify-between px-2 mb-4">
                    <p className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </p>
                    
                    {message.sender === 'ai' && (
                      <div className="flex items-center gap-2 z-20 relative">
                        <ImprovedTextToSpeech text={message.content} />
                        <div className="relative">
                          <ImprovedTranslationFeature text={message.content} onTranslate={handleTranslate} />
                        </div>
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
                <div className="w-8 h-8 rounded-full overflow-hidden glow-subtle flex-shrink-0">
                  <img 
                    src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
                    alt="SarvaMind"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="glass-card rounded-2xl p-4 max-w-[85%] sm:max-w-[70%] border-primary/20">
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
        <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:transform md:-translate-x-1/2 md:w-full md:max-w-4xl md:px-4 z-30">
          <div className="space-y-4">
            {/* Media Upload Area */}
            {showMediaUpload && (
              <div className="backdrop-blur-xl bg-black/30 rounded-2xl p-4 border border-primary/30 shadow-2xl glow-subtle">
                <MediaUpload 
                  onFilesSelected={setSelectedFiles} 
                  selectedFiles={selectedFiles}
                  onRemoveFile={(id) => setSelectedFiles(prev => prev.filter(f => f.id !== id))}
                />
              </div>
            )}

            {/* Enhanced Input Container */}
            <div className="backdrop-blur-xl bg-black/40 p-4 border border-primary/30 shadow-2xl glow-subtle rounded-2xl">
              <div className="space-y-3">
                {/* Text Input */}
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask anything... (Shift+Enter for new line)"
                  disabled={isLoading}
                  className="border-0 text-white placeholder:text-muted-foreground focus-visible:ring-0 resize-none min-h-[2.5rem] max-h-32 bg-transparent"
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

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-white"
                      title="Generate image"
                    >
                      <ImageIcon className="w-4 h-4" />
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
    </div>
  );
};

export default EnhancedChatInterface;
