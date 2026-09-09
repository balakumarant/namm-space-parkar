import { RouteOption } from '../services/pathfinding';

export type AIStatus = 'idle' | 'listening' | 'thinking' | 'navigating' | 'arrived' | 'error';

export interface ParkarAction {
  type: 'SET_ROUTE';
  destination_id: string;
  destination_name: string;
  preference: string;
  route?: RouteOption;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  action?: ParkarAction;
}

export interface ParkarApiResponse {
  response_text: string;
  intent: string;
  action?: ParkarAction;
  tool_calls_executed?: string[];
  provider?: string;
  status: string;
}
