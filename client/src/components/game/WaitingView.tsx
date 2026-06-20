import { Loader2, X } from 'lucide-react';

type WaitingViewProps = {
  action: 'rematch' | 'new-game';
  onCancel: () => void;
};

export function WaitingView({ action, onCancel }: WaitingViewProps) {
  const isRematch = action === 'rematch';
  const title = isRematch ? 'Waiting for opponent...' : 'Finding new match...';
  const subtitle = isRematch 
    ? 'Your opponent is deciding...' 
    : 'Searching for a worthy adversary...';

  return (
    <div className="flex flex-col items-center justify-center py-4 animate-in fade-in zoom-in duration-300">
      {/* Animated Loader Graphic */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="absolute w-20 h-20 rounded-full bg-primary/20 animate-ping" />
        <div className="relative bg-card rounded-full p-4 border border-border shadow-sm">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>

      {/* Status Text */}
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-8 font-medium">
        {subtitle}
      </p>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-muted text-foreground font-bold hover:bg-muted/80 transition-colors"
      >
        <X className="w-4 h-4" /> Cancel
      </button>
    </div>
  );
}