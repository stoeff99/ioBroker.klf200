"use strict";
import { GatewayCommand } from "klf-200-api";
/**
 * Returns the number of elements in the array that are not null or undefined.
 *
 * @param arr The array to count the elements of.
 */
export function ArrayCount(arr) {
    return arr
        .map(element => (element !== null && element !== undefined ? 1 : 0))
        .reduce((previousValue, currentValue) => previousValue + currentValue, 0);
}
/**
 * Converts an error or string to a string representation.
 *
 * @param e The input value, which can be of any type.
 * @returns A string representation of the input. If the input is a string,
 *          it is returned as-is. If it is an Error, its string representation
 *          is returned. For any other type, an empty string is returned.
 */
export function convertErrorToString(e) {
    let result = "";
    if (typeof e === "string") {
        result = e;
    }
    else if (e instanceof Error) {
        result = e.toString();
    }
    return result;
}
// KLF200 helpers
/**
 * Waits for a session finished notification from the gateway.
 *
 * @param adapter The ioBroker adapter instance used for managing timeouts and logging.
 * @param connection The connection to the gateway from which the session finished notification is expected.
 * @param sessionId The ID of the session for which the finished notification is awaited.
 * @param timeout The maximum time to wait for the notification before rejecting the promise, in milliseconds.
 *                 Defaults to 3000 milliseconds.
 * @returns A promise that resolves when the session finished notification with the specified session ID is received,
 *          or rejects with a "Timeout error" if the notification is not received within the specified timeout period.
 */
export function waitForSessionFinishedNtfAsync(adapter, connection, sessionId, timeout = 3000) {
    return new Promise((resolve, reject) => {
        let sessionHandler = undefined;
        const timeoutHandle = adapter.setTimeout(() => {
            sessionHandler?.dispose();
            sessionHandler = undefined;
            reject(new Error("Timeout error"));
        }, timeout);
        sessionHandler = connection.on(event => {
            if (event.SessionID === sessionId) {
                // Stop the timer as soon as possible!
                adapter.clearTimeout(timeoutHandle);
                sessionHandler?.dispose();
                resolve();
            }
        }, [GatewayCommand.GW_SESSION_FINISHED_NTF]);
    });
}
//# sourceMappingURL=utils.js.map