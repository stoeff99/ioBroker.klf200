import type { Connection } from "klf-200-api";
import { connect, type ConnectionOptions, type TLSSocket } from "node:tls";

type ConnectionWithInternals = {
	CA: Buffer;
	fingerprint: string;
	host: string;
	connectionOptions?: ConnectionOptions;
	sckt?: TLSSocket;
	initSocketAsync?: () => Promise<void>;
	socketClosedEventHandler: () => void;
};

const KLF200_TLS_PORT = 51200;
export const FINGERPRINT_MISMATCH_TEXT = "KLF200 certificate fingerprint mismatch";

function normalizeFingerprint(fingerprint: string | undefined): string | undefined {
	return fingerprint?.trim().toUpperCase();
}

function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}
	return new Error(String(error));
}

export function createTlsConnectionOptionsWithFingerprintPinning(
	expectedFingerprint: string | undefined,
	baseConnectionOptions: ConnectionOptions | undefined,
	ca: Buffer | undefined,
): ConnectionOptions {
	const normalizedExpectedFingerprint = normalizeFingerprint(expectedFingerprint);
	const baseCheckServerIdentity = baseConnectionOptions?.checkServerIdentity;
	const pinnedConnectionOptions: ConnectionOptions = {
		...baseConnectionOptions,
		rejectUnauthorized: false,
		ca: baseConnectionOptions?.ca ?? (ca !== undefined ? [ca] : undefined),
		checkServerIdentity: (host, cert): Error | undefined => {
			if (baseCheckServerIdentity !== undefined) {
				try {
					return baseCheckServerIdentity(host, cert);
				} catch (error) {
					return toError(error);
				}
			}
			const actualFingerprint = normalizeFingerprint(cert.fingerprint);
			if (
				normalizedExpectedFingerprint === undefined ||
				actualFingerprint === undefined ||
				actualFingerprint !== normalizedExpectedFingerprint
			) {
				return new Error(
					`${FINGERPRINT_MISMATCH_TEXT} (expected: ${normalizedExpectedFingerprint ?? "undefined"}, received: ${actualFingerprint ?? "undefined"}).`,
				);
			}
			return undefined;
		},
	};

	return pinnedConnectionOptions;
}

export function getTlsAuthorizationError(
	socket: TLSSocket,
	host: string,
	connectionOptions: ConnectionOptions | undefined,
): Error | undefined {
	if (socket.authorized) {
		return undefined;
	}

	if (connectionOptions?.rejectUnauthorized === false && connectionOptions.checkServerIdentity !== undefined) {
		try {
			const peerCertificate = socket.getPeerCertificate();
			return connectionOptions.checkServerIdentity(host, peerCertificate);
		} catch (error) {
			return toError(error);
		}
	}

	return socket.authorizationError ?? new Error("TLS authorization failed.");
}

export function configureConnectionWithTlsFingerprintPinning(
	connection: Connection,
	connectionOptions?: ConnectionOptions,
	ca?: Buffer,
	fingerprint?: string,
): void {
	const connectionWithInternals = connection as unknown as ConnectionWithInternals;

	if (ca !== undefined) {
		connectionWithInternals.CA = ca;
	}
	if (fingerprint !== undefined && fingerprint.trim() !== "") {
		connectionWithInternals.fingerprint = fingerprint;
	}

	const hasExplicitFingerprint = fingerprint !== undefined && fingerprint.trim() !== "";
	const shouldUsePinnedTls =
		hasExplicitFingerprint || connectionOptions === undefined || connectionOptions.rejectUnauthorized === false;
	if (!shouldUsePinnedTls) {
		connectionWithInternals.connectionOptions = connectionOptions;
		return;
	}

	connectionWithInternals.connectionOptions = createTlsConnectionOptionsWithFingerprintPinning(
		connectionWithInternals.fingerprint,
		connectionOptions ?? connectionWithInternals.connectionOptions,
		connectionWithInternals.CA,
	);

	connectionWithInternals.initSocketAsync = async function (): Promise<void> {
		if (connectionWithInternals.sckt !== undefined) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const loginErrorHandler = (error: Error): void => {
				connectionWithInternals.sckt = undefined;
				reject(error);
			};
			const closeSocketAndCleanup = (): void => {
				connectionWithInternals.socketClosedEventHandler();
			};

			try {
				connectionWithInternals.sckt = connect(
					KLF200_TLS_PORT,
					connectionWithInternals.host,
					connectionWithInternals.connectionOptions,
					() => {
						const socket = connectionWithInternals.sckt;
						if (socket === undefined) {
							reject(new Error("TLS socket was closed unexpectedly."));
							return;
						}

						const authorizationError = getTlsAuthorizationError(
							socket,
							connectionWithInternals.host,
							connectionWithInternals.connectionOptions,
						);
						if (authorizationError === undefined) {
							socket.off("error", loginErrorHandler);
							resolve();
						} else {
							socket.destroy();
							connectionWithInternals.sckt = undefined;
							reject(authorizationError);
						}
					},
				);

				connectionWithInternals.sckt.on("error", loginErrorHandler);
				connectionWithInternals.sckt.on("close", () => {
					closeSocketAndCleanup();
				});
				connectionWithInternals.sckt.on("error", () => {
					closeSocketAndCleanup();
				});
				connectionWithInternals.sckt.on("end", () => {
					if (connectionWithInternals.sckt?.allowHalfOpen) {
						connectionWithInternals.sckt?.end(closeSocketAndCleanup);
					} else {
						closeSocketAndCleanup();
					}
				});
				connectionWithInternals.sckt.on("timeout", () => {
					connectionWithInternals.sckt?.end(closeSocketAndCleanup);
				});
			} catch (error) {
				reject(toError(error));
			}
		});
	};
}
