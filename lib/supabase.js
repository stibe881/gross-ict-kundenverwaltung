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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
var async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
var react_native_1 = require("react-native");
var supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[Supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY not set.");
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
    auth: __assign(__assign({}, (react_native_1.Platform.OS !== "web" ? {
        storage: async_storage_1.default,
    } : {})), { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }),
});
