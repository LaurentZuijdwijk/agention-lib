/**
 * Configuration management for visualization reporting.
 * Reads from environment variables and allows programmatic overrides.
 */

export interface VizConfigOptions {
  /** Enable/disable visualization reporting */
  enabled?: boolean;
  /** WebSocket URL for the visualization server */
  url?: string;
  /** Session name for labeling */
  sessionName?: string;
  /** Auto-reconnect on disconnect */
  reconnect?: boolean;
  /** Reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Maximum events to queue when disconnected */
  maxQueueSize?: number;
}

const DEFAULT_CONFIG: Required<VizConfigOptions> = {
  enabled: false,
  url: "ws://localhost:4242/ws/agent",
  sessionName: "",
  reconnect: true,
  reconnectInterval: 5000,
  maxQueueSize: 1000,
};

class VizConfigManager {
  private config: Required<VizConfigOptions>;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadFromEnvironment();
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    if (typeof process !== "undefined" && process.env) {
      if (process.env.AGENTION_VIZ_ENABLED === "true") {
        this.config.enabled = true;
      }

      if (process.env.AGENTION_VIZ_URL) {
        this.config.url = process.env.AGENTION_VIZ_URL;
      }

      if (process.env.AGENTION_VIZ_SESSION_NAME) {
        this.config.sessionName = process.env.AGENTION_VIZ_SESSION_NAME;
      }

      if (process.env.AGENTION_VIZ_RECONNECT_INTERVAL) {
        const interval = parseInt(
          process.env.AGENTION_VIZ_RECONNECT_INTERVAL,
          10
        );
        if (!isNaN(interval)) {
          this.config.reconnectInterval = interval;
        }
      }
    }
  }

  /**
   * Set configuration options programmatically
   */
  set(options: VizConfigOptions): void {
    if (options.enabled !== undefined) {
      this.config.enabled = options.enabled;
    }
    if (options.url !== undefined) {
      this.config.url = options.url;
    }
    if (options.sessionName !== undefined) {
      this.config.sessionName = options.sessionName;
    }
    if (options.reconnect !== undefined) {
      this.config.reconnect = options.reconnect;
    }
    if (options.reconnectInterval !== undefined) {
      this.config.reconnectInterval = options.reconnectInterval;
    }
    if (options.maxQueueSize !== undefined) {
      this.config.maxQueueSize = options.maxQueueSize;
    }
  }

  /**
   * Get current configuration
   */
  get(): Readonly<Required<VizConfigOptions>> {
    return { ...this.config };
  }

  /**
   * Check if visualization is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the WebSocket URL
   */
  getUrl(): string {
    return this.config.url;
  }

  /**
   * Get session name
   */
  getSessionName(): string {
    return this.config.sessionName;
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.loadFromEnvironment();
  }
}

/** Global configuration instance */
export const vizConfig = new VizConfigManager();
