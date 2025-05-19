import { EventEmitter } from "node:events";
import { createSigner } from "fast-jwt";
import { Pool } from "undici";
import { ApnsError, Errors } from "./errors.js";
import { Priority } from "./notifications/notification.js";
// APNS version
const API_VERSION = 3;
// Signing algorithm for JSON web token
const SIGNING_ALGORITHM = "ES256";
// Reset our signing token every 55 minutes as reccomended by Apple
const RESET_TOKEN_INTERVAL_MS = 55 * 60 * 1000;
// Only keep our connections open for just over one hour, as a temporary workaround for not supporting PING frames
const CLIENT_TTL_MS = 61 * 60 * 1000;
export var Host;
(function (Host) {
    Host["production"] = "api.push.apple.com";
    Host["development"] = "api.sandbox.push.apple.com";
})(Host || (Host = {}));
export class ApnsClient extends EventEmitter {
    team;
    keyId;
    host;
    signingKey;
    defaultTopic;
    keepAlive;
    client;
    _token;
    constructor(options) {
        super();
        this.team = options.team;
        this.keyId = options.keyId;
        this.signingKey = options.signingKey;
        this.defaultTopic = options.defaultTopic;
        this.host = options.host ?? Host.production;
        this.keepAlive = options.keepAlive ?? true;
        this.client = new Pool(`https://${this.host}:443`, {
            connections: this.keepAlive ? 32 : 1,
            pipelining: this.keepAlive ? 1 : 0,
            allowH2: true,
            maxConcurrentStreams: 100,
            clientTtl: this.keepAlive ? CLIENT_TTL_MS : 1,
        });
        this._token = null;
        this._supressH2Warning();
    }
    sendMany(notifications) {
        const promises = notifications.map((notification) => this.send(notification).catch((error) => ({ error })));
        return Promise.all(promises);
    }
    async send(notification) {
        const headers = {
            authorization: `bearer ${this._getSigningToken()}`,
            "apns-push-type": notification.pushType,
            "apns-topic": notification.options.topic ?? this.defaultTopic,
        };
        if (notification.priority !== Priority.immediate) {
            headers["apns-priority"] = notification.priority.toString();
        }
        const expiration = notification.options.expiration;
        if (typeof expiration !== "undefined") {
            headers["apns-expiration"] =
                typeof expiration === "number"
                    ? expiration.toFixed(0)
                    : (expiration.getTime() / 1000).toFixed(0);
        }
        if (notification.options.collapseId) {
            headers["apns-collapse-id"] = notification.options.collapseId;
        }
        const res = await this.client.request({
            path: `/${API_VERSION}/device/${encodeURIComponent(notification.deviceToken)}`,
            method: "POST",
            headers: headers,
            body: JSON.stringify(notification.buildApnsOptions()),
            idempotent: true,
            blocking: false,
        });
        return this._handleServerResponse(res, notification);
    }
    async _handleServerResponse(res, notification) {
        if (res.statusCode === 200) {
            return notification;
        }
        const responseError = await res.body.json().catch(() => ({
            reason: Errors.unknownError,
            timestamp: Date.now(),
        }));
        const error = new ApnsError({
            statusCode: res.statusCode,
            notification: notification,
            response: responseError,
        });
        // Reset signing token if expired
        if (error.reason === Errors.expiredProviderToken) {
            this._token = null;
        }
        // Emit specific and generic errors
        this.emit(error.reason, error);
        this.emit(Errors.error, error);
        throw error;
    }
    _getSigningToken() {
        if (this._token && Date.now() - this._token.timestamp < RESET_TOKEN_INTERVAL_MS) {
            return this._token.value;
        }
        const claims = {
            iss: this.team,
            iat: Math.floor(Date.now() / 1000),
        };
        const signer = createSigner({
            key: this.signingKey,
            algorithm: SIGNING_ALGORITHM,
            kid: this.keyId,
        });
        const token = signer(claims);
        this._token = {
            value: token,
            timestamp: Date.now(),
        };
        return token;
    }
    _supressH2Warning() {
        process.once("warning", (warning) => {
            if (warning.code === "UNDICI-H2") {
                return;
            }
            process.emit("warning", warning);
        });
    }
}
