// types/global.d.ts

export {};

declare global {
  /**
   * ✅ Declare Google Maps global safely for TypeScript.
   * Use 'any' to avoid "Cannot use namespace 'google' as a value" errors.
   */
  interface Window {
    google: typeof google;
  }  
}
