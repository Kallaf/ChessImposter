import { useState } from 'react';
import { X, Send } from 'lucide-react';

type ChatMessage = {
  sender: string;
  text: string;
  isSelf: boolean;
};

type ChatWindowProps = {
  isOpen: boolean;
  onClose: () => void;
  messages?: ChatMessage[];
  onSendMessage?: (msg: string) => void;
};

export function ChatWindow({ isOpen, onClose, messages = [], onSendMessage }: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="absolute right-0 top-16 bottom-0 w-80 bg-card border-l border-border shadow-2xl flex flex-col z-40 animate-in slide-in-from-right-8 duration-300 sm:relative sm:top-0 sm:border-l-0 sm:shadow-none sm:rounded-xl sm:border sm:h-[600px]">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          Chat Room
        </h3>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground mt-4">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-muted-foreground mb-1 px-1">
                {msg.sender}
              </span>
              <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm ${
                msg.isSelf 
                  ? 'bg-primary text-primary-foreground rounded-br-sm' 
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card">
        <div className="flex relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-muted border-none rounded-full pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="absolute right-1 top-1 bottom-1 w-8 flex items-center justify-center text-primary disabled:opacity-50 hover:bg-background rounded-full transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}