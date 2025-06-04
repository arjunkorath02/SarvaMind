import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, LogOut, Plus, Upload, Menu } from 'lucide-react';
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
  type: 'image' | 'video' | 'document' | 'audio';
  url?: string;
}
interface EnhancedChatInterfaceProps {
  user: SupabaseUser;
}
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
        // Load messages without session_id (legacy messages)
        query = query.is('session_id', null);
      }
      const {
        data,
        error
      } = await query;
      if (error) {
        console.error('Error loading chat history:', error);
        toast({
          title: "Error loading chat history",
          description: "Could not load your previous messages.",
          variant: "destructive"
        });
      } else {
        const formattedMessages: Message[] = data.map(msg => ({
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
            content: 'Hello! I\'m your enhanced AI assistant powered by Sarvam AI. I can help with text, images, documents, voice messages, and even translate between languages. How can I assist you today?',
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
      const {
        error
      } = await supabase.from('messages').insert({
        user_id: user.id,
        content,
        sender,
        session_id: sessionId
      });
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
      const {
        data,
        error
      } = await supabase.from('chat_sessions').insert({
        user_id: user.id,
        title: generateTitle(firstMessage)
      }).select().single();
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
  const handleSendMessage = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0 || isLoading) return;
    let sessionId = currentSessionId;

    // Create new session if this is the first message
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
        // Use improved Sarvam AI with echo prevention
        const aiResponse = await sarvamAI.sendMessage(messageContent || 'User shared media files');
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: aiResponse,
          sender: 'ai',
          timestamp: new Date(),
          session_id: sessionId
        };
        setIsTyping(false);
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
        await saveMessageToDatabase(aiResponse, 'ai', sessionId);
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

    // Add welcome message
    const welcomeMessage: Message = {
      id: 'welcome-new',
      content: 'Hello! I\'m your enhanced AI assistant powered by Sarvam AI. I can help with text, images, documents, voice messages, and even translate between languages. How can I assist you today?',
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
    const {
      error
    } = await supabase.auth.signOut();
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
    } catch (error) {
      console.error('Error processing audio:', error);
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
    return <div className="flex h-screen bg-black items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full glass animate-pulse glow"></div>
          <p className="text-muted-foreground">Loading your chat history...</p>
        </div>
      </div>;
  }
  return <div className="flex h-screen bg-black relative">
      {/* Hamburger Menu Button */}
      <Button onClick={() => setSidebarOpen(!sidebarOpen)} variant="ghost" size="sm" className="fixed top-4 left-4 z-50 text-muted-foreground hover:text-white glass-card glow-subtle" title="Toggle sidebar">
        <Menu className="w-5 h-5" />
      </Button>

      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Sliding Sidebar */}
      <div className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="w-80 h-full bg-black/40 backdrop-blur-lg border-r border-primary/20">
          <ChatSidebar user={user} currentSessionId={currentSessionId} onSessionSelect={handleSessionSelect} onNewChat={handleNewChat} />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative rounded-none bg-black">
        {/* Chat Header */}
        <div className="glass-card rounded-none border-x-0 border-t-0 p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between ml-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full glass flex items-center justify-center glow-subtle">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-white">SarvaMind</h2>
                
              </div>
            </div>
            <div className="flex items-center gap-3">
              
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 pb-40">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map(message => <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.sender === 'ai' && <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>}
                
                <div className={`max-w-[70%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                  <div className={`glass-card rounded-2xl p-4 ${message.sender === 'user' ? 'bg-gradient-to-r from-primary/20 to-accent/20 glow-subtle border-primary/30' : 'border-primary/20'}`}>
                    <p className="text-white leading-relaxed">{message.content}</p>
                    
                    {/* Media Files */}
                    {message.mediaFiles && message.mediaFiles.length > 0 && <div className="mt-3 space-y-2">
                        {message.mediaFiles.map(file => <div key={file.id} className="glass rounded p-2">
                            {file.type === 'image' && file.preview && <img src={file.preview} alt="Shared image" className="max-w-full h-auto rounded" />}
                            {file.type === 'video' && file.url && <video src={file.url} controls className="max-w-full h-auto rounded" />}
                            {file.type === 'audio' && file.url && <audio src={file.url} controls className="w-full" />}
                            {file.type === 'document' && <p className="text-sm text-muted-foreground">{file.file.name}</p>}
                          </div>)}
                      </div>}
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 px-2">
                    <p className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </p>
                    
                    {message.sender === 'ai' && <div className="flex items-center gap-2">
                        <ImprovedTextToSpeech text={message.content} />
                        <ImprovedTranslationFeature text={message.content} onTranslate={handleTranslate} />
                      </div>}
                  </div>
                </div>

                {message.sender === 'user' && <div className="w-8 h-8 rounded-full glass flex items-center justify-center glow-subtle flex-shrink-0">
                    <User className="w-4 h-4 text-accent" />
                  </div>}
              </div>)}

            {/* Thinking Indicator */}
            {isTyping && <div className="flex gap-3 justify-start max-w-4xl mx-auto">
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
              </div>}
          </div>
        </ScrollArea>

        {/* Floating Input Area with Glassmorphism */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4 z-30">
          <div className="space-y-4 rounded-full bg-[#1e1e1e]/15">
            {/* Media Upload Area */}
            {showMediaUpload && <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 border border-primary/30 shadow-2xl glow-subtle">
                <MediaUpload onFilesSelected={setSelectedFiles} selectedFiles={selectedFiles} onRemoveFile={id => setSelectedFiles(prev => prev.filter(f => f.id !== id))} />
              </div>}

            {/* Input Container with Enhanced Glassmorphism */}
            <div className="backdrop-blur-xl p-4 border border-primary/30 shadow-2xl glow-subtle rounded-full bg-[#272727]/[0.21]">
              <div className="space-y-3 rounded-full">
                {/* Text Input */}
                <Textarea ref={textareaRef} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyPress} placeholder="Type your message..." disabled={isLoading} className="border-0 text-white placeholder:text-muted-foreground focus-visible:ring-0 resize-none min-h-[2.5rem] max-h-30 bg-black/[0.41] mx-0 px-[15px] py-[4px] my-[9px] rounded-full" />
                
                {/* Controls */}
                <div className="flex items-center justify-between my-0 py-0 px-[19px] mx-[4px] rounded-full">
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setShowMediaUpload(!showMediaUpload)} variant="ghost" size="sm" className="text-muted-foreground hover:text-white" title="Upload media">
                      <Upload className="w-4 h-4" />
                    </Button>
                    
                    <AudioRecorder onAudioRecorded={handleAudioRecorded} />
                  </div>
                  
                  <Button onClick={handleSendMessage} disabled={!inputValue.trim() && selectedFiles.length === 0 || isLoading} className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white transition-all duration-300 hover:scale-105 glow disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex-shrink-0 font-normal">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default EnhancedChatInterface;