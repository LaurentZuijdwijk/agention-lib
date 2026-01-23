/**
 * Visualization module for agent monitoring.
 *
 * This module provides tools for sending agent execution events
 * to a visualization server (@agention/viz).
 *
 * @example
 * ```typescript
 * import { vizConfig, vizReporter } from 'agention-lib';
 *
 * // Enable visualization programmatically
 * vizConfig.set({ enabled: true, url: 'ws://localhost:4242/ws/agent' });
 *
 * // Or use environment variables:
 * // AGENTION_VIZ_ENABLED=true
 * // AGENTION_VIZ_URL=ws://localhost:4242/ws/agent
 *
 * // Start a session
 * vizReporter.startSession('My Test Session');
 *
 * // Agent events are automatically reported when visualization is enabled
 * const response = await agent.execute('Hello!');
 *
 * // End the session
 * vizReporter.endSession('completed');
 * ```
 */

export { vizConfig, type VizConfigOptions } from "./VizConfig";
export { vizReporter, VizReporter } from "./VizReporter";
export * from "./types";
