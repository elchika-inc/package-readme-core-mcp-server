export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
  source?: string;
}

export class Logger {
  private level: LogLevel;
  private source: string;

  constructor(source: string = 'Package-README-Core-MCP', level: LogLevel = LogLevel.WARN) {
    this.source = source;
    this.level = this.parseLogLevel(process.env.LOG_LEVEL) || level;
  }

  private parseLogLevel(level?: string): LogLevel | undefined {
    if (!level) return undefined;
    
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return undefined;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      timestamp: new Date(),
      data,
      source: this.source
    };
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const source = entry.source ? `[${entry.source}]` : '';
    
    let formatted = `${timestamp} ${levelName} ${source} ${entry.message}`;
    
    if (entry.data) {
      formatted += ` ${JSON.stringify(entry.data)}`;
    }
    
    return formatted;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
      console.debug(this.formatLogEntry(entry));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, message, data);
      console.info(this.formatLogEntry(entry));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, message, data);
      console.warn(this.formatLogEntry(entry));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, message, data);
      console.error(this.formatLogEntry(entry));
    }
  }

  // Convenience methods for common logging scenarios
  logDetection(packageName: string, detectedManagers: any[], confidence: number): void {
    this.info('Package manager detection completed', {
      package_name: packageName,
      detected_managers: detectedManagers.map(d => d.manager),
      confidence_score: confidence,
      detection_count: detectedManagers.length
    });
  }

  logToolCall(manager: string, toolName: string, params: any, success: boolean, responseTime: number): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const message = `Tool call ${success ? 'completed' : 'failed'}: ${manager}.${toolName}`;
    
    this.log(level, message, {
      manager,
      tool: toolName,
      params,
      success,
      response_time_ms: responseTime
    });
  }

  logOrchestrationStart(toolName: string, params: any): void {
    this.info(`Orchestration started: ${toolName}`, {
      tool: toolName,
      parameters: params
    });
  }

  logOrchestrationComplete(toolName: string, success: boolean, managersAttempted: string[], executionTime: number): void {
    this.info(`Orchestration completed: ${toolName}`, {
      tool: toolName,
      success,
      managers_attempted: managersAttempted,
      execution_time_ms: executionTime
    });
  }

  logConnectionEvent(manager: string, event: 'connected' | 'disconnected' | 'failed', details?: any): void {
    const level = event === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `MCP connection ${event}: ${manager}`, {
      manager,
      event,
      details
    });
  }

  logHealthCheck(manager: string, healthy: boolean, details?: any): void {
    const level = healthy ? LogLevel.DEBUG : LogLevel.WARN;
    this.log(level, `Health check ${healthy ? 'passed' : 'failed'}: ${manager}`, {
      manager,
      healthy,
      details
    });
  }

  logConfigurationEvent(event: string, details?: any): void {
    this.info(`Configuration event: ${event}`, details);
  }

  logPerformanceMetric(metric: string, value: number, unit: string = 'ms'): void {
    this.debug(`Performance metric: ${metric}`, {
      metric,
      value,
      unit
    });
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (this.shouldLog(level)) {
      const entry = this.createLogEntry(level, message, data);
      const formatted = this.formatLogEntry(entry);
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        case LogLevel.INFO:
          console.info(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
          console.error(formatted);
          break;
      }
    }
  }

  // Create child logger with additional context
  child(additionalSource: string): Logger {
    return new Logger(`${this.source}:${additionalSource}`, this.level);
  }

  // Update log level at runtime
  setLevel(level: LogLevel): void {
    this.level = level;
    this.info(`Log level changed to ${LogLevel[level]}`);
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

// Global logger instance
export const logger = new Logger();

// Convenience function to create scoped loggers
export function createLogger(source: string): Logger {
  return new Logger(source);
}