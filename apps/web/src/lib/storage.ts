export const getLocalStorageItem = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const setLocalStorageItem = (key: string, value: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeLocalStorageItem = (key: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const getLocalStorageJsonItem = <T>(key: string): T | null => {
  const raw = getLocalStorageItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const setLocalStorageJsonItem = (key: string, value: unknown): boolean => {
  try {
    return setLocalStorageItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
};
