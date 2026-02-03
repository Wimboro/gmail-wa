// Simple logger for Cloudflare Workers
// Uses console.log which appears in wrangler tail and dashboard logs

type LogLevel = "debug" | "info" | "warning" | "error" | "success";

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: "[DEBUG]",
  info: "[INFO]",
  warning: "[WARN]",
  error: "[ERROR]",
  success: "[OK]",
};

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const prefix = LOG_PREFIXES[level];
  const formattedArgs = args.length > 0 ? " " + args.map(a => 
    typeof a === "object" ? JSON.stringify(a) : String(a)
  ).join(" ") : "";
  
  return `${timestamp} ${prefix} ${message}${formattedArgs}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    console.log(formatMessage("debug", message, ...args));
  },

  info(message: string, ...args: unknown[]): void {
    console.log(formatMessage("info", message, ...args));
  },

  warning(message: string, ...args: unknown[]): void {
    console.warn(formatMessage("warning", message, ...args));
  },

  error(message: string, ...args: unknown[]): void {
    console.error(formatMessage("error", message, ...args));
  },

  success(message: string, ...args: unknown[]): void {
    console.log(formatMessage("success", message, ...args));
  },

  separator(title?: string): void {
    const line = "=".repeat(50);
    if (title) {
      console.log(`\n${line}\n${title}\n${line}`);
    } else {
      console.log(line);
    }
  },
};
