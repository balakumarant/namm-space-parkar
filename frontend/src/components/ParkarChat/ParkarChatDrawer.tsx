import React, { useState, useRef, useEffect } from 'react';
import { useParkarStore } from '../../stores/useParkarStore';
import {
  Bot,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Route as RouteIcon,
  Navigation,
  Clock,
  MapPin,
} from 'lucide-react';

const SUGGESTIONS = [
  'Take me to Room 302',
  'Where is the nearest lab?',
  'Avoid stairs and take me to Room 301',
  'Where am I?',
  "What's the fastest route to Room 201?",
  'Which floor is Room 303 on?',
];

export const ParkarChatDrawer: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isChatOpen = useParkarStore((state) => state.isChatOpen);
  const setChatOpen = useParkarStore((state) => state.setChatOpen);
  const messages = useParkarStore((state) => state.messages);
  const aiStatus = useParkarStore((state) => state.aiStatus);
  const isListening = useParkarStore((state) => state.isListening);
  const isVoiceOutputEnabled = useParkarStore((state) => state.isVoiceOutputEnabled);
  const toggleVoiceOutput = useParkarStore((state) => state.toggleVoiceOutput);
  const startVoiceInput = useParkarStore((state) => state.startVoiceInput);
  const stopVoiceInput = useParkarStore((state) => state.stopVoiceInput);
  const sendMessage = useParkarStore((state) => state.sendMessage);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      {/* 1. Floating In-Game Trigger Button (when closed) */}
      {!isChatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="pointer-events-auto glass-panel px-4 py-3 flex items-center gap-3 text-cyan-400 hover:text-white hover:border-cyan-400 transition-all shadow-xl hover:shadow-cyan-500/30 group animate-pulse-subtle"
        >
          <div className="relative p-2 rounded-xl bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
            <Bot size={22} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              AI Spatial Assistant
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Talk to PARKAR</span>
              <Sparkles size={14} className="text-cyan-400" />
            </div>
          </div>
        </button>
      )}

      {/* 2. Floating AI Companion Drawer (when open) */}
      {isChatOpen && (
        <div className="pointer-events-auto glass-panel w-88 md:w-96 h-[530px] flex flex-col border-cyan-500/50 shadow-2xl rounded-2xl overflow-hidden animate-fade-in z-30">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-black flex items-center justify-center font-bold shadow-md shadow-cyan-500/30">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider text-white">
                    PARKAR AI
                  </span>
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                      aiStatus === 'listening'
                        ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse'
                        : aiStatus === 'thinking'
                        ? 'bg-amber-950 border-amber-500 text-amber-300 animate-pulse'
                        : aiStatus === 'navigating'
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                        : aiStatus === 'error'
                        ? 'bg-red-950 border-red-500 text-red-300'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {aiStatus}
                  </span>
                </div>
                <div className="text-[10px] text-cyan-400/80 font-medium">
                  IIT Bombay Spatial Guide
                </div>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleVoiceOutput}
                title={isVoiceOutputEnabled ? 'Voice Output ON' : 'Voice Output Muted'}
                className={`p-1.5 rounded-lg transition ${
                  isVoiceOutputEnabled
                    ? 'text-cyan-400 hover:bg-cyan-950'
                    : 'text-slate-500 hover:bg-slate-800'
                }`}
              >
                {isVoiceOutputEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 custom-scrollbar">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600/90 text-white rounded-tr-none shadow-md shadow-blue-600/20'
                      : 'bg-slate-900/95 text-slate-200 border border-cyan-500/30 rounded-tl-none shadow-md shadow-black/40'
                  }`}
                >
                  {m.content}

                  {/* Inline Route Card when PARKAR activates navigation */}
                  {m.action && m.action.type === 'SET_ROUTE' && m.action.route && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-cyan-400/40 text-[11px] flex flex-col gap-1.5 text-slate-300">
                      <div className="flex items-center justify-between text-cyan-300 font-bold">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-cyan-400" />
                          {m.action.destination_name}
                        </span>
                        <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-200">
                          Floor {m.action.route.floor_transitions.join(' → ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] mono text-white">
                        <div className="flex items-center gap-1">
                          <RouteIcon size={12} className="text-cyan-400" />
                          <span>{m.action.route.total_distance_meters}m</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={12} className="text-blue-400" />
                          <span>~{m.action.route.estimated_time_seconds}s</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-cyan-400/90 flex items-center gap-1 mt-0.5 font-semibold">
                        <Navigation size={11} /> 3D Route active in world!
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-1 mono">
                  {m.timestamp}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/60 overflow-x-auto flex gap-1.5 custom-scrollbar shrink-0">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(s)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition shrink-0"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input & Microphone Bar */}
          <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask PARKAR where to go..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />

            {/* Voice Input Button */}
            <button
              onClick={isListening ? stopVoiceInput : startVoiceInput}
              title={isListening ? 'Listening... click to stop' : 'Click to Speak'}
              className={`p-2 rounded-xl transition ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/50'
                  : 'bg-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-700'
              }`}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
