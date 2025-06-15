/**
 * Agent Infrastructure for Athena
 * 
 * This module provides the base infrastructure for integrating external
 * security agents with the Athena platform. The actual agent implementations
 * (OWL, DORU, AEGIS, WEAVER, FORGE, POLIS) are in separate repositories.
 */

export * from './types';
export * from './agent-interface';
export * from './message-bus';
export * from './agent-registry';
export * from './agent-connector';

// Re-export for convenience
export { MessageBus } from './message-bus';
export { AgentRegistry } from './agent-registry';
export { AgentConnector } from './agent-connector';