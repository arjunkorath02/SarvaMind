
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface SidebarProps {
  user: SupabaseUser;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string | null) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  user, 
  currentSessionId, 
  onSessionSelect, 
  onNewChat 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadChatSessions();
    
    // Clean up any existing subscription before creating a new one
    if (subscriptionRef.current) {
      console.log('Cleaning up existing subscription');
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    
    // Create a unique channel name to avoid conflicts
    const channelName = `chat-history-updates-${user.id}-${Date.now()}`;
    console.log('Setting up new subscription:', channelName);
    
    subscriptionRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('Message change detected in sidebar, reloading sessions', payload);
        if (mounted.current) {
          // Add a small delay to ensure the message is fully written to the database
          setTimeout(() => {
            if (mounted.current) {
              loadChatSessions();
            }
          }, 500);
        }
      })
      .subscribe((status) => {
        console.log('Sidebar subscription status:', status);
      });

    return () => {
      mounted.current = false;
      console.log('Sidebar cleanup - removing subscription');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user.id]);

  const loadChatSessions = async () => {
    if (!mounted.current) return;
    
    try {
      console.log('Loading chat sessions for user:', user.id);
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('session_id, content, created_at, sender')
        .eq('user_id', user.id)
        .not('session_id', 'is', null)
        .neq('session_id', 'welcome')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading chat sessions:', error);
        if (mounted.current) {
          setSessions([]);
        }
        return;
      }

      console.log('Raw messages data for sidebar:', messagesData);
      
      if (!messagesData || messagesData.length === 0) {
        console.log('No messages found for sidebar');
        if (mounted.current) {
          setSessions([]);
        }
        return;
      }

      const sessionMap = new Map<string, ChatSession>();
      
      messagesData.forEach((msg) => {
        const sessionId = msg.session_id;
        if (sessionId && sessionId !== 'welcome') {
          if (!sessionMap.has(sessionId)) {
            const title = msg.sender === 'user' && msg.content
              ? generateChatTitle(msg.content) 
              : 'New Chat';
            
            sessionMap.set(sessionId, {
              id: sessionId,
              title: title,
              created_at: msg.created_at,
              updated_at: msg.created_at,
              message_count: 1
            });
          } else {
            const session = sessionMap.get(sessionId)!;
            session.message_count += 1;
            
            if (session.title === 'New Chat' && msg.sender === 'user' && msg.content) {
              session.title = generateChatTitle(msg.content);
            }
            
            if (new Date(msg.created_at) > new Date(session.updated_at)) {
              session.updated_at = msg.created_at;
            }
          }
        }
      });

      const formattedSessions = Array.from(sessionMap.values()).sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      console.log('Formatted sessions for sidebar:', formattedSessions);
      if (mounted.current) {
        setSessions(formattedSessions);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      if (mounted.current) {
        setSessions([]);
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  };

  const generateChatTitle = (firstMessage: string): string => {
    if (!firstMessage || firstMessage.trim() === '') {
      return 'New Chat';
    }
    
    let cleanMessage = firstMessage.replace(/^\[.*?\]\s*/, '');
    cleanMessage = cleanMessage.trim();
    
    if (cleanMessage === '') {
      return 'New Chat';
    }
    
    const words = cleanMessage.split(' ').slice(0, 4);
    let title = words.join(' ');
    if (cleanMessage.length > 30) {
      title += '...';
    }
    return title || 'New Chat';
  };

  const deleteSession = async (sessionId: string) => {
    try {
      console.log('Deleting session:', sessionId);
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting session:', error);
        toast({
          title: "Error deleting chat",
          description: "Could not delete the chat session.",
          variant: "destructive",
        });
      } else {
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        
        if (currentSessionId === sessionId) {
          onSessionSelect(null);
        }
        
        toast({
          title: "Chat deleted",
          description: "The chat session has been deleted.",
        });
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error deleting chat",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full glass-card border-r border-primary/20 flex flex-col items-center py-4">
        <Button
          onClick={() => setIsCollapsed(false)}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-white mb-4"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          onClick={onNewChat}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-white"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80 h-full glass-card border-r border-primary/20 flex flex-col backdrop-blur-lg">
      <div className="p-4 border-b border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full overflow-hidden glow-subtle">
            <img 
              src="https://raw.githubusercontent.com/arjunkorath02/SarvaMindlogo/main/SarvaMind%20Logo.png" 
              alt="SarvaMind"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground">Powered by Gemini</p>
          </div>
          <Button
            onClick={() => setIsCollapsed(true)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-white flex-shrink-0 hidden md:flex"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        <Button
          onClick={onNewChat}
          className="w-full bg-primary hover:bg-primary/90 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-semibold text-white">Chat History</h3>
        </div>
        
        <ScrollArea className="flex-1 px-2">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading chats...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No chat history yet
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg p-3 cursor-pointer transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-primary/20 border border-primary/40'
                      : 'hover:bg-primary/10'
                  }`}
                  onClick={() => onSessionSelect(session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-3 h-3 text-primary flex-shrink-0" />
                        <p className="text-sm text-white truncate font-medium">
                          {session.title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(session.updated_at)} • {session.message_count} messages
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0 text-muted-foreground hover:text-destructive"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default Sidebar;
