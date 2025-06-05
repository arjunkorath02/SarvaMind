
import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface ChatSidebarProps {
  user: SupabaseUser;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string | null) => void;
  onNewChat: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
  user, 
  currentSessionId, 
  onSessionSelect, 
  onNewChat 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChatSessions();
  }, [user.id]);

  const loadChatSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading chat sessions:', error);
        toast({
          title: "Error loading chat history",
          description: "Could not load your chat sessions.",
          variant: "destructive",
        });
      } else {
        // Get message count for each session
        const sessionsWithCount = await Promise.all(
          (data || []).map(async (session: any) => {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.id);
            
            return {
              id: session.id,
              title: session.title,
              created_at: session.created_at,
              updated_at: session.updated_at,
              message_count: count || 0
            };
          })
        );
        setSessions(sessionsWithCount);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateChatTitle = (firstMessage: string): string => {
    const words = firstMessage.trim().split(' ').slice(0, 4);
    let title = words.join(' ');
    if (firstMessage.length > 30) {
      title += '...';
    }
    return title || 'New Chat';
  };

  const createNewSession = async (firstMessage?: string) => {
    try {
      const title = firstMessage ? generateChatTitle(firstMessage) : 'New Chat';
      
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating chat session:', error);
        return null;
      }

      await loadChatSessions();
      return data.id;
    } catch (error) {
      console.error('Error creating chat session:', error);
      return null;
    }
  };

  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating session title:', error);
        toast({
          title: "Error updating title",
          description: "Could not update the chat title.",
          variant: "destructive",
        });
      } else {
        await loadChatSessions();
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('Error deleting session:', error);
        toast({
          title: "Error deleting chat",
          description: "Could not delete the chat session.",
          variant: "destructive",
        });
      } else {
        await loadChatSessions();
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
    }
  };

  const handleEditSubmit = (sessionId: string) => {
    if (editTitle.trim()) {
      updateSessionTitle(sessionId, editTitle.trim());
    } else {
      setEditingId(null);
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
      {/* Header with Profile */}
      <div className="p-4 border-b border-primary/20">
        {/* Profile Section */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full glass flex items-center justify-center glow-subtle">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
          <Button
            onClick={() => setIsCollapsed(true)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-white flex-shrink-0"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* New Chat Button */}
        <Button
          onClick={onNewChat}
          className="w-full bg-primary hover:bg-primary/90 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Chat History */}
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
                      {editingId === session.id ? (
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleEditSubmit(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEditSubmit(session.id);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          className="text-sm bg-transparent border-primary/30"
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="w-3 h-3 text-primary flex-shrink-0" />
                            <p className="text-sm text-white truncate font-medium">
                              {session.title}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(session.updated_at)} • {session.message_count} messages
                          </p>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(session.id);
                          setEditTitle(session.title);
                        }}
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0 text-muted-foreground hover:text-white"
                        title="Rename chat"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
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

export default ChatSidebar;
