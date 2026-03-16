import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { View, Text, Animated, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

// Global event system for showing toasts from anywhere
type ToastListener = (text: string, type: ToastType) => void;
let _listener: ToastListener | null = null;
let _nextId = 0;

/**
 * Show a non-blocking toast notification at the top of the screen.
 * Can be called from anywhere (no hook needed).
 */
export function showToast(text: string, type: ToastType = "success") {
  if (_listener) {
    _listener(text, type);
  } else if (Platform.OS === "web") {
    // Fallback: show a brief overlay div
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `
      position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;
      background:${type === "error" ? "#ef4444" : type === "info" ? "#3b82f6" : "#22c55e"};
      color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      animation:toast-in 0.3s ease;
    `;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s";
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }
}

function ToastItem({ text, type, onDone }: { text: string; type: ToastType; onDone: () => void }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -30, duration: 250, useNativeDriver: true }),
      ]).start(() => onDone());
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const bgColor = type === "error" ? "#ef4444" : type === "info" ? "#3b82f6" : "#22c55e";
  const icon = type === "error" ? "✕" : type === "info" ? "ℹ" : "✓";

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: bgColor,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

/**
 * Place <ToastProvider> at the root of your app (in _layout.tsx).
 * Provides the target for showToast() calls.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    _listener = (text: string, type: ToastType) => {
      const id = ++_nextId;
      setToasts((prev) => [...prev, { id, text, type }]);
    };
    return () => { _listener = null; };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} text={t.text} type={t.type} onDone={() => removeToast(t.id)} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 16,
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: "center",
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 500,
    width: "100%",
  },
  icon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginRight: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
});
