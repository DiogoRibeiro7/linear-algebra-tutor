/**
 * Main dashboard page with sidebar and chat
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatAPI } from '@/services/api';
import { useStore } from '@/store';
import { ChatInterface } from '@/components/ChatInterface';
import { Menu, Plus, MessageSquare, LogOut, Search, User } from 'lucide-react';

export function Dashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const {
    user,
    currentConversation,
    conversations,
    sidebarOpen,
    setCurrentConversation,
    setConversations,
    addConversation,
    toggleSidebar,
    setToken,
    setUser,
  } = useStore();

  // Case-insensitive substring match on title; empty query passes everything
  // through unchanged so untitled conversations stay visible.
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title || '').toLowerCase().includes(q),
    );
  }, [conversations, searchQuery]);

  // Fetch conversations
  const { data: fetchedConversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatAPI.getConversations,
  });

  useEffect(() => {
    if (fetchedConversations) {
      setConversations(fetchedConversations);
    }
  }, [fetchedConversations, setConversations]);

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: () => chatAPI.createConversation('New Conversation'),
    onSuccess: (newConversation) => {
      addConversation(newConversation);
      setCurrentConversation(newConversation);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Linear Algebra</h1>
          <p className="text-sm text-gray-500">AI Tutor</p>
        </div>

        {/* New conversation button */}
        <div className="p-4">
          <button
            onClick={() => createConversationMutation.mutate()}
            disabled={createConversationMutation.isPending}
            className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        {/* Search filter */}
        <div className="px-4 pb-2">
          <label htmlFor="conversation-search" className="sr-only">
            Search conversations
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              id="conversation-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations"
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto px-2">
          {filteredConversations.length === 0 && searchQuery && (
            <p className="px-3 py-2 text-sm text-gray-500">
              No conversations match &ldquo;{searchQuery}&rdquo;.
            </p>
          )}
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setCurrentConversation(conv)}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition ${
                currentConversation?.id === conv.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={16} />
                <span className="truncate text-sm">{conv.title}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {conv.message_count} messages
              </div>
            </button>
          ))}
        </div>

        {/* User info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <User size={20} className="text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800">
              {currentConversation?.title || 'Select a conversation'}
            </h2>
          </div>
        </div>

        {/* Chat interface */}
        <ChatInterface />
      </div>
    </div>
  );
}
