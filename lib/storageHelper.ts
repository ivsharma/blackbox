export async function safeSet<T>(key: string, value: T): Promise<void> {
  try {
    await browser.storage.local.set({ [key]: value });
  } catch (e) {
    console.error(`Error setting storage key "${key}":`, e);
    throw e;
  }
}

export async function safeGet<T>(key: string): Promise<T | undefined> {
  try {
    const result = await browser.storage.local.get(key);
    return result[key] as T | undefined;
  } catch (e) {
    console.error(`Error getting storage key "${key}":`, e);
    throw e;
  }
}

export async function safeRemove(key: string): Promise<void> {
  try {
    await browser.storage.local.remove(key);
  } catch (e) {
    console.error(`Error removing storage key "${key}":`, e);
    throw e;
  }
}
