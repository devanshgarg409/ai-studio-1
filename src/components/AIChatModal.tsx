import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { ChatMessage, User } from '../types';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  X, 
  RefreshCw, 
  Terminal, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

interface Props {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onAppointmentChanged?: () => void;
}

export const AIChatModal: React.FC<Props> = ({ currentUser, isOpen, onClose, onAppointmentChanged }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${currentUser.displayName}! I am AcademiaSync AI, your academic appointment and calendar assistant powered by Gemini. How can I help you today? You can ask me to book appointments, check faculty availability, list upcoming meetings, or sync your Google Calendar.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await api.sendAIChatMessage(text, messages);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: res.toolExecutions
      };
      setMessages(prev => [...prev, assistantMsg]);

      // If any booking or status tool was called, trigger parent reload
      if (res.toolExecutions && res.toolExecutions.length > 0) {
        onAppointmentChanged?.();
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `Error communicating with Gemini: ${err.message || 'Service unavailable'}. Please verify the Gemini API key in Admin Settings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const toggleToolExpand = (id: string) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const samplePrompts = [
    "List available faculty members and their status",
    "Check faculty availability for tomorrow at 10:00 AM",
    "Show my upcoming appointments",
    "What are the official faculty working hours?"
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full h-[650px] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 px-6 bg-gradient-to-r from-indigo-700 via-purple-700 to-purple-800 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">AcademiaSync AI Assistant</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-purple-100 border border-white/15">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-purple-200">
                End-to-End scheduling agent with real-time tool calling & calendar sync
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-2`}>
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Tool Executions Badge & Drawer */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {msg.toolCalls.map((tc, idx) => {
                      const toolKey = `${msg.id}-${idx}`;
                      const isExpanded = !!expandedTools[toolKey];
                      return (
                        <div key={idx} className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl overflow-hidden text-xs">
                          <button
                            onClick={() => toggleToolExpand(toolKey)}
                            className="w-full px-3 py-2 flex items-center justify-between text-indigo-950 font-medium hover:bg-indigo-100/60 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                              Called tool: <code className="font-mono text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">{tc.name}</code>
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />}
                          </button>

                          {isExpanded && (
                            <div className="p-3 bg-white border-t border-indigo-100 font-mono text-[11px] text-slate-700 space-y-2">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Parameters:</span>
                                <pre className="bg-slate-50 p-2 rounded border border-slate-200 overflow-x-auto">
                                  {JSON.stringify(tc.args, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Database Result:</span>
                                <pre className="bg-emerald-50 text-emerald-900 p-2 rounded border border-emerald-200 overflow-x-auto">
                                  {JSON.stringify(tc.result, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <span className={`text-[10px] text-slate-400 block ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 mt-1">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-indigo-600 bg-indigo-50 p-3 rounded-2xl w-fit">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Gemini is reasoning and checking appointment availability...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 bg-slate-100/70 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] text-slate-500 font-semibold shrink-0">Try:</span>
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-full border border-slate-200 text-xs shrink-0 transition-colors whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything or request to book / cancel appointments..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm flex items-center gap-2 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
