const SETTINGS_KEY = 'tradingBotSettings';

/**
 * Saves the provided settings object to localStorage.
 * @param {object} settings - The settings object to save.
 */
export const saveSettings = (settings) => {
  try {
    const settingsJson = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, settingsJson);
  } catch (error) {
    console.error("Could not save settings to localStorage", error);
  }
};

/**
 * Loads settings from localStorage.
 * @returns {object|null} The loaded settings object or null if not found.
 */
export const loadSettings = () => {
  try {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    return settingsJson ? JSON.parse(settingsJson) : {};
  } catch (error) {
    console.error("Could not load settings from localStorage", error);
    return {};
  }
};

/**
 * Clears all saved settings from localStorage.
 */
export const clearSettings = () => {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    // Reload the page to apply the cleared settings
    window.location.reload();
  } catch (error) {
    console.error("Could not clear settings from localStorage", error);
  }
};
