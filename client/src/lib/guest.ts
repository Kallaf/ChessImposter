const GUEST_ID_KEY = 'chess_guest_id';
const DISPLAY_NAME_KEY = 'chess_display_name';

const NAME_PARTS = ['Knight', 'Bishop', 'Rook', 'Queen', 'King', 'Pawn', 'Sage'];

export function generateGuestName(): string {
  const piece = NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `Guest_${piece}${num}`;
}

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getDisplayName(): string | null {
  const name = localStorage.getItem(DISPLAY_NAME_KEY);
  return name?.trim() || null;
}

export function setDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 32));
}

export function hasIdentity(): boolean {
  return Boolean(getDisplayName());
}

export function getGuestProfile() {
  return {
    guestId: getGuestId(),
    displayName: getDisplayName() ?? generateGuestName(),
  };
}
