import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import NotificationPopup, {
  type NotificationAction,
} from "../components/notifications/NotificationPopup";

interface NotificationOptions {
  title: string;
  description: string;
  icon?: ReactNode;
  actions: NotificationAction[];
}

interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);

export function NotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notification, setNotification] =
    useState<NotificationOptions | null>(null);

  const hideNotification = () => setNotification(null);

  const showNotification = (options: NotificationOptions) => {
    setNotification(options);
  };

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        hideNotification,
      }}
    >
      {children}

      <NotificationPopup
        open={!!notification}
        title={notification?.title ?? ""}
        description={notification?.description ?? ""}
        icon={notification?.icon}
        actions={notification?.actions ?? []}
        onClose={hideNotification}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotification must be used inside NotificationProvider"
    );
  }

  return context;
}