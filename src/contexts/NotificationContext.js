import React, { createContext, useState, useContext, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(currentNotifications => [
      ...currentNotifications,
      { id, message, type },
    ]);

    // Automatically remove the notification after 5 seconds
    setTimeout(() => {
      setNotifications(currentNotifications =>
        currentNotifications.filter(n => n.id !== id)
      );
    }, 5000);
  }, []);

  const removeNotification = id => {
    setNotifications(currentNotifications =>
      currentNotifications.filter(n => n.id !== id)
    );
  };

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      <div className="notification-container">
        {notifications.map(n => (
          <div key={n.id} className={`notification ${n.type}`}>
            {n.message}
            <button onClick={() => removeNotification(n.id)} className="notification-close-btn">
              &times;
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
