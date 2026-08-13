// app/utils/eventBus.ts
export const triggerEvent = (name: string) => {
    window.dispatchEvent(new Event(name));
  };
  
  export const listenEvent = (name: string, handler: () => void) => {
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
  };
  