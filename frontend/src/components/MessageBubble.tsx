/**
 * Message bubble component for chat interface
 */
import { Message } from '@/services/api';
import { MathRenderer } from './MathRenderer';
import { User, Bot } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700'
        }`}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>
      
      {/* Message content */}
      <div
        className={`flex-1 max-w-3xl ${
          isUser ? 'text-right' : 'text-left'
        }`}
      >
        <div
          className={`inline-block px-4 py-3 rounded-lg ${
            isUser
              ? 'bg-primary-500 text-white'
              : 'bg-white border border-gray-200'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MathRenderer content={message.content} />
          )}
        </div>
        
        {/* Timestamp */}
        <div className="text-xs text-gray-400 mt-1 px-1">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
        
        {/* Sources (for assistant messages) */}
        {!isUser && message.metadata?.sources && message.metadata.sources.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            <details className="cursor-pointer">
              <summary className="hover:text-gray-700">
                Sources ({message.metadata.sources.length})
              </summary>
              <ul className="mt-1 space-y-1 pl-4">
                {message.metadata.sources.map((source, idx) => (
                  <li key={idx} className="list-disc">
                    {source.source} ({source.type})
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
