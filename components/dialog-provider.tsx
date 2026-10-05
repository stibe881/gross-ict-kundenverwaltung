import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";

// App-eigene Dialoge im Design der App — ersetzen die Browser-Popups
// ("portal.gross-ict.ch enthält ...") auf der Web-Plattform.
// Native Plattformen nutzen weiterhin Alert.alert (System-Dialoge).

export interface DialogButton {
  text: string;
  style?: "default" | "cancel" | "destructive" | "primary";
  onPress?: () => void;
}

export interface DialogOptions {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let _show: ((opts: DialogOptions) => void) | null = null;
const _pending: DialogOptions[] = [];

export function showDialog(opts: DialogOptions) {
  if (_show) _show(opts);
  else _pending.push(opts);
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const [queue, setQueue] = useState<DialogOptions[]>([]);

  useEffect(() => {
    _show = (opts) => setQueue((q) => [...q, opts]);
    if (_pending.length) {
      const buffered = [..._pending];
      _pending.length = 0;
      setQueue((q) => [...q, ...buffered]);
    }
    return () => {
      _show = null;
    };
  }, []);

  const current = queue[0] || null;

  const closeWith = (btn?: DialogButton) => {
    setQueue((q) => q.slice(1));
    if (btn?.onPress) setTimeout(btn.onPress, 30);
  };

  const buttonStyles = (style?: DialogButton["style"]) => {
    switch (style) {
      case "destructive":
        return { bg: "#EF4444", border: "#EF4444", text: "#FFFFFF" };
      case "primary":
        return { bg: colors.primary, border: colors.primary, text: colors.background };
      case "cancel":
        return { bg: "transparent", border: colors.border, text: colors.muted };
      default:
        return { bg: colors.surface, border: colors.border, text: colors.foreground };
    }
  };

  // Primär-/Destruktiv-Button rechts, Abbrechen links
  const ordered = current
    ? [...current.buttons].sort((a, b) => (a.style === "cancel" ? -1 : 0) - (b.style === "cancel" ? -1 : 0))
    : [];
  const stacked = ordered.length > 2;

  return (
    <>
      {children}
      <Modal
        visible={!!current}
        transparent
        animationType="fade"
        onRequestClose={() => current && closeWith(ordered.find((b) => b.style === "cancel"))}
      >
        {current && (
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.6)",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                width: "100%",
                maxWidth: 420,
                padding: 22,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {current.title}
              </Text>
              {current.message ? (
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 10, lineHeight: 21 }}>
                  {current.message}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: stacked ? "column" : "row",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                {ordered.map((btn, idx) => {
                  const s = buttonStyles(btn.style);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={{
                        flex: stacked ? undefined : 1,
                        paddingVertical: 11,
                        borderRadius: 12,
                        alignItems: "center",
                        backgroundColor: s.bg,
                        borderWidth: 1,
                        borderColor: s.border,
                      }}
                      onPress={() => closeWith(btn)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: s.text }}>{btn.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </>
  );
}
