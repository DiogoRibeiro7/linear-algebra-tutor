/**
 * API service for communicating with the backend
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  message_count: number;
}

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  sources: any[];
  conversation_id: number;
  message_id: number;
}

// Auth API
export const authAPI = {
  async register(data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }): Promise<User> {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  async login(username: string, password: string): Promise<string> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    const token = response.data.access_token;
    localStorage.setItem('token', token);
    return token;
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout() {
    localStorage.removeItem('token');
  },
};

// Chat API
export const chatAPI = {
  async createConversation(title?: string): Promise<Conversation> {
    const response = await api.post('/chat/conversations', { title });
    return response.data;
  },

  async getConversations(): Promise<Conversation[]> {
    const response = await api.get('/chat/conversations');
    return response.data;
  },

  async getMessages(conversationId: number): Promise<Message[]> {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`);
    return response.data;
  },

  async sendMessage(conversationId: number, content: string): Promise<ChatResponse> {
    const response = await api.post(
      `/chat/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data;
  },
};

export default api;
