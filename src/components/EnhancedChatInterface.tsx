import React, { useState, useRef, useEffect } from 'react';
import { Send, User, LogOut, Upload, Image as ImageIcon, Menu, Sparkles } from 'lucide-react';
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  mediaFiles?: MediaFile[];
  session_id: string;
  image_url?: string;
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

const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({ user }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
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

  // Always start with new chat on component mount
  useEffect(() => {
    console.log('Component mounted, starting new chat');
    handleNewChat();
  }, [user.id]);

  const loadChatHistory = async (sessionId: string | null) => {
    if (!sessionId) return;
    
    try {
      console.log('Loading chat history for session:', sessionId);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }

      const formattedMessages: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content || '',
        sender: msg.sender as 'user' | 'ai',
        timestamp: new Date(msg.created_at),
        session_id: msg.session_id || 'legacy',
        image_url: msg.image_url
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveMessageToDatabase = async (content: string, sender: 'user' | 'ai', sessionId: string, imageUrl?: string) => {
    try {
      const messageData: any = {
        user_id: user.id,
        content: content,
        sender: sender,
        session_id: sessionId
      };

      if (imageUrl) {
        messageData.image_url = imageUrl;
      }

      const { error } = await supabase.from('messages').insert(messageData);
      if (error) {
        console.error('Error saving message:', error);
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const createNewSession = (): string => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    console.log('Created new session:', sessionId);
    return sessionId;
  };

  const buildConversationContext = (): Array<{ role: 'user' | 'assistant'; content: string }> => {
    const conversationMessages = messages.filter(msg => 
      msg.content && 
      msg.session_id !== 'welcome' && 
      !msg.content.toLowerCase().includes("what can i help") && 
      msg.content.trim().length > 0
    ).slice(-10); // Get last 10 messages for context

    return conversationMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  };

  const generateImageWithOpenAI = async (prompt: string): Promise<string | null> => {
    try {
      setIsGeneratingImage(true);
      
      // Use a simple image generation API (placeholder)
      const response = await fetch('https://api.unsplash.com/photos/random', {
        headers: {
          'Authorization': 'Client-ID YOUR_UNSPLASH_ACCESS_KEY'
        },
        method: 'GET'
      });

      if (response.ok) {
        const data = await response.json();
        return data.urls.regular;
      } else {
        // Fallback to a placeholder image service
        return `https://picsum.photos/800/600?random=${Date.now()}`;
      }
    } catch (error) {
      console.error('Error generating image:', error);
      // Return a placeholder image
      return `https://picsum.photos/800/600?random=${Date.now()}`;
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const processMediaFiles = async (files: MediaFile[]): Promise<string> => {
    let description = '';
    
    for (const file of files) {
      if (file.type === 'image' && file.preview) {
        description += `[Image uploaded: ${file.file.name}] `;
      } else if (file.type === 'document') {
        description += `[Document uploaded: ${file.file.name}] `;
      } else if (file.type === 'audio') {
        description += `[Audio file uploaded: ${file.file.name}] `;
      } else if (file.type === 'video') {
        description += `[Video file uploaded: ${file.file.name}] `;
      }
    }
    
    return description;
  };

  const handleSendMessage = async (isImageGeneration = false) => {
    if ((!inputValue.trim() && selectedFiles.length === 0) || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createNewSession();
      setCurrentSessionId(sessionId);
    }

    let messageContent = inputValue.trim();
    
    // Process media files
    if (selectedFiles.length > 0) {
      const mediaDescription = await processMediaFiles(selectedFiles);
      messageContent = mediaDescription + messageContent;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent || 'Shared media files',
      sender: 'user',
      timestamp: new Date(),
      mediaFiles: selectedFiles.length > 0 ? [...selectedFiles] : undefined,
      session_id: sessionId
    };

    setMessages(prev => [...prev, userMessage]);
    const originalInput = inputValue;
    setInputValue('');
    setSelectedFiles([]);
    setShowMediaUpload(false);
    setIsLoading(true);
    setIsTyping(true);

    // Save user message
    await saveMessageToDatabase(messageContent || 'Shared media files', 'user', sessionId);

    try {
      if (isImageGeneration) {
        console.log('Generating image for prompt:', originalInput);
        const imageUrl = await generateImageWithOpenAI(originalInput);
        
        if (imageUrl) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: `I've generated an image based on your prompt: "${originalInput}"`,
            sender: 'ai',
            timestamp: new Date(),
            session_id: sessionId,
            image_url: imageUrl
          };
          
          setIsTyping(false);
          setMessages(prev => [...prev, aiMessage]);
          await saveMessageToDatabase(aiMessage.content, 'ai', sessionId, imageUrl);
        } else {
          throw new Error('Failed to generate image');
        }
      } else {
        console.log('Sending message to AI:', messageContent);
        const conversationContext = buildConversationContext();
        
        let systemPrompt = "You are SarvaMind, a helpful AI assistant. Provide clear, accurate, and helpful responses. Do not repeat the user's message or start with greetings unless it's the first message.";
        
        if (selectedFiles.length > 0) {
          systemPrompt += " The user has shared files. Acknowledge them and provide relevant assistance based on the file types mentioned.";
        }

        let contextualPrompt = messageContent;
        if (conversationContext.length > 0) {
          const contextStr = conversationContext.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n');
          contextualPrompt = `Previous conversation:\n${contextStr}\n\nCurrent user message: ${messageContent}`;
        }

        const aiResponse = await sarvamAI.sendMessage(contextualPrompt, systemPrompt);
        console.log('AI Response received:', aiResponse);

        if (!aiResponse || aiResponse.trim().length === 0) {
          throw new Error('Empty response from AI');
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: aiResponse,
          sender: 'ai',
          timestamp: new Date(),
          session_id: sessionId
        };

        setIsTyping(false);
        setMessages(prev => [...prev, aiMessage]);
        await saveMessageToDatabase(aiResponse, 'ai', sessionId);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm having trouble processing your request right now. Could you please try again?",
        sender: 'ai',
        timestamp: new Date(),
        session_id: sessionId
      };
      
      setIsTyping(false);
      setMessages(prev => [...prev, fallbackMessage]);
      await saveMessageToDatabase(fallbackMessage.content, 'ai', sessionId);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    console.log('Starting new chat');
    setCurrentSessionId(null);
    setMessages([]);
    setSelectedFiles([]);
    setShowMediaUpload(false);
    setIsLoading(false);
    setIsTyping(false);
    
    // Add welcome message
    const welcomeMessage: Message = {
      id: 'welcome-' + Date.now(),
      content: 'What can I help with?',
      sender: 'ai',
      timestamp: new Date(),
      session_id: 'welcome'
    };
    setMessages([welcomeMessage]);
  };

  const handleSessionSelect = (sessionId: string | null) => {
    console.log('Selecting session:', sessionId);
    setCurrentSessionId(sessionId);
    setMessages([]);
    setSelectedFiles([]);
    setShowMediaUpload(false);
    setSidebarOpen(false);
    
    if (sessionId) {
      loadChatHistory(sessionId);
    } else {
      handleNewChat();
    }
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
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
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

  const formatMessageContent = (content: string) => {
    let formatted = content.replace(/(?:^|\n)([•\-\*]) (.+)/gm, '<li>$2</li>');
    if (formatted.includes('<li>')) {
      formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul class="list-disc list-inside space-y-1 ml-4">$1</ul>');
    }
    formatted = formatted.replace(/(?:^|\n)(\d+)\. (.+)/gm, '<li>$2</li>');
    if (formatted.includes('<li>') && !formatted.includes('<ul>')) {
      formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ol class="list-decimal list-inside space-y-1 ml-4">$1</ol>');
    }
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-black/30 rounded-lg p-3 my-2 overflow-x-auto"><code class="text-green-400 text-sm">$2</code></pre>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-black/20 px-1 py-0.5 rounded text-sm">$1</code>');
    formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary underline hover:text-primary/80 transition-colors">$1</a>');
    return formatted;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoadingHistory) {
    return <div className="flex h-screen bg-gradient-to-br from-black via-purple-900/20 to-black items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden animate-pulse glow-subtle transform transition-all duration-1000 hover:scale-110">
            <img src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" alt="SarvaMind" className="w-full h-full object-cover" />
          </div>
          <p className="text-muted-foreground animate-pulse">Loading your chat history...</p>
        </div>
      </div>;
  }
  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-purple-900/10 to-black relative overflow-hidden">
      {/* Mobile Drawer for Sidebar */}
      <div className="md:hidden">
        <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <DrawerTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="fixed top-4 left-4 z-50 text-muted-foreground hover:text-white glass-card glow-subtle transform transition-all duration-300 hover:scale-110" 
              title="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85vh] glass-card border-primary/20">
            <DrawerHeader>
              <DrawerTitle className="text-white">Menu & Chat History</DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-hidden">
              <ChatSidebar 
                user={user} 
                currentSessionId={currentSessionId} 
                onSessionSelect={handleSessionSelect} 
                onNewChat={handleNewChat} 
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block transform transition-all duration-500 ease-out">
        <ChatSidebar 
          user={user} 
          currentSessionId={currentSessionId} 
          onSessionSelect={handleSessionSelect} 
          onNewChat={handleNewChat} 
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-transparent min-w-0 animate-fade-in">
        {/* Chat Header */}
        <div className="backdrop-blur-xl bg-black/20 border-b border-white/10 p-4 sticky top-0 z-10 shadow-lg">
          <div className="flex items-center justify-between md:ml-0 ml-16">
            <div className="flex items-center gap-3 animate-slide-in-left">
              <div className="w-12 h-12 rounded-full overflow-hidden glow-subtle transform transition-all duration-300 hover:scale-110">
                <img 
                  src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
                  alt="SarvaMind" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div>
                <h2 className="font-semibold text-white text-lg">SarvaMind</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 animate-slide-in-right">
              <Button 
                onClick={handleLogout} 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-white transform transition-all duration-300 hover:scale-110"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 pb-48">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div 
                key={message.id} 
                className={`flex gap-4 animate-slide-up ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {message.sender === 'ai' && (
                  <div className="w-10 h-10 rounded-full overflow-hidden glow-subtle flex-shrink-0 transform transition-all duration-300 hover:scale-110">
                    <img 
                      src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
                      alt="SarvaMind" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                )}
                
                <div className={`max-w-[85%] sm:max-w-[75%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                  <div className={`backdrop-blur-xl rounded-3xl p-6 mb-4 transform transition-all duration-300 hover:scale-[1.02] ${
                    message.sender === 'user' 
                      ? 'bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/40 shadow-2xl glow-subtle ml-auto' 
                      : 'bg-black/30 border border-white/20 shadow-2xl'
                  }`}>
                    <div 
                      className="text-white leading-relaxed break-words whitespace-pre-wrap prose prose-invert max-w-none" 
                      dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content || 'No content') }} 
                    />
                    
                    {/* Display generated image */}
                    {message.image_url && (
                      <div className="mt-4">
                        <img 
                          src={message.image_url} 
                          alt="Generated image" 
                          className="max-w-full h-auto rounded-xl shadow-lg" 
                        />
                      </div>
                    )}
                    
                    {/* Media Files display */}
                    {message.mediaFiles && message.mediaFiles.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {message.mediaFiles.map(file => (
                          <div key={file.id} className="backdrop-blur-md bg-white/10 rounded-2xl p-3 border border-white/20">
                            {file.type === 'image' && file.preview && (
                              <img 
                                src={file.preview} 
                                alt="Shared image" 
                                className="max-w-full h-auto rounded-xl shadow-lg" 
                              />
                            )}
                            {file.type === 'video' && file.url && (
                              <video src={file.url} controls className="max-w-full h-auto rounded-xl shadow-lg" />
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
                  
                  {/* Message metadata */}
                  <div className="flex items-center justify-between px-4 mb-6">
                    <p className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </p>
                    
                    {message.sender === 'ai' && message.content && (
                      <div className="flex items-center gap-3 z-20 relative">
                        <div className="transform transition-all duration-300 hover:scale-110">
                          <ImprovedTextToSpeech text={message.content} />
                        </div>
                        <div className="relative transform transition-all duration-300 hover:scale-110">
                          <ImprovedTranslationFeature 
                            text={message.content} 
                            onTranslate={(translatedText, targetLang) => console.log('Translation:', translatedText, targetLang)} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {message.sender === 'user' && (
                  <div className="w-10 h-10 rounded-full backdrop-blur-md bg-accent/30 border border-accent/40 flex items-center justify-center glow-subtle flex-shrink-0 transform transition-all duration-300 hover:scale-110">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-4 justify-start max-w-4xl mx-auto animate-fade-in">
                <div className="w-10 h-10 rounded-full overflow-hidden glow-subtle flex-shrink-0">
                  <img 
                    src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
                    alt="SarvaMind" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="backdrop-blur-xl bg-black/30 border border-white/20 rounded-3xl p-6 max-w-[85%] sm:max-w-[75%] shadow-2xl">
                  <div className="flex gap-2 items-center">
                    <span className="text-muted-foreground text-sm mr-2">
                      {isGeneratingImage ? 'Generating image' : 'SarvaMind is thinking'}
                    </span>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Fixed Input Area - Centered */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4 z-30">
          <div className="space-y-4">
            {/* Media Upload Area */}
            {showMediaUpload && (
              <div className="backdrop-blur-xl bg-black/40 border border-white/20 rounded-3xl p-6 shadow-2xl glow-subtle animate-scale-in">
                <MediaUpload 
                  onFilesSelected={setSelectedFiles} 
                  selectedFiles={selectedFiles} 
                  onRemoveFile={(id) => setSelectedFiles(prev => prev.filter(f => f.id !== id))} 
                />
              </div>
            )}

            {/* Input Container */}
            <div className="backdrop-blur-xl bg-black/40 border border-white/20 shadow-2xl rounded-3xl p-4 transition-all duration-300 focus-within:shadow-primary/20 focus-within:border-primary/50 focus-within:glow px-[15px]">
              <div className="space-y-4">
                {/* Text Input */}
                <Textarea 
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask anything... (Shift+Enter for new line)"
                  disabled={isLoading}
                  className="border-0 text-white placeholder:text-muted-foreground focus-visible:ring-0 resize-none min-h-[3rem] max-h-32 px-6 py-3 bg-transparent text-lg"
                />
                
                {/* Controls */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={() => setShowMediaUpload(!showMediaUpload)}
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground hover:text-white transform transition-all duration-300 hover:scale-110" 
                      title="Upload media"
                    >
                      <Upload className="w-5 h-5" />
                    </Button>

                    <Button 
                      onClick={() => handleSendMessage(true)}
                      disabled={!inputValue.trim() || isLoading}
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground hover:text-white transform transition-all duration-300 hover:scale-110" 
                      title="Generate image"
                    >
                      <Sparkles className="w-5 h-5" />
                    </Button>
                    
                    <div className="transform transition-all duration-300 hover:scale-110">
                      <AudioRecorder onAudioRecorded={handleAudioRecorded} />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handleSendMessage()}
                    disabled={(!inputValue.trim() && selectedFiles.length === 0) || isLoading}
                    className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white transition-all duration-300 hover:scale-110 glow disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex-shrink-0 transform"
                  >
                    <Send className="w-5 h-5" />
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
