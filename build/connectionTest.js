import debugModule from "debug";
import { lookup } from "dns/promises";
import { Connection } from "klf-200-api";
import { connect } from "node:tls";
import ping from "ping";
import { configureConnectionWithTlsFingerprintPinning, getTlsAuthorizationError, } from "./util/tlsFingerprintPinning.js";
const debug = debugModule("connectionTest");
/**
 * Represents the result of a connection test step.
 */
export class ConnectionTestResult {
    stepOrder;
    stepName;
    run;
    success;
    message;
    result;
    /**
     * Constructor for a ConnectionTestResult.
     *
     * @param stepOrder The step number of the test in the order of execution.
     * @param stepName A short description of the test step.
     * @param run A boolean indicating whether the test step was run.
     * @param success A boolean indicating whether the test step was successful.
     * @param message A string message giving more information about the test result.
     * @param result An optional result object that can be an Error, a string or a number.
     */
    constructor(stepOrder, stepName, run, success, message, result) {
        this.stepOrder = stepOrder;
        this.stepName = stepName;
        this.run = run;
        this.success = success;
        this.message = message;
        this.result = result;
    }
}
/**
 * Implements connection test operations for KLF-200 devices.
 */
export class ConnectionTest {
    translation;
    /**
     * Creates an instance of ConnectionTest.
     *
     * @param translation The translation service to use for messages.
     */
    constructor(translation) {
        this.translation = translation;
    }
    /**
     * Resolves the given hostname to an IP address.
     *
     * @param hostname The hostname to resolve.
     * @returns A promise that resolves to the IP address as a string.
     */
    async resolveName(hostname) {
        debug(`Resolving name for hostname: ${hostname}`);
        const result = await lookup(hostname, { all: false, verbatim: false });
        debug(`Resolved address: ${result.address}`);
        return result.address;
    }
    /**
     * Pings the given IP address and returns the latency in milliseconds.
     *
     * @param ipadress The IP address to ping.
     * @returns A promise that resolves to the latency in milliseconds.
     */
    async ping(ipadress) {
        debug(`Pinging IP address: ${ipadress}`);
        const pingConfig = {
            packetSize: 64,
        };
        try {
            const result = await ping.promise.probe(ipadress, pingConfig);
            if (!result.alive) {
                debug(`Ping failed`);
                throw new Error(`Ping failed. ${result.output}`);
            }
            const latency = typeof result.time === "string"
                ? result.time === "unknown"
                    ? 0
                    : parseFloat(result.time)
                : result.time;
            debug(`Ping successful, latency: ${latency}ms`);
            return latency;
        }
        catch (error) {
            debug(`Ping exception: ${error.message}`);
            throw error;
        }
    }
    /**
     * Establishes a secure connection to the given hostname and port.
     *
     * @param hostname The hostname to connect to.
     * @param port The port to connect to.
     * @param connectionOptions Optional connection options.
     * @returns A promise that resolves when the connection is established.
     */
    async connectTlsSocket(hostname, port, connectionOptions) {
        debug(`Connecting to TLS socket at ${hostname}:${port}`);
        return new Promise((resolve, reject) => {
            let sckt;
            try {
                sckt = connect(port, hostname, connectionOptions, () => {
                    if (sckt === undefined) {
                        reject(new Error("TLS socket was closed unexpectedly."));
                        return;
                    }
                    const authorizationError = getTlsAuthorizationError(sckt, hostname, connectionOptions);
                    if (authorizationError === undefined) {
                        debug("TLS connection authorized");
                        sckt?.destroy();
                        sckt = undefined;
                        resolve();
                    }
                    else {
                        debug(`TLS connection authorization error: ${authorizationError.message}`);
                        sckt?.destroy();
                        reject(authorizationError);
                        sckt = undefined;
                    }
                });
                sckt.on("error", (error) => {
                    debug(`TLS connection error: ${error.message}`);
                    reject(error);
                });
            }
            catch (error) {
                debug(`TLS connection exception: ${error.message}`);
                if (sckt) {
                    sckt.destroy();
                }
                reject(error);
            }
        });
    }
    /**
     * Logs in to the given hostname with the given password.
     *
     * @param hostname The hostname to log in to.
     * @param password The password to use for logging in.
     * @param connectionOptions Optional connection options.
     * @returns A promise that resolves when the login is successful.
     */
    async login(hostname, password, connectionOptions) {
        const connection = connectionOptions === undefined ? new Connection(hostname) : new Connection(hostname, connectionOptions);
        configureConnectionWithTlsFingerprintPinning(connection, connectionOptions);
        try {
            await connection.loginAsync(password);
        }
        finally {
            await connection.logoutAsync();
        }
    }
    /**
     * Runs connection tests for the given hostname and password.
     *
     * @param hostname The hostname to test.
     * @param password The password to use for logging in.
     * @param connectionOptions Optional connection options.
     * @param progressCallback Optional callback to report progress.
     * @returns A promise that resolves to an array of ConnectionTestResult objects.
     */
    async runTests(hostname, password, connectionOptions, progressCallback) {
        const result = [
            {
                stepOrder: 1,
                stepName: await this.translation.translate("connection-test-step-name-name-lookup"),
                run: false,
            },
            {
                stepOrder: 2,
                stepName: await this.translation.translate("connection-test-step-name-ping"),
                run: false,
            },
            {
                stepOrder: 3,
                stepName: await this.translation.translate("connection-test-step-name-connection"),
                run: false,
            },
            {
                stepOrder: 4,
                stepName: await this.translation.translate("connection-test-step-name-login"),
                run: false,
            },
        ];
        const callProgressCallback = async function () {
            if (progressCallback) {
                await progressCallback(result);
            }
        };
        // Send the progress data back for display
        await callProgressCallback();
        // Step 1: Name lookup
        try {
            const ipaddress = await this.resolveName(hostname);
            result[0] = {
                ...result[0],
                run: true,
                success: true,
                message: await this.translation.translate("connection-test-message-name-lookup-success", {
                    hostname: hostname,
                    ipaddress: ipaddress,
                }),
                result: ipaddress,
            };
            await callProgressCallback();
            // Step 2: Ping
            try {
                const ms = await this.ping(ipaddress);
                result[1] = {
                    ...result[1],
                    run: true,
                    success: true,
                    // message: `Ping was successful after ${ms} milliseconds.`,
                    message: await this.translation.translate("connection-test-message-ping-success", {
                        ms: ms.toString(),
                    }),
                    result: ms,
                };
                await callProgressCallback();
                // Step 3: TLS connection
                try {
                    await this.connectTlsSocket(hostname, 51200, connectionOptions);
                    result[2] = {
                        ...result[2],
                        run: true,
                        success: true,
                        message: await this.translation.translate("connection-test-message-connection-success"),
                    };
                    await callProgressCallback();
                    // Step 4: Login
                    try {
                        await this.login(hostname, password, connectionOptions);
                        result[3] = {
                            ...result[3],
                            run: true,
                            success: true,
                            message: await this.translation.translate("connection-test-message-login-success"),
                        };
                    }
                    catch (error) {
                        result[3] = {
                            ...result[3],
                            run: true,
                            success: false,
                            message: await this.translation.translate("connection-test-message-login-failure", {
                                message: error.message,
                            }),
                            result: error,
                        };
                    }
                }
                catch (error) {
                    result[2] = {
                        ...result[2],
                        run: true,
                        success: false,
                        message: await this.translation.translate("connection-test-message-connection-failure", {
                            message: error.message,
                        }),
                        result: error,
                    };
                }
            }
            catch (error) {
                result[1] = {
                    ...result[1],
                    run: true,
                    success: false,
                    message: await this.translation.translate("connection-test-message-ping-failure", {
                        ipaddress: ipaddress,
                        message: error.message,
                    }),
                    result: error,
                };
            }
        }
        catch (error) {
            result[0] = {
                ...result[0],
                run: true,
                success: false,
                message: await this.translation.translate("connection-test-message-name-lookup-failure", {
                    hostname: hostname,
                }),
                result: error,
            };
        }
        return result;
    }
}
//# sourceMappingURL=connectionTest.js.map