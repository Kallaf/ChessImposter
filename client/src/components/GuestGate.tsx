import { useState } from 'react';
import { generateGuestName, setDisplayName } from '../lib/guest';

type Props = {
  onReady: () => void;
};

export default function GuestGate({ onReady }: Props) {
  const [name, setName] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim() || generateGuestName();
    setDisplayName(finalName);
    onReady();
  }

  return (
    <div className="guest-gate">
      <div className="guest-gate-card">
        <p className="guest-gate-eyebrow">Welcome</p>
        <h1>Enter the arena</h1>
        <p className="guest-gate-sub">
          No account needed. Pick a display name and join the live lobby.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. TacticalTiger"
            maxLength={32}
            autoFocus
          />
          <button type="submit" className="btn primary">
            Enter lobby
          </button>
        </form>
        <p className="hint">Leave blank for a random guest name.</p>
      </div>
    </div>
  );
}
