import React from "react";
import { type ConfigGenericProps } from "@iobroker/json-config";
export interface ConfigurationData {
    host: string;
    password: string;
    advancedSSLConfiguration?: boolean;
    SSLFingerprint?: string;
    SSLPublicKey?: string;
}
export interface ConnectionTestComponentProps extends ConfigGenericProps {
    data: ConfigurationData;
}
export interface ConnectionTestMessage {
    /** The command for the connection test message. */
    command: "ConnectionTest";
    /** The hostname to connect to. */
    hostname: string;
    /** The password to use for logging in. */
    password: string;
    /** The advanced SSL configuration. */
    advancedSSLConfiguration?: {
        sslFingerprint?: string;
        sslPublicKey?: string;
    };
}
declare const ConnectionTestComponent: React.FC<ConnectionTestComponentProps>;
export default ConnectionTestComponent;
