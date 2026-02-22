export function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '4px',
    zIndex: '2147483647',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    maxWidth: '300px',
    wordBreak: 'break-word',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
