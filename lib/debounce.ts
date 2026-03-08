export function debounce<T extends (...args: any) => any>(fn: T, wait: number): T {
  let timeout: number | undefined;
  const debounced = (...args: Parameters<T>) => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => {
      fn(...args as any);
    }, wait);
  };
  return debounced as unknown as T;
}
