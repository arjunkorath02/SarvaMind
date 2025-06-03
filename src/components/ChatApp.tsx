
import React, { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import ChatInterface from './ChatInterface';
import AuthForm from './AuthForm';

interface User {
  id: string;
  email: string;
  name: string;
}

const ChatApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const storedUser = localStorage.getItem('chatapp_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('chatapp_user');
      }
    }
    setIsInitialLoading(false);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    
    // Simulate authentication - replace with actual auth logic
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const user: User = {
        id: Date.now().toString(),
        email,
        name: email.split('@')[0]
      };
      
      setUser(user);
      localStorage.setItem('chatapp_user', JSON.stringify(user));
      
      toast({
        title: "Welcome back!",
        description: "You've been successfully signed in.",
      });
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    
    // Simulate account creation - replace with actual auth logic
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const user: User = {
        id: Date.now().toString(),
        email,
        name
      };
      
      setUser(user);
      localStorage.setItem('chatapp_user', JSON.stringify(user));
      
      toast({
        title: "Account created!",
        description: "Welcome to Sarvam Chat. Let's start conversing!",
      });
    } catch (error) {
      toast({
        title: "Account creation failed",
        description: "Please try again with different details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full glass animate-pulse"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForm
        onLogin={handleLogin}
        onSignup={handleSignup}
        isLoading={isLoading}
      />
    );
  }

  return <ChatInterface />;
};

export default ChatApp;
