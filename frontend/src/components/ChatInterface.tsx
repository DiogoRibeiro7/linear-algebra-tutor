/**
 * Main chat interface component
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatAPI } from '@/services/api';
import { MessageBubble } from './MessageBubble';
import { Send, Loader2 } from 'lucide-react';
import { useStore } from '@/store';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const currentConversation = useStore((state) => state.currentConversation);
  
  // Fetch messages for current conversation
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', currentConversation?.id],
    queryFn: () => currentConversation ? chatAPI.getMessages(currentConversation.id) : Promise.resolve([]),
    enabled: !!currentConversation,
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => {
      if (!currentConversation) throw new Error('No conversation selected');
      return chatAPI.sendMessage(currentConversation.id, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', currentConversation?.id] });
      setInput('');
    },
  });
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(input);
  };
  
  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Welcome to Linear Algebra Tutor
          </h2>
          <p className="text-gray-500">
            Select a conversation or create a new one to get started
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">Start your learning journey!</p>
            <p className="text-sm">
              Ask me anything about Linear Algebra - I'm here to help you understand,
              not just give answers.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              <button
                className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition"
                onClick={() => setInput('Can you explain what an eigenvector is?')}
              >
                <span className="font-medium">🎯 Concept explanation</span>
                <p className="text-sm text-gray-600 mt-1">
                  What is an eigenvector?
                </p>
              </button>
              <button
                className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition"
                onClick={() => setInput('I need help solving a system of linear equations')}
              >
                <span className="font-medium">📝 Problem solving</span>
                <p className="text-sm text-gray-600 mt-1">
                  Help with linear systems
                </p>
              </button>
              <button
                className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition"
                onClick={() => setInput('Can you show me how to visualize a linear transformation in Python?')}
              >
                <span className="font-medium">💻 Code examples</span>
                <p className="text-sm text-gray-600 mt-1">
                  Visualize with Python
                </p>
              </button>
              <button
                className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition"
                onClick={() => setInput('What are the applications of eigenvalues in real-world problems?')}
              >
                <span className="font-medium">🌍 Real applications</span>
                <p className="text-sm text-gray-600 mt-1">
                  Why does this matter?
                </p>
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {sendMessageMutation.isPending && (
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <Loader2 className="animate-spin text-gray-600" size={18} />
                </div>
                <div className="flex-1 max-w-3xl">
                  <div className="inline-block px-4 py-3 rounded-lg bg-white border border-gray-200">
                    <p className="text-gray-500">Thinking...</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="border-t bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about Linear Algebra..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={sendMessageMutation.isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || sendMessageMutation.isPending}
              className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <Send size={18} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Tip: I use the Socratic method - I'll guide you to the answer rather than just telling you!
          </p>
        </form>
      </div>
    </div>
  );
}
