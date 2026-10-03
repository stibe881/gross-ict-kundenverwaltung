import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useQueryClient } from "@tanstack/react-query";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency, getInvoiceTotal } from "@/lib/format";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

interface BankEntry {
  id: string;
  date?: string;
  amount: number;
  text: string;
}

interface MatchedEntry extends BankEntry {
  invoice?: any;
  matchType?: "number" | "amount";
  selected: boolean;
}

// camt.053-XML: Gutschriften (CRDT) aus den <Ntry>-Blöcken ziehen
function parseCamt(xml: string): BankEntry[] {
  const entries: BankEntry[] = [];
  const blocks = xml.match(/<Ntry>[\s\S]*?<\/Ntry>/g) || [];
  blocks.forEach((block, i) => {
    const indicator = block.match(/<CdtDbtInd>\s*(\w+)\s*<\/CdtDbtInd>/)?.[1];
    if (indicator !== "CRDT") return;
    const amount = parseFloat(block.match(/<Amt[^>]*>\s*([\d.]+)\s*<\/Amt>/)?.[1] || "0");
    if (!amount) return;
    const date = block.match(/<BookgDt>[\s\S]*?<Dt>\s*([\d-]+)\s*<\/Dt>/)?.[1];
    const texts: string[] = [];
    for (const m of block.matchAll(/<Ustrd>([\s\S]*?)<\/Ustrd>/g)) texts.push(m[1].trim());
    const addtl = block.match(/<AddtlNtryInf>([\s\S]*?)<\/AddtlNtryInf>/)?.[1];
    if (addtl) texts.push(addtl.trim());
    const dbtr = block.match(/<Dbtr>[\s\S]*?<Nm>([\s\S]*?)<\/Nm>/)?.[1];
    if (dbtr) texts.push(dbtr.trim());
    entries.push({ id: `camt-${i}`, date, amount, text: texts.join(" · ") || "(ohne Text)" });
  });
  return entries;
}

// CSV: pro Zeile den ersten positiven Betrag nehmen, Rest als Text
function parseCsv(csv: string): BankEntry[] {
  const entries: BankEntry[] = [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const delimiter = (lines[0]?.match(/;/g)?.length || 0) >= (lines[0]?.match(/,/g)?.length || 0) ? ";" : ",";
  lines.forEach((line, i) => {
    const cells = line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
    let amount = 0;
    for (const cell of cells) {
      const norm = cell.replace(/'/g, "").replace(",", ".");
      if (/^\d+(\.\d{1,2})?$/.test(norm)) {
        const v = parseFloat(norm);
        if (v > 0.05 && v < 1000000 && !/^\d{4}$/.test(cell)) { amount = v; break; }
      }
    }
    if (!amount) return;
    const date = cells.find((c) => /^\d{1,2}\.\d{1,2}\.\d{2,4}$|^\d{4}-\d{2}-\d{2}$/.test(c));
    entries.push({ id: `csv-${i}`, date, amount, text: line.substring(0, 160) });
  });
  return entries;
}

export function BankReconciliationModal({
  visible,
  onClose,
  unpaidInvoices,
}: {
  visible: boolean;
  onClose: () => void;
  unpaidInvoices: any[];
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<MatchedEntry[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const openRest = (inv: any) => Math.max(0, getInvoiceTotal(inv) - (inv.paid_amount || 0));

  const matchEntries = (raw: BankEntry[]): MatchedEntry[] => {
    return raw.map((e) => {
      // 1. Rechnungsnummer im Buchungstext
      const byNumber = unpaidInvoices.find(
        (inv) => inv.invoice_number && e.text.toLowerCase().includes(inv.invoice_number.toLowerCase()),
      );
      if (byNumber) return { ...e, invoice: byNumber, matchType: "number", selected: true };
      // 2. Eindeutiger Betrags-Match auf den offenen Rest
      const byAmount = unpaidInvoices.filter((inv) => Math.abs(openRest(inv) - e.amount) < 0.01);
      if (byAmount.length === 1) return { ...e, invoice: byAmount[0], matchType: "amount", selected: true };
      return { ...e, selected: false };
    });
  };

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      let content: string;
      if (Platform.OS === "web") {
        content = await (await fetch(asset.uri)).text();
      } else {
        content = await FileSystem.readAsStringAsync(asset.uri);
      }
      const raw = content.includes("<Ntry>") ? parseCamt(content) : parseCsv(content);
      if (raw.length === 0) {
        showAlert("Keine Gutschriften gefunden", "Die Datei enthält keine erkennbaren Zahlungseingänge (unterstützt: camt.053-XML und CSV).");
        return;
      }
      setFileName(asset.name || "Kontoauszug");
      setEntries(matchEntries(raw));
    } catch (e: any) {
      showAlert("Fehler", "Datei konnte nicht gelesen werden: " + e.message);
    }
  };

  const toggle = (id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id && e.invoice ? { ...e, selected: !e.selected } : e)));
  };

  const selectedCount = entries.filter((e) => e.selected && e.invoice).length;

  const handleBook = async () => {
    setBooking(true);
    let booked = 0;
    try {
      for (const e of entries) {
        if (!e.selected || !e.invoice) continue;
        const amount = Math.min(e.amount, openRest(e.invoice));
        if (amount <= 0) continue;
        await Data.addPayment(e.invoice.id, amount, "Bankabgleich");
        booked++;
      }
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showToast(`${booked} Zahlung(en) verbucht`);
      setEntries([]);
      setFileName(null);
      onClose();
    } catch (e: any) {
      showAlert("Fehler", "Verbuchung fehlgeschlagen: " + e.message);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } finally {
      setBooking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View>
              <Text className="text-xl font-bold text-foreground">Bankabgleich</Text>
              <Text className="text-xs text-muted mt-0.5">Kontoauszug (camt.053 oder CSV) einlesen</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 bg-surface border border-dashed border-border py-4 rounded-xl mb-4"
              onPress={handlePickFile}
              activeOpacity={0.7}
            >
              <IconSymbol name="doc.badge.plus" size={18} color={colors.primary} />
              <Text className="font-semibold" style={{ color: colors.primary }}>
                {fileName ? `${fileName} – andere Datei wählen` : "Kontoauszug auswählen"}
              </Text>
            </TouchableOpacity>

            {entries.length > 0 && (
              <>
                <Text className="text-xs font-bold text-muted uppercase mb-2" style={{ letterSpacing: 1 }}>
                  {entries.length} Gutschriften · {selectedCount} zugeordnet
                </Text>
                <View className="bg-surface rounded-xl border border-border overflow-hidden mb-4">
                  {entries.map((e, idx) => (
                    <TouchableOpacity
                      key={e.id}
                      className="flex-row items-center px-3 py-3 gap-3"
                      style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border, opacity: e.invoice ? 1 : 0.5 }}
                      onPress={() => toggle(e.id)}
                      activeOpacity={e.invoice ? 0.7 : 1}
                    >
                      <View
                        style={{
                          width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                          borderColor: e.selected ? "#22C55E" : colors.border,
                          backgroundColor: e.selected ? "#22C55E" : "transparent",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {e.selected && <IconSymbol name="checkmark" size={12} color="#fff" />}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm font-bold text-foreground">{formatCurrency(e.amount)}</Text>
                          <Text className="text-[11px] text-muted">{e.date || ""}</Text>
                        </View>
                        <Text className="text-[11px] text-muted" numberOfLines={1}>{e.text}</Text>
                        {e.invoice ? (
                          <Text className="text-[11px] font-semibold mt-0.5" style={{ color: e.matchType === "number" ? "#22C55E" : "#F59E0B" }}>
                            → {e.invoice.invoice_number}
                            {e.matchType === "amount" ? " (Betrags-Übereinstimmung – bitte prüfen)" : ""}
                          </Text>
                        ) : (
                          <Text className="text-[11px] text-muted mt-0.5">Keine offene Rechnung zugeordnet</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <View style={{ height: 12 }} />
          </ScrollView>

          <View className="p-4 border-t border-border">
            <TouchableOpacity
              className={`py-3.5 rounded-xl items-center ${selectedCount > 0 && !booking ? "bg-primary" : "bg-muted"}`}
              onPress={handleBook}
              disabled={selectedCount === 0 || booking}
              activeOpacity={0.8}
            >
              {booking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background font-bold">
                  {selectedCount > 0 ? `${selectedCount} Zahlung(en) verbuchen` : "Keine Zahlungen ausgewählt"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
