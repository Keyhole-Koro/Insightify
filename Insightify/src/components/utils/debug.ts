export class DebugLogger {
    private static DEBUG_MODE = true; // Static property to control debug mode
  
    // Static method for logging debug messages
    public static debug(...args: any[]): void {
      if (this.DEBUG_MODE) {
        console.log(...args);
      }
    }
  
    // Static method for logging warning messages
    public static warn(...args: any[]): void {
      if (this.DEBUG_MODE) {
        console.warn(...args);
      }
    }
  
    // Static method for logging error messages
    public static error(...args: any[]): void {
      if (this.DEBUG_MODE) {
        console.error(...args);
      }
    }
  
    // Optional: Method to enable or disable debug mode
    public static setDebugMode(enabled: boolean): void {
      this.DEBUG_MODE = enabled;
    }
  }