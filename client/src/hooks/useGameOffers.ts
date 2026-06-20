import { useNotification } from '../context/NotificationContext';

export interface GameOfferActions {
  sendDrawOffer: () => void;
  acceptDrawOffer: () => void;
  rejectDrawOffer: () => void;
  sendRematchOffer: () => void;
  acceptRematchOffer: () => void;
  rejectRematchOffer: () => void;
}

export function useGameOffers(actions: GameOfferActions) {
  const { showNotification, hideNotification } = useNotification();

  // Centralized handler for incoming payload offers
  const handleOffers = (gameStatus: any, currentGuestId: string) => {
    // 1. Handle incoming Draw Offer
    if (gameStatus.drawOffer && gameStatus.drawOffer !== currentGuestId) {
      showNotification({
        title: "Draw Offer",
        description: "Your opponent offered a draw.",
        icon: "🤝",
        actions: [
          {
            label: "Reject",
            variant: "danger",
            onClick: () => {
              actions.rejectDrawOffer();
              hideNotification();
            },
          },
          {
            label: "Accept",
            variant: "success",
            onClick: () => {
              actions.acceptDrawOffer();
              hideNotification();
            },
          },
        ],
      });
    }

    // 2. Handle incoming Rematch Offer
    if (gameStatus.rematchOffer && gameStatus.rematchOffer !== currentGuestId) {
      showNotification({
        title: "Rematch Request",
        description: "Your opponent wants a rematch.",
        icon: "⚔️",
        actions: [
          {
            label: "Decline",
            variant: "secondary",
            onClick: () => {
              actions.rejectRematchOffer();
              hideNotification();
            },
          },
          {
            label: "Accept",
            variant: "primary",
            onClick: () => {
              actions.acceptRematchOffer();
              hideNotification();
            },
          },
        ],
      });
    }
  };

  // UI Prompts for outgoing offers
  const promptDrawOffer = () => {
    showNotification({
      title: "Offer Draw",
      description: "Do you want to offer a draw?",
      icon: "🤝",
      actions: [
        { label: "Cancel", variant: "secondary", onClick: hideNotification },
        {
          label: "Offer",
          variant: "primary",
          onClick: () => {
            actions.sendDrawOffer();
            hideNotification();
          },
        },
      ],
    });
  };

  const promptRematchOffer = () => {
    showNotification({
      title: "Offer Rematch",
      description: "Do you want to offer a rematch?",
      icon: "🔄",
      actions: [
        { label: "Cancel", variant: "secondary", onClick: hideNotification },
        {
          label: "Offer",
          variant: "primary",
          onClick: () => {
            actions.sendRematchOffer();
            hideNotification();
          },
        },
      ],
    });
  };

  return { 
    handleOffers, 
    promptDrawOffer, 
    promptRematchOffer 
  };
}