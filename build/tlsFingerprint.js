import { Connection } from "klf-200-api";
import { connect } from "node:tls";
const KLF200_TLS_PORT = 51200;
export const KLF200_FACTORY_FINGERPRINT = "02:8C:23:A0:89:2B:62:98:C4:99:00:5B:D2:E7:2E:0A:70:3D:71:6A";
const patchAppliedSymbol = Symbol.for("iobroker.klf200.tlsFingerprintPatchApplied");
function runServerIdentityCheck(checkServerIdentity, host, cert) {
    try {
        return checkServerIdentity(host, cert) ?? undefined;
    }
    catch (error) {
        return error;
    }
}
/**
 * Creates TLS options that disable strict certificate chain validation and enforce fingerprint pinning.
 *
 * No built-in CA certificate is included in the default options so that an expired factory CA does
 * not prevent the TLS handshake from completing. Chain validation is intentionally bypassed via
 * `rejectUnauthorized: false`; peer authenticity is instead verified by comparing the server
 * certificate's fingerprint against the pinned value after the handshake.
 *
 * @param _hostname KLF200 hostname (kept for API compatibility).
 * @param sslPublicKey Optional custom CA/certificate as configured in the adapter.
 * @param sslFingerprint Optional custom fingerprint as configured in the adapter.
 */
export function createKlf200PinnedTlsOptions(_hostname, sslPublicKey, sslFingerprint) {
    const fingerprint = sslFingerprint ?? KLF200_FACTORY_FINGERPRINT;
    const result = {
        // Chain validation is intentionally disabled because the KLF-200 factory CA expired on
        // 2026-07-12.  Peer authenticity is enforced by fingerprint pinning in checkServerIdentity.
        rejectUnauthorized: false,
        checkServerIdentity: (_host, cert) => {
            if (cert.fingerprint === fingerprint) {
                return undefined;
            }
            return new Error(`KLF-200 certificate fingerprint mismatch. Expected ${fingerprint}, got ${cert.fingerprint ?? "<none>"}.`);
        },
    };
    if (sslPublicKey !== undefined) {
        result.ca = [Buffer.from(sslPublicKey)];
    }
    return result;
}
/**
 * Patches klf-200-api connection startup so fingerprint pinning works even when certificate chain
 * validation fails (e.g. when the factory certificate or its issuing CA has expired). The patch
 * replaces `Connection.prototype.initSocketAsync` with an implementation that:
 *   1. Connects with `rejectUnauthorized: false` so an expired chain does not abort the handshake.
 *   2. After the handshake, resolves immediately when the socket is already `authorized`.
 *   3. Otherwise performs a manual fingerprint check and resolves only on a match.
 */
export function applyKlf200TlsFingerprintPatch() {
    const prototype = Connection.prototype;
    if (prototype[patchAppliedSymbol]) {
        return;
    }
    prototype[patchAppliedSymbol] = true;
    Connection.prototype.initSocketAsync = async function () {
        if (this.sckt !== undefined) {
            return Promise.resolve();
        }
        const effectiveConnectionOptions = this.connectionOptions ?? {
            // Chain validation intentionally disabled – fingerprint pinning enforces peer authenticity.
            rejectUnauthorized: false,
            checkServerIdentity: (_host, cert) => {
                if (cert.fingerprint === this.fingerprint) {
                    return undefined;
                }
                return new Error(`KLF-200 certificate fingerprint mismatch. Expected ${this.fingerprint}, got ${cert.fingerprint ?? "<none>"}.`);
            },
        };
        // Separate the caller-supplied identity check from the socket-level connection options.
        // We suppress it at the TLS handshake layer so that the secureConnect callback is always
        // fired – even when the cert chain is invalid (expired factory CA).  The actual
        // fingerprint verification is then performed manually inside the callback.
        const { checkServerIdentity: userIdentityCheck } = effectiveConnectionOptions;
        const socketConnectionOptions = {
            ...effectiveConnectionOptions,
            checkServerIdentity: () => undefined,
        };
        return await new Promise((resolve, reject) => {
            const loginErrorHandler = (error) => {
                this.sckt = undefined;
                reject(error);
            };
            try {
                this.sckt = connect(KLF200_TLS_PORT, this.host, socketConnectionOptions, () => {
                    const cert = this.sckt?.getPeerCertificate();
                    if (cert === undefined || Object.keys(cert).length === 0) {
                        const socket = this.sckt;
                        this.sckt = undefined;
                        socket?.destroy();
                        reject(new Error("TLS peer certificate missing."));
                        return;
                    }
                    if (userIdentityCheck !== undefined) {
                        // Custom identity check (e.g. fingerprint pinning) – accept only on match.
                        const identityError = runServerIdentityCheck(userIdentityCheck, this.host, cert);
                        if (identityError !== undefined) {
                            const socket = this.sckt;
                            this.sckt = undefined;
                            socket?.destroy();
                            reject(identityError);
                            return;
                        }
                    }
                    else if (!this.sckt?.authorized && effectiveConnectionOptions.rejectUnauthorized !== false) {
                        // No custom check and the socket is not authorized – report the TLS error.
                        // Skip this check when rejectUnauthorized is false: the caller has explicitly
                        // opted in to accepting invalid/expired certificate chains.
                        const error = this.sckt?.authorizationError ?? new Error("TLS authorization failed.");
                        const socket = this.sckt;
                        this.sckt = undefined;
                        socket?.destroy();
                        reject(error);
                        return;
                    }
                    this.sckt?.off("error", loginErrorHandler);
                    resolve();
                });
                this.sckt?.on("error", loginErrorHandler);
                this.sckt?.on("close", () => {
                    this.socketClosedEventHandler();
                });
                this.sckt?.on("error", () => {
                    this.socketClosedEventHandler();
                });
                this.sckt?.on("end", () => {
                    if (this.sckt?.allowHalfOpen) {
                        this.sckt?.end(() => {
                            this.socketClosedEventHandler();
                        });
                    }
                });
                this.sckt?.on("timeout", () => {
                    this.sckt?.end(() => {
                        this.socketClosedEventHandler();
                    });
                });
            }
            catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    };
}
//# sourceMappingURL=tlsFingerprint.js.map