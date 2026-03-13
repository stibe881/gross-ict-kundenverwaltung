"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiCall = apiCall;
exports.exchangeOAuthCode = exchangeOAuthCode;
exports.logout = logout;
exports.getMe = getMe;
exports.establishSession = establishSession;
var react_native_1 = require("react-native");
var oauth_1 = require("@/constants/oauth");
var Auth = __importStar(require("./auth"));
function apiCall(endpoint_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, options) {
        var headers, sessionToken, baseUrl, cleanBaseUrl, cleanEndpoint, url, response, responseHeaders, setCookie, errorText, errorMessage, errorJson, contentType, data, text, error_1;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = __assign({ "Content-Type": "application/json" }, (options.headers || {}));
                    if (!(react_native_1.Platform.OS !== "web")) return [3 /*break*/, 2];
                    return [4 /*yield*/, Auth.getSessionToken()];
                case 1:
                    sessionToken = _a.sent();
                    console.log("[API] apiCall:", {
                        endpoint: endpoint,
                        hasToken: !!sessionToken,
                        method: options.method || "GET",
                    });
                    if (sessionToken) {
                        headers["Authorization"] = "Bearer ".concat(sessionToken);
                        console.log("[API] Authorization header added");
                    }
                    return [3 /*break*/, 3];
                case 2:
                    console.log("[API] apiCall:", { endpoint: endpoint, platform: "web", method: options.method || "GET" });
                    _a.label = 3;
                case 3:
                    baseUrl = (0, oauth_1.getApiBaseUrl)();
                    cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
                    cleanEndpoint = endpoint.startsWith("/") ? endpoint : "/".concat(endpoint);
                    url = baseUrl ? "".concat(cleanBaseUrl).concat(cleanEndpoint) : endpoint;
                    console.log("[API] Full URL:", url);
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 11, , 12]);
                    console.log("[API] Making request...");
                    return [4 /*yield*/, fetch(url, __assign(__assign({}, options), { headers: headers, credentials: "include" }))];
                case 5:
                    response = _a.sent();
                    console.log("[API] Response status:", response.status, response.statusText);
                    responseHeaders = Object.fromEntries(response.headers.entries());
                    console.log("[API] Response headers:", responseHeaders);
                    setCookie = response.headers.get("Set-Cookie");
                    if (setCookie) {
                        console.log("[API] Set-Cookie header received:", setCookie);
                    }
                    if (!!response.ok) return [3 /*break*/, 7];
                    return [4 /*yield*/, response.text()];
                case 6:
                    errorText = _a.sent();
                    console.error("[API] Error response:", errorText);
                    errorMessage = errorText;
                    try {
                        errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.error || errorJson.message || errorText;
                    }
                    catch (_b) {
                        // Not JSON, use text as is
                    }
                    throw new Error(errorMessage || "API call failed: ".concat(response.statusText));
                case 7:
                    contentType = response.headers.get("content-type");
                    if (!(contentType && contentType.includes("application/json"))) return [3 /*break*/, 9];
                    return [4 /*yield*/, response.json()];
                case 8:
                    data = _a.sent();
                    console.log("[API] JSON response received");
                    return [2 /*return*/, data];
                case 9: return [4 /*yield*/, response.text()];
                case 10:
                    text = _a.sent();
                    console.log("[API] Text response received");
                    return [2 /*return*/, (text ? JSON.parse(text) : {})];
                case 11:
                    error_1 = _a.sent();
                    console.error("[API] Request failed:", error_1);
                    if (error_1 instanceof Error) {
                        throw error_1;
                    }
                    throw new Error("Unknown error occurred");
                case 12: return [2 /*return*/];
            }
        });
    });
}
// OAuth callback handler - exchange code for session token
// Calls /api/oauth/mobile endpoint which returns JSON with app_session_id and user
function exchangeOAuthCode(code, state) {
    return __awaiter(this, void 0, void 0, function () {
        var params, endpoint, result, sessionToken;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[API] exchangeOAuthCode called");
                    params = new URLSearchParams({ code: code, state: state });
                    endpoint = "/api/oauth/mobile?".concat(params.toString());
                    console.log("[API] Calling OAuth mobile endpoint:", endpoint);
                    return [4 /*yield*/, apiCall(endpoint)];
                case 1:
                    result = _a.sent();
                    sessionToken = result.app_session_id;
                    console.log("[API] OAuth exchange result:", {
                        hasSessionToken: !!sessionToken,
                        hasUser: !!result.user,
                        sessionToken: sessionToken ? "".concat(sessionToken.substring(0, 50), "...") : null,
                    });
                    return [2 /*return*/, {
                            sessionToken: sessionToken,
                            user: result.user,
                        }];
            }
        });
    });
}
// Logout
function logout() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, apiCall("/api/auth/logout", {
                        method: "POST",
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Get current authenticated user (web uses cookie-based auth)
function getMe() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, apiCall("/api/auth/me")];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.user || null];
                case 2:
                    error_2 = _a.sent();
                    console.error("[API] getMe failed:", error_2);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Establish session cookie on the backend (3000-xxx domain)
// Called after receiving token via postMessage to get a proper Set-Cookie from the backend
function establishSession(token) {
    return __awaiter(this, void 0, void 0, function () {
        var baseUrl, url, response, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("[API] establishSession: setting cookie on backend...");
                    baseUrl = (0, oauth_1.getApiBaseUrl)();
                    url = "".concat(baseUrl, "/api/auth/session");
                    return [4 /*yield*/, fetch(url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: "Bearer ".concat(token),
                            },
                            credentials: "include", // Important: allows Set-Cookie to be stored
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        console.error("[API] establishSession failed:", response.status);
                        return [2 /*return*/, false];
                    }
                    console.log("[API] establishSession: cookie set successfully");
                    return [2 /*return*/, true];
                case 2:
                    error_3 = _a.sent();
                    console.error("[API] establishSession error:", error_3);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
