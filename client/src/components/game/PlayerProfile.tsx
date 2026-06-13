import { User } from 'lucide-react';

type PlayerProfileProps = {
  name: string;
  color: string;
  clockTime?: string;
  isActive: boolean;
};

export function PlayerProfile({ name, color, clockTime, isActive }: PlayerProfileProps) {
  return (
    <div className="flex justify-between items-center w-full px-2 mt-2 mb-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden border border-border">
          <User className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{name}</span>
          <span className="text-xs text-muted-foreground capitalize">{color}</span>
        </div>
      </div>
      {clockTime && (
        <div className={`px-4 py-2 rounded font-mono text-xl font-bold transition-colors ${
          isActive ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-card text-foreground border border-border'
        }`}>
          {clockTime}
        </div>
      )}
    </div>
  );
}