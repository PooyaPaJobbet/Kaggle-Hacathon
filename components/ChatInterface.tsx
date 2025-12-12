
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, ArrowRight, Loader2 } from 'lucide-react';
import { ChatMessage, ValidationProject } from '../types';
import { createChatSession, extractRequirements } from '../services/geminiService';
import type { Chat } from '@google/genai';

interface ChatInterfaceProps {
  onComplete: (data: Partial<ValidationProject>) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onComplete }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: "Hello! I'm your Validation Agent. Briefly describe the feature or platform update you want to validate today.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Use a ref to store the chat session so it persists across renders
  const chatSessionRef = useRef<Chat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize session once
    if (!chatSessionRef.current) {
        chatSessionRef.current = createChatSession();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      const modelMsg: ChatMessage = { 
        role: 'model', 
        text: result.text || "I didn't catch that. Could you clarify?", 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Chat Error", error);
      setMessages(prev => [...prev, { role: 'model', text: "I encountered an error. Please check your connection or API key.", timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFinish = async () => {
    setIsAnalyzing(true);
    try {
      // Concatenate history for context extraction
      const historyText = messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const { requirements, name } = await extractRequirements(historyText);
      
      onComplete({
        requirements,
        name: name || "New Validation Project",
        chatHistory: messages,
        platformVersion: "1.0.0" // Default
      });
    } catch (error) {
      console.error("Extraction error", error);
      alert("Failed to extract requirements. Please try providing more details.");
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h2 className="font-semibold text-slate-800">Requirements Gathering</h2>
                    <p className="text-sm text-slate-500">Chat with the agent to define scope.</p>
                </div>
                {messages.length > 2 && (
                    <button 
                        onClick={handleFinish}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <ArrowRight className="w-4 h-4"/>}
                        {isAnalyzing ? "Analyzing..." : "Generate Test Plan"}
                    </button>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5 text-indigo-600"/> : <Bot className="w-5 h-5 text-emerald-600"/>}
                        </div>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-slate-100 text-slate-800 rounded-tl-none'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex gap-4">
                         <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5 text-emerald-600"/>
                        </div>
                        <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1 items-center h-12">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-100">
                <div className="flex gap-2 items-end">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your requirements... (Shift+Enter for new line)"
                        className="flex-1 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm resize-none"
                        rows={3}
                        disabled={isAnalyzing}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isAnalyzing}
                        className="bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-lg transition-colors disabled:opacity-50 mb-0.5"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ChatInterface;
