import { useState } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ── Frag dein CRM: Frage in natürlicher Sprache, KI antwortet auf Basis der CRM-Daten ──
export function AskCrmModal({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer("");
    try {
      const { data, error } = await supabase.functions.invoke("ask-crm", {
        body: { question: question.trim() },
      });
      if (error) throw new Error(error.message);
      setAnswer(data?.answer || "Keine Antwort erhalten.");
    } catch (e: any) {
      setAnswer(`Fehler: ${e.message || "Die Anfrage konnte nicht verarbeitet werden."}`);
    } finally {
      setAsking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconSymbol name="sparkles" size={18} color="#8B5CF6" />
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Frag dein CRM</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 18 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
              Beispiele: «Welche Kunden haben offene Rechnungen über 500 Franken?» · «Wie viele Tickets kamen diesen Monat rein?» · «Welche Verträge laufen bald ab?»
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                color: colors.foreground, fontSize: 15, minHeight: 60, textAlignVertical: "top",
              }}
              placeholder="Ihre Frage an das CRM..."
              placeholderTextColor={colors.muted}
              value={question}
              onChangeText={setQuestion}
              multiline
              editable={!asking}
            />
            <TouchableOpacity
              style={{
                backgroundColor: "#8B5CF6", paddingVertical: 12, borderRadius: 12,
                alignItems: "center", marginTop: 10, opacity: question.trim() && !asking ? 1 : 0.5,
              }}
              onPress={handleAsk}
              disabled={!question.trim() || asking}
              activeOpacity={0.8}
            >
              {asking ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={{ fontWeight: "700", color: "#FFF", fontSize: 15 }}>Antwort erhalten</Text>
              )}
            </TouchableOpacity>
            {asking ? (
              <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 10 }}>
                Die KI analysiert Ihre CRM-Daten – das dauert einige Sekunden...
              </Text>
            ) : null}
            {answer ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 14 }}>
                <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 21 }}>{answer}</Text>
              </View>
            ) : null}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
