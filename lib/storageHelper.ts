export async function safeSet<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    await browser.storage.local.set({ [key]: value });
  } else {
    // Fallback to window.localStorage (synchronous)
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Fallback storage set error:', e);
      throw e;
    }
  }
  } catch (e) {
    console.error(`Error setting storage key "${key}":`, e);
    throw e;
  }
}

export async function safeGet<T>(key: string): Promise<T | undefined> {
  try {
    let result;
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    result = await browser.storage.local.get(key);
  } else {
    // Fallback to window.localStorage
    const item = window.localStorage.getItem(key);
    result = item ? { [key]: JSON.parse(item) } : {};
  }
    return result[key] as T | undefined;
  } catch (e) {
    console.error(`Error getting storage key "${key}":`, e);
    throw e;
  }
}

export async function safeRemove(key: string): Promise<void> {
  try {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    await browser.storage.local.remove(key);
  } else {
    // Fallback to window.localStorage
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.error('Fallback storage remove error:', e);
      throw e;
    }
  }
  } catch (e) {
    console.error(`Error removing storage key "${key}":`, e);
    throw e;
  }
}
