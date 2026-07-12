import { Connection } from "klf-200-api";
import { connect, type ConnectionOptions, type PeerCertificate, type TLSSocket } from "node:tls";

const KLF200_TLS_PORT = 51200;
export const KLF200_FACTORY_FINGERPRINT = "02:8C:23:A0:89:2B:62:98:C4:99:00:5B:D2:E7:2E:0A:70:3D:71:6A";
const patchAppliedSymbol = Symbol.for("iobroker.klf200.tlsFingerprintPatchApplied");

type FingerprintConnection = {
	host: string;
	readonly CA: Buffer;
	readonly fingerprint: string;
	readonly connectionOptions?: ConnectionOptions;
	sckt?: TLSSocket;
	socketClosedEventHandler: () => void;
};

function createPinnedTlsConnectionOptions(
	connection: Pick<FingerprintConnection, "CA" | "fingerprint">,
): ConnectionOptions {
	return {
		rejectUnauthorized: false,
		ca: [connection.CA],
		checkServerIdentity: (host, cert) => {
			if (cert.fingerprint === connection.fingerprint) {
				return undefined;
			}
			return new Error(
				`KLF-200 certificate fingerprint mismatch. Expected ${connection.fingerprint}, got ${cert.fingerprint ?? "<none>"}.`,
			);
		},
	};
}

function runServerIdentityCheck(
	checkServerIdentity: NonNullable<ConnectionOptions["checkServerIdentity"]>,
	host: string,
	cert: PeerCertificate,
): Error | undefined {
	try {
		return checkServerIdentity(host, cert) ?? undefined;
	} catch (error) {
		return error as Error;
	}
}

/**
 * Creates TLS options that disable strict certificate chain validation and enforce fingerprint pinning.
 *
 * @param hostname KLF200 hostname.
 * @param sslPublicKey Optional custom CA/certificate as configured in the adapter.
 * @param sslFingerprint Optional custom fingerprint as configured in the adapter.
 */
export function createKlf200PinnedTlsOptions(
	hostname: string,
	sslPublicKey?: string,
	sslFingerprint?: string,
): ConnectionOptions {
	const connection = new Connection(
		hostname,
		sslPublicKey !== undefined ? Buffer.from(sslPublicKey) : undefined,
		sslFingerprint ?? KLF200_FACTORY_FINGERPRINT,
	);
	return createPinnedTlsConnectionOptions(connection);
}

/**
 * Patches klf-200-api connection startup so fingerprint pinning works even when certificate chain validation fails.
 */
export function applyKlf200TlsFingerprintPatch(): void {
	const prototype = Connection.prototype as unknown as Record<symbol, unknown>;
	if (prototype[patchAppliedSymbol]) {
		return;
	}
	prototype[patchAppliedSymbol] = true;

	(Connection.prototype as any).initSocketAsync = async function (this: FingerprintConnection): Promise<void> {
		if (this.sckt !== undefined) {
			return Promise.resolve();
		}

		const effectiveConnectionOptions = this.connectionOptions ?? createPinnedTlsConnectionOptions(this);

		return await new Promise<void>((resolve, reject) => {
			const loginErrorHandler = (error: Error): void => {
				this.sckt = undefined;
				reject(error);
			};

			try {
				this.sckt = connect(KLF200_TLS_PORT, this.host, effectiveConnectionOptions, () => {
					if (this.sckt?.authorized) {
						this.sckt?.off("error", loginErrorHandler);
						resolve();
						return;
					}

					const cert = this.sckt?.getPeerCertificate();
					let serverIdentityError: Error | undefined;
					if (
						cert !== undefined &&
						Object.keys(cert).length > 0 &&
						effectiveConnectionOptions.checkServerIdentity !== undefined
					) {
						serverIdentityError = runServerIdentityCheck(
							effectiveConnectionOptions.checkServerIdentity,
							this.host,
							cert,
						);
					}

					if (serverIdentityError === undefined && cert !== undefined && Object.keys(cert).length > 0) {
						this.sckt?.off("error", loginErrorHandler);
						resolve();
						return;
					}

					const error =
						serverIdentityError ??
						this.sckt?.authorizationError ??
						new Error("TLS peer certificate missing.");

					this.sckt = undefined;
					reject(error);
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
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	};
}
