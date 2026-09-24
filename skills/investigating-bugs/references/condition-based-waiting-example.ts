// This non-standalone reference implements condition-based waiting utilities for
// an event-driven thread manager. It shows how the generic `waitFor` pattern can
// specialize into helpers for a concrete domain.

import type { ThreadManager } from "~/threads/thread-manager";
import type { LaceEvent, LaceEventType } from "~/threads/types";

/**
 * Waits for the first event of a specified type in a thread.
 *
 * @param threadManager - The thread manager to query.
 * @param threadId - The thread to check for events.
 * @param eventType - The event type to wait for.
 * @param timeoutMs - The maximum wait. Default: 5,000 ms.
 * @returns A promise that resolves to the first matching event.
 * @example
 *   await waitForEvent(threadManager, agentThreadId, 'TOOL_RESULT');
 */
export function waitForEvent(
  threadManager: ThreadManager,
  threadId: string,
  eventType: LaceEventType,
  timeoutMs = 5000,
): Promise<LaceEvent> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const event = events.find((e) => e.type === eventType);

      if (event) {
        resolve(event);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(
          new Error(
            `Timeout waiting for ${eventType} event after ${timeoutMs} ms`,
          ),
        );
      } else {
        setTimeout(check, 10); // Poll every 10 ms.
      }
    };

    check();
  });
}

/**
 * Waits for a specified number of events of one type.
 *
 * @param threadManager - The thread manager to query.
 * @param threadId - The thread to check for events.
 * @param eventType - The event type to wait for.
 * @param count - The number of events to wait for.
 * @param timeoutMs - The maximum wait. Default: 5,000 ms.
 * @returns A promise that resolves to all matching events once the count is reached.
 * @example
 *   // Wait for 2 AGENT_MESSAGE events (initial response + continuation)
 *   await waitForEventCount(threadManager, agentThreadId, 'AGENT_MESSAGE', 2);
 */
export function waitForEventCount(
  threadManager: ThreadManager,
  threadId: string,
  eventType: LaceEventType,
  count: number,
  timeoutMs = 5000,
): Promise<LaceEvent[]> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const matchingEvents = events.filter((e) => e.type === eventType);

      if (matchingEvents.length >= count) {
        resolve(matchingEvents);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(
          new Error(
            `Timeout waiting for ${count} ${eventType} events after ${timeoutMs} ms (got ${matchingEvents.length})`,
          ),
        );
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

/**
 * Waits for the first event that matches a custom predicate.
 * Use this helper to check event data rather than only the event type.
 *
 * @param threadManager - The thread manager to query.
 * @param threadId - The thread to check for events.
 * @param predicate - A function that returns true when an event matches.
 * @param description - A human-readable description for error messages.
 * @param timeoutMs - The maximum wait. Default: 5,000 ms.
 * @returns A promise that resolves to the first matching event.
 * @example
 *   // Wait for TOOL_RESULT with specific ID
 *   await waitForEventMatch(
 *     threadManager,
 *     agentThreadId,
 *     (e) => e.type === 'TOOL_RESULT' && e.data.id === 'call_123',
 *     'TOOL_RESULT with id=call_123'
 *   );
 */
export function waitForEventMatch(
  threadManager: ThreadManager,
  threadId: string,
  predicate: (event: LaceEvent) => boolean,
  description: string,
  timeoutMs = 5000,
): Promise<LaceEvent> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const event = events.find(predicate);

      if (event) {
        resolve(event);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(
          new Error(`Timeout waiting for ${description} after ${timeoutMs} ms`),
        );
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

// Comparison example:
//
// Fixed delays (flaky):
// const messagePromise = agent.sendMessage('Execute tools');
// await new Promise(r => setTimeout(r, 300)); // Hope tools start in 300ms
// agent.abort();
// await messagePromise;
// await new Promise(r => setTimeout(r, 50));  // Hope results arrive in 50ms
// expect(toolResults.length).toBe(2);         // Fails randomly
//
// Condition-based waits (reliable):
// const messagePromise = agent.sendMessage('Execute tools');
// await waitForEventCount(threadManager, threadId, 'TOOL_CALL', 2); // Wait for tools to start
// agent.abort();
// await messagePromise;
// await waitForEventCount(threadManager, threadId, 'TOOL_RESULT', 2); // Wait for results
// expect(toolResults.length).toBe(2);
