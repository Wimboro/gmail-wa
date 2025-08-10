/**
 * Simple logger utility for clean console output
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

export const logger = {
  info: (message, ...args) => {
    console.log(`${colors.cyan}[INFO]${colors.reset} ${getTimestamp()} - ${message}`, ...args);
  },
  
  success: (message, ...args) => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${getTimestamp()} - ${message}`, ...args);
  },
  
  warning: (message, ...args) => {
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${getTimestamp()} - ${message}`, ...args);
  },
  
  error: (message, ...args) => {
    console.error(`${colors.red}[ERROR]${colors.reset} ${getTimestamp()} - ${message}`, ...args);
  },
  
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.magenta}[DEBUG]${colors.reset} ${getTimestamp()} - ${message}`, ...args);
    }
  },
  
  separator: (title = '') => {
    const line = '='.repeat(60);
    if (title) {
      const padding = Math.max(0, (60 - title.length - 2) / 2);
      const paddedTitle = ' '.repeat(Math.floor(padding)) + title + ' '.repeat(Math.ceil(padding));
      console.log(`${colors.bright}${line}${colors.reset}`);
      console.log(`${colors.bright}${paddedTitle}${colors.reset}`);
      console.log(`${colors.bright}${line}${colors.reset}`);
    } else {
      console.log(`${colors.bright}${line}${colors.reset}`);
    }
  }
}; 