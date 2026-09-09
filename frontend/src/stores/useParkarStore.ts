import { create } from 'zustand';
import { ChatMessage, AIStatus, ParkarApiResponse } from '../ai/ParkarTypes';
import { voiceInput, voiceOutput } from '../services/voiceService';
import { useGameStore } from './useGameStore';

interface ParkarState {
  messages: ChatMessage[];
  aiStatus: AIStatus;
  isChatOpen: boolean;
  isListening: boolean;
  isVoiceOutputEnabled: boolean;

  setChatOpen: (open: boolean) => void;
  setAiStatus: (status: AIStatus) => void;
  toggleVoiceOutput: () => void;
  startVoiceInput: () => void;
  stopVoiceInput: () => void;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
}

const API_BASE_URL = 'http://127.0.0.1:8000';

const INITIAL_GREETING: ChatMessage = {
  id: 'greeting_0',
  role: 'assistant',
  content: "Hello! I am PARKAR, your 3D indoor spatial guide for Techfest, IIT Bombay. Where would you like to go?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export const useParkarStore = create<ParkarState>((set, get) => ({
  messages: [INITIAL_GREETING],
  aiStatus: 'idle',
  isChatOpen: false,
  isListening: false,
  isVoiceOutputEnabled: true,

  setChatOpen: (open) => set({ isChatOpen: open }),
  setAiStatus: (status) => set({ aiStatus: status }),

  toggleVoiceOutput: () => {
    const nextVal = !get().isVoiceOutputEnabled;
    voiceOutput.setMuted(!nextVal);
    set({ isVoiceOutputEnabled: nextVal });
  },

  startVoiceInput: () => {
    if (!voiceInput.isSupported()) {
      useGameStore.getState().setNotification('Voice input is not supported in this browser.');
      return;
    }

    set({ isListening: true, aiStatus: 'listening' });
    const success = voiceInput.startListening(
      (transcript) => {
        set({ isListening: false });
        if (transcript.trim()) {
          get().sendMessage(transcript);
        } else {
          set({ aiStatus: 'idle' });
        }
      },
      (error) => {
        console.warn('Voice recognition error:', error);
        set({ isListening: false, aiStatus: 'error' });
        setTimeout(() => set({ aiStatus: 'idle' }), 2000);
      },
      () => {
        set({ isListening: false });
        if (get().aiStatus === 'listening') {
          set({ aiStatus: 'idle' });
        }
      }
    );

    if (!success) {
      set({ isListening: false, aiStatus: 'idle' });
    }
  },

  stopVoiceInput: () => {
    voiceInput.stopListening();
    set({ isListening: false, aiStatus: 'idle' });
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: timeStr,
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      aiStatus: 'thinking',
    }));

    const playerPos = useGameStore.getState().playerPosition;
    const currentFloor = useGameStore.getState().currentFloor;
    const buildingMode = useGameStore.getState().buildingMode;

    try {
      const response = await fetch(`${API_BASE_URL}/api/parkar/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          player_state: {
            x: playerPos.x,
            y: playerPos.y,
            z: playerPos.z,
            floor: currentFloor,
          },
          history: get().messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          building_mode: buildingMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data: ParkarApiResponse = await response.json();

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: data.response_text || "I've processed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: data.action,
      };

      set((state) => ({
        messages: [...state.messages, assistantMsg],
        aiStatus: data.intent === 'NAVIGATE' ? 'navigating' : 'idle',
      }));

      // Speak response if voice output is enabled
      if (get().isVoiceOutputEnabled) {
        voiceOutput.speak(data.response_text);
      }

      // If action is SET_ROUTE, activate route in GameStore and 3D RouteVisualizer!
      if (data.action && data.action.type === 'SET_ROUTE' && data.action.route) {
        const gameStore = useGameStore.getState();
        gameStore.setRoutes(
          [data.action.route],
          data.action.destination_id,
          data.action.destination_name
        );
        gameStore.setActiveRoute(data.action.route);
        gameStore.setNotification(`PARKAR: Route mapped to ${data.action.destination_name}`);
      }
    } catch (err) {
      console.error('PARKAR AI request failed:', err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: "AI service connection error. You can still use the manual Wayfinder panel on the left!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      set((state) => ({
        messages: [...state.messages, errorMsg],
        aiStatus: 'error',
      }));

      setTimeout(() => set({ aiStatus: 'idle' }), 3000);
    }
  },

  clearHistory: () => set({ messages: [INITIAL_GREETING], aiStatus: 'idle' }),
}));
