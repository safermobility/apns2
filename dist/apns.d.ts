import { EventEmitter } from "node:events";
import { type PrivateKey } from "fast-jwt";
import { Pool } from "undici";
import { ApnsError } from "./errors.js";
import { type Notification } from "./notifications/notification.js";
export declare enum Host {
    production = "api.push.apple.com",
    development = "api.sandbox.push.apple.com"
}
export interface SigningToken {
    value: string;
    timestamp: number;
}
export interface ApnsOptions {
    team: string;
    signingKey: string | Buffer | PrivateKey;
    keyId: string;
    defaultTopic?: string;
    host?: Host | string;
    requestTimeout?: number;
    keepAlive?: boolean;
}
export declare class ApnsClient extends EventEmitter {
    readonly team: string;
    readonly keyId: string;
    readonly host: Host | string;
    readonly signingKey: string | Buffer | PrivateKey;
    readonly defaultTopic?: string;
    readonly keepAlive: boolean;
    readonly client: Pool;
    private _token;
    constructor(options: ApnsOptions);
    sendMany(notifications: Notification[]): Promise<(Notification | {
        error: ApnsError;
    })[]>;
    send(notification: Notification): Promise<Notification>;
    private _handleServerResponse;
    private _getSigningToken;
    private _supressH2Warning;
}
