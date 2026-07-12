// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import assert from "node:assert";
import * as fs from "fs/promises";
import {
	CommandStatus,
	Connection,
	DiscoverStatus,
	type Disposable,
	Gateway,
	GatewayCommand,
	type Group,
	Groups,
	GroupType,
	type GW_ACTIVATE_PRODUCTGROUP_CFM,
	type GW_ACTIVATE_PRODUCTGROUP_REQ,
	type GW_ACTIVATE_SCENE_CFM,
	type GW_ACTIVATE_SCENE_REQ,
	type GW_CLEAR_ACTIVATION_LOG_CFM,
	type GW_CLEAR_ACTIVATION_LOG_REQ,
	type GW_COMMAND_SEND_CFM,
	type GW_COMMAND_SEND_REQ,
	GW_COMMON_STATUS,
	type GW_CS_ACTIVATE_CONFIGURATION_MODE_CFM,
	type GW_CS_ACTIVATE_CONFIGURATION_MODE_REQ,
	type GW_CS_CONTROLLER_COPY_CFM,
	type GW_CS_CONTROLLER_COPY_REQ,
	type GW_CS_DISCOVER_NODES_CFM,
	type GW_CS_DISCOVER_NODES_NTF,
	GW_CS_DISCOVER_NODES_REQ,
	type GW_CS_GENERATE_NEW_KEY_CFM,
	type GW_CS_GENERATE_NEW_KEY_REQ,
	type GW_CS_GET_SYSTEMTABLE_DATA_CFM,
	type GW_CS_GET_SYSTEMTABLE_DATA_REQ,
	type GW_CS_RECEIVE_KEY_CFM,
	type GW_CS_RECEIVE_KEY_REQ,
	type GW_CS_REMOVE_NODES_CFM,
	GW_CS_REMOVE_NODES_REQ,
	type GW_CS_REPAIR_KEY_CFM,
	type GW_CS_REPAIR_KEY_REQ,
	type GW_CS_VIRGIN_STATE_CFM,
	type GW_CS_VIRGIN_STATE_REQ,
	type GW_DELETE_GROUP_CFM,
	GW_DELETE_GROUP_REQ,
	type GW_DELETE_SCENE_CFM,
	GW_DELETE_SCENE_REQ,
	type GW_GET_ACTIVATION_LOG_HEADER_CFM,
	type GW_GET_ACTIVATION_LOG_HEADER_REQ,
	type GW_GET_ACTIVATION_LOG_LINE_CFM,
	type GW_GET_ACTIVATION_LOG_LINE_REQ,
	type GW_GET_ALL_GROUPS_INFORMATION_CFM,
	type GW_GET_ALL_GROUPS_INFORMATION_REQ,
	type GW_GET_ALL_NODES_INFORMATION_CFM,
	type GW_GET_ALL_NODES_INFORMATION_REQ,
	type GW_GET_CONTACT_INPUT_LINK_LIST_CFM,
	type GW_GET_CONTACT_INPUT_LINK_LIST_REQ,
	type GW_GET_GROUP_INFORMATION_CFM,
	type GW_GET_GROUP_INFORMATION_REQ,
	type GW_GET_LIMITATION_STATUS_CFM,
	type GW_GET_LIMITATION_STATUS_REQ,
	type GW_GET_LOCAL_TIME_CFM,
	type GW_GET_LOCAL_TIME_REQ,
	type GW_GET_MULTIPLE_ACTIVATION_LOG_LINES_CFM,
	type GW_GET_MULTIPLE_ACTIVATION_LOG_LINES_REQ,
	type GW_GET_NETWORK_SETUP_CFM,
	type GW_GET_NETWORK_SETUP_REQ,
	type GW_GET_NODE_INFORMATION_CFM,
	type GW_GET_NODE_INFORMATION_REQ,
	type GW_GET_PROTOCOL_VERSION_CFM,
	type GW_GET_PROTOCOL_VERSION_REQ,
	type GW_GET_SCENE_INFORMATION_CFM,
	type GW_GET_SCENE_INFORMATION_REQ,
	type GW_GET_SCENE_LIST_CFM,
	type GW_GET_SCENE_LIST_REQ,
	GW_GET_STATE_CFM,
	type GW_GET_STATE_REQ,
	type GW_GET_VERSION_CFM,
	type GW_GET_VERSION_REQ,
	type GW_HOUSE_STATUS_MONITOR_DISABLE_CFM,
	type GW_HOUSE_STATUS_MONITOR_DISABLE_REQ,
	type GW_HOUSE_STATUS_MONITOR_ENABLE_CFM,
	type GW_HOUSE_STATUS_MONITOR_ENABLE_REQ,
	type GW_INITIALIZE_SCENE_CANCEL_CFM,
	GW_INITIALIZE_SCENE_CANCEL_REQ,
	type GW_INITIALIZE_SCENE_CFM,
	type GW_INITIALIZE_SCENE_NTF,
	GW_INITIALIZE_SCENE_REQ,
	type GW_LEAVE_LEARN_STATE_CFM,
	type GW_LEAVE_LEARN_STATE_REQ,
	type GW_MODE_SEND_CFM,
	type GW_MODE_SEND_REQ,
	type GW_NEW_GROUP_CFM,
	GW_NEW_GROUP_REQ,
	type GW_PASSWORD_CHANGE_CFM,
	type GW_PASSWORD_CHANGE_REQ,
	type GW_PASSWORD_ENTER_CFM,
	type GW_PASSWORD_ENTER_REQ,
	GW_REBOOT_CFM,
	type GW_REBOOT_REQ,
	type GW_RECORD_SCENE_CFM,
	type GW_RECORD_SCENE_NTF,
	GW_RECORD_SCENE_REQ,
	type GW_REMOVE_CONTACT_INPUT_LINK_CFM,
	type GW_REMOVE_CONTACT_INPUT_LINK_REQ,
	type GW_RENAME_SCENE_CFM,
	GW_RENAME_SCENE_REQ,
	type GW_RTC_SET_TIME_ZONE_CFM,
	type GW_RTC_SET_TIME_ZONE_REQ,
	GW_SESSION_FINISHED_NTF,
	type GW_SET_CONTACT_INPUT_LINK_CFM,
	type GW_SET_CONTACT_INPUT_LINK_REQ,
	type GW_SET_FACTORY_DEFAULT_CFM,
	type GW_SET_FACTORY_DEFAULT_REQ,
	type GW_SET_GROUP_INFORMATION_CFM,
	type GW_SET_GROUP_INFORMATION_REQ,
	type GW_SET_LIMITATION_CFM,
	type GW_SET_LIMITATION_REQ,
	type GW_SET_NETWORK_SETUP_CFM,
	type GW_SET_NETWORK_SETUP_REQ,
	type GW_SET_NODE_NAME_CFM,
	type GW_SET_NODE_NAME_REQ,
	type GW_SET_NODE_ORDER_AND_PLACEMENT_CFM,
	type GW_SET_NODE_ORDER_AND_PLACEMENT_REQ,
	type GW_SET_NODE_VARIATION_CFM,
	type GW_SET_NODE_VARIATION_REQ,
	type GW_SET_UTC_CFM,
	type GW_SET_UTC_REQ,
	type GW_STATUS_REQUEST_CFM,
	GW_STATUS_REQUEST_NTF,
	GW_STATUS_REQUEST_REQ,
	type GW_STOP_SCENE_CFM,
	type GW_STOP_SCENE_REQ,
	type GW_WINK_SEND_CFM,
	type GW_WINK_SEND_REQ,
	type IConnection,
	type IGW_FRAME,
	type IGW_FRAME_RCV,
	type IGW_FRAME_REQ,
	InitializeSceneConfirmationStatus,
	InitializeSceneNotificationStatus,
	LimitationType,
	type NodeVariation,
	ParameterActive,
	type Product,
	Products,
	RecordSceneStatus,
	RenameSceneStatus,
	type Scene,
	Scenes,
	StatusType,
	type Velocity,
} from "klf-200-api";
import { type Job, scheduleJob } from "node-schedule";
import path from "node:path";
import { env } from "node:process";
import { timeout } from "promise-timeout";
import { checkServerIdentity as checkServerIdentityOriginal, type ConnectionOptions } from "node:tls";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ConnectionTest, ConnectionTestResult } from "./connectionTest.js";
import { KLF200DeviceManagement } from "./deviceManagement/klf200DeviceManagement.js";
import { DisposalMap } from "./disposalMap.js";
import type { HasConnectionInterface, HasProductsInterface } from "./interfaces.js";
import type { ConnectionTestMessage } from "./messages/connectionTestMessage.js";
import { Setup } from "./setup.js";
import { SetupGroups } from "./setupGroups.js";
import { SetupProducts } from "./setupProducts.js";
import { SetupScenes } from "./setupScenes.js";
import type { Translate } from "./translate.js";
import { StateHelper } from "./util/stateHelper.js";
import { ArrayCount, convertErrorToString, waitForSessionFinishedNtfAsync } from "./util/utils.js";

// Load your modules here, e.g.:
// import * as fs from "node:fs";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace ioBroker {
		interface AdapterConfig {
			// Define the shape of your options here (recommended)
			host: string;
			password: string;
			enableAutomaticReboot: boolean;
			automaticRebootCronTime: string;
			advancedSSLConfiguration: boolean;
			SSLPublicKey: string;
			SSLFingerprint: string;
			SSLConnectionOptions: ConnectionOptions;
			// Or use a catch-all approach
			// [key: string]: any;
		}
	}
}

const KLF200_FINGERPRINT = "02:8C:23:A0:89:2B:62:98:C4:99:00:5B:D2:E7:2E:0A:70:3D:71:6A";

type ConnectionWatchDogHandler = (hadError: boolean) => void;

const refreshTimeoutMS = 120_000; // Wait max. 2 minutes for the notification.

type ResponsiveProductResult = {
	NodeID: number;
	FPs: number[];
};

// ... keep everything else unchanged until createConnectionOptions()

	private createConnectionOptions(data: ConnectionTestMessage): ConnectionOptions {
		const configuredFingerprint = data.advancedSSLConfiguration?.sslFingerprint?.trim();
		const klf200Fingerprint = configuredFingerprint && configuredFingerprint.length > 0 ? configuredFingerprint : KLF200_FINGERPRINT;
		const klf200Connection = new Connection(
			data.hostname,
			data.advancedSSLConfiguration?.sslPublicKey !== undefined
				? Buffer.from(data.advancedSSLConfiguration?.sslPublicKey)
				: undefined,
			klf200Fingerprint,
		);

		return {
			rejectUnauthorized: false,
			ca: klf200Connection.CA,
			checkServerIdentity: (_host, cert) => {
				if (cert.fingerprint === klf200Connection.fingerprint) {
					return undefined;
				}
				return new Error(
					`KLF-200 certificate fingerprint mismatch. Expected ${klf200Connection.fingerprint}, got ${cert.fingerprint}.`,
				);
			},
		};
	}

// ... keep everything else unchanged