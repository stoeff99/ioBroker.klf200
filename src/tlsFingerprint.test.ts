import { expect } from "chai";
import { Connection } from "klf-200-api";
import type { PeerCertificate } from "node:tls";
import { MockServerController } from "../test/mocks/mockServerController.js";
import {
	KLF200_FACTORY_FINGERPRINT,
	applyKlf200TlsFingerprintPatch,
	createKlf200PinnedTlsOptions,
} from "./tlsFingerprint.js";

const MISMATCHED_FINGERPRINT = "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44";

describe("tlsFingerprint", function () {
	describe("createKlf200PinnedTlsOptions", function () {
		it("should set rejectUnauthorized to false", function () {
			const options = createKlf200PinnedTlsOptions("localhost");
			expect(options.rejectUnauthorized).to.be.false;
		});

		it("should not include a CA by default (so an expired factory CA does not block the handshake)", function () {
			const options = createKlf200PinnedTlsOptions("localhost");
			expect(options.ca).to.be.undefined;
		});

		it("should include CA when sslPublicKey is provided", function () {
			// Minimal valid base64 that can be decoded – the CA content is not verified here
			const fakeKey = Buffer.from("FAKEPEM").toString("base64");
			const options = createKlf200PinnedTlsOptions("localhost", fakeKey);
			expect(options.ca).to.not.be.undefined;
		});

		it("should accept the factory fingerprint by default", function () {
			const options = createKlf200PinnedTlsOptions("localhost");
			const fakeCert = { fingerprint: KLF200_FACTORY_FINGERPRINT } as PeerCertificate;
			expect(options.checkServerIdentity?.("localhost", fakeCert)).to.be.undefined;
		});

		it("should reject a certificate whose fingerprint does not match the factory fingerprint", function () {
			const options = createKlf200PinnedTlsOptions("localhost");
			const wrongCert = { fingerprint: MISMATCHED_FINGERPRINT } as PeerCertificate;
			const result = options.checkServerIdentity?.("localhost", wrongCert);
			expect(result).to.be.an.instanceOf(Error);
			expect(result?.message).to.include("fingerprint mismatch");
		});

		it("should accept a custom fingerprint when sslFingerprint is provided", function () {
			const customFingerprint = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD";
			const options = createKlf200PinnedTlsOptions("localhost", undefined, customFingerprint);
			const fakeCert = { fingerprint: customFingerprint } as PeerCertificate;
			expect(options.checkServerIdentity?.("localhost", fakeCert)).to.be.undefined;
		});

		it("should reject the factory fingerprint when a different custom fingerprint is configured", function () {
			const customFingerprint = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD";
			const options = createKlf200PinnedTlsOptions("localhost", undefined, customFingerprint);
			const factoryCert = { fingerprint: KLF200_FACTORY_FINGERPRINT } as PeerCertificate;
			const result = options.checkServerIdentity?.("localhost", factoryCert);
			expect(result).to.be.an.instanceOf(Error);
		});
	});

	describe("applyKlf200TlsFingerprintPatch", function () {
		it("should be idempotent when called multiple times", function () {
			// First call already happened when this module was imported.
			// Calling again must not throw and must not revert the patch.
			expect(() => applyKlf200TlsFingerprintPatch()).to.not.throw();
		});

		describe("patched Connection.initSocketAsync", function () {
			this.timeout(10_000);
			this.slow(2_000);

			it("should connect and resolve when the fingerprint matches (authorized=true path)", async function () {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				await using mockServerController = await MockServerController.createMockServer();
				const conn = MockServerController.createMockServerConnect();
				await expect(conn.loginAsync("velux123")).to.be.fulfilled;
				await conn.logoutAsync();
			});

			it("should connect and resolve when chain validation fails but fingerprint matches (authorized=false path)", async function () {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				await using mockServerController = await MockServerController.createMockServer();
				const mockFingerprint = MockServerController.getMockServerFingerprint();
				// Start from the mock-server options so mutual TLS (client key/cert) is included,
				// then override to simulate "server cert not trusted by client" (no CA, rejectUnauthorized:false).
				// This replicates the expired-factory-CA scenario: the connection proceeds but
				// socket.authorized is false, and the patch must fall through to the fingerprint check.
				const connectionOptions = {
					...MockServerController.getMockServerConnectionOptions(),
					rejectUnauthorized: false,
					ca: undefined, // no CA → chain validation fails → authorized will be false
					checkServerIdentity: (_host: string, cert: { fingerprint?: string }) => {
						if (cert.fingerprint === mockFingerprint) {
							return undefined;
						}
						return new Error(
							`KLF-200 certificate fingerprint mismatch. Expected ${mockFingerprint}, got ${cert.fingerprint ?? "<none>"}.`,
						);
					},
				};
				const conn = new Connection("localhost", connectionOptions);
				await expect(conn.loginAsync("velux123")).to.be.fulfilled;
				await conn.logoutAsync();
			});

			it("should reject when fingerprint does not match even with rejectUnauthorized: false", async function () {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				await using mockServerController = await MockServerController.createMockServer();
				const connectionOptions = {
					...MockServerController.getMockServerConnectionOptions(),
					rejectUnauthorized: false,
					ca: undefined, // no CA → chain validation fails → authorized will be false
					checkServerIdentity: (_host: string, cert: { fingerprint?: string }) => {
						if (cert.fingerprint === MISMATCHED_FINGERPRINT) {
							return undefined;
						}
						return new Error(
							`KLF-200 certificate fingerprint mismatch. Expected ${MISMATCHED_FINGERPRINT}, got ${cert.fingerprint ?? "<none>"}.`,
						);
					},
				};
				const conn = new Connection("localhost", connectionOptions);
				await expect(conn.loginAsync("velux123")).to.be.rejectedWith(/fingerprint mismatch/);
			});

			it("should connect and resolve when rejectUnauthorized is false and no custom checkServerIdentity (expired-cert scenario)", async function () {
				// Simulates the expired-factory-CA scenario: rejectUnauthorized: false is set but no
				// custom checkServerIdentity is provided.  The patch must accept the connection instead
				// of rejecting with CERT_HAS_EXPIRED because the caller has explicitly opted in to
				// accepting invalid/expired certificate chains.
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				await using mockServerController = await MockServerController.createMockServer();
				const baseOptions = MockServerController.getMockServerConnectionOptions();
				const connectionOptions = {
					...baseOptions,
					rejectUnauthorized: false as const,
					ca: undefined, // no CA → chain validation fails → authorized will be false
					checkServerIdentity: undefined,
				};
				const conn = new Connection("localhost", connectionOptions);
				await expect(conn.loginAsync("velux123")).to.be.fulfilled;
				await conn.logoutAsync();
			});
		});
	});
});
