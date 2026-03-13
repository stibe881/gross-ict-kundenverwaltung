"use strict";
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
exports.getSessionToken = getSessionToken;
exports.setSessionToken = setSessionToken;
exports.removeSessionToken = removeSessionToken;
exports.getUserInfo = getUserInfo;
exports.setUserInfo = setUserInfo;
exports.clearUserInfo = clearUserInfo;
var SecureStore = __importStar(require("expo-secure-store"));
var react_native_1 = require("react-native");
var oauth_1 = require("@/constants/oauth");
function getSessionToken() {
    return __awaiter(this, void 0, void 0, function () {
        var token, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    // Web platform uses cookie-based auth, no manual token management needed
                    if (react_native_1.Platform.OS === "web") {
                        console.log("[Auth] Web platform uses cookie-based auth, skipping token retrieval");
                        return [2 /*return*/, null];
                    }
                    // Use SecureStore for native
                    console.log("[Auth] Getting session token...");
                    return [4 /*yield*/, SecureStore.getItemAsync(oauth_1.SESSION_TOKEN_KEY)];
                case 1:
                    token = _a.sent();
                    console.log("[Auth] Session token retrieved from SecureStore:", token ? "present (".concat(token.substring(0, 20), "...)") : "missing");
                    return [2 /*return*/, token];
                case 2:
                    error_1 = _a.sent();
                    console.error("[Auth] Failed to get session token:", error_1);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function setSessionToken(token) {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    // Web platform uses cookie-based auth, no manual token management needed
                    if (react_native_1.Platform.OS === "web") {
                        console.log("[Auth] Web platform uses cookie-based auth, skipping token storage");
                        return [2 /*return*/];
                    }
                    // Use SecureStore for native
                    console.log("[Auth] Setting session token...", token.substring(0, 20) + "...");
                    return [4 /*yield*/, SecureStore.setItemAsync(oauth_1.SESSION_TOKEN_KEY, token)];
                case 1:
                    _a.sent();
                    console.log("[Auth] Session token stored in SecureStore successfully");
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error("[Auth] Failed to set session token:", error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function removeSessionToken() {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    // Web platform uses cookie-based auth, logout is handled by server clearing cookie
                    if (react_native_1.Platform.OS === "web") {
                        console.log("[Auth] Web platform uses cookie-based auth, skipping token removal");
                        return [2 /*return*/];
                    }
                    // Use SecureStore for native
                    console.log("[Auth] Removing session token...");
                    return [4 /*yield*/, SecureStore.deleteItemAsync(oauth_1.SESSION_TOKEN_KEY)];
                case 1:
                    _a.sent();
                    console.log("[Auth] Session token removed from SecureStore successfully");
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error("[Auth] Failed to remove session token:", error_3);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getUserInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var info, user, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    console.log("[Auth] Getting user info...");
                    info = null;
                    if (!(react_native_1.Platform.OS === "web")) return [3 /*break*/, 1];
                    // Use localStorage for web
                    info = window.localStorage.getItem(oauth_1.USER_INFO_KEY);
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, SecureStore.getItemAsync(oauth_1.USER_INFO_KEY)];
                case 2:
                    // Use SecureStore for native
                    info = _a.sent();
                    _a.label = 3;
                case 3:
                    if (!info) {
                        console.log("[Auth] No user info found");
                        return [2 /*return*/, null];
                    }
                    user = JSON.parse(info);
                    console.log("[Auth] User info retrieved:", user);
                    return [2 /*return*/, user];
                case 4:
                    error_4 = _a.sent();
                    console.error("[Auth] Failed to get user info:", error_4);
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function setUserInfo(user) {
    return __awaiter(this, void 0, void 0, function () {
        var error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("[Auth] Setting user info...", user);
                    if (react_native_1.Platform.OS === "web") {
                        // Use localStorage for web
                        window.localStorage.setItem(oauth_1.USER_INFO_KEY, JSON.stringify(user));
                        console.log("[Auth] User info stored in localStorage successfully");
                        return [2 /*return*/];
                    }
                    // Use SecureStore for native
                    return [4 /*yield*/, SecureStore.setItemAsync(oauth_1.USER_INFO_KEY, JSON.stringify(user))];
                case 1:
                    // Use SecureStore for native
                    _a.sent();
                    console.log("[Auth] User info stored in SecureStore successfully");
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    console.error("[Auth] Failed to set user info:", error_5);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function clearUserInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (react_native_1.Platform.OS === "web") {
                        // Use localStorage for web
                        window.localStorage.removeItem(oauth_1.USER_INFO_KEY);
                        return [2 /*return*/];
                    }
                    // Use SecureStore for native
                    return [4 /*yield*/, SecureStore.deleteItemAsync(oauth_1.USER_INFO_KEY)];
                case 1:
                    // Use SecureStore for native
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_6 = _a.sent();
                    console.error("[Auth] Failed to clear user info:", error_6);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
