import { Modal, ScrollView, Text, TouchableOpacity, View, Platform } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency } from "@/lib/format";

interface InvoicePreviewModalProps {
    visible: boolean;
    onClose: () => void;
    invoice: any;
}

export function InvoicePreviewModal({
    visible,
    onClose,
    invoice,
}: InvoicePreviewModalProps) {
    const colors = useColors();

    if (!invoice) return null;

    const handlePrint = () => {
        if (Platform.OS === 'web') {
            window.print();
        } else {
            // Native print logic would go here (e.g. expo-print)
            alert("Drucken auf Mobilgeräten wird später implementiert.");
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end sm:justify-center sm:p-8">
                <View className="bg-background flex-1 sm:rounded-2xl sm:flex-none sm:h-[90%] sm:max-w-4xl mx-auto w-full">
                    {/* Header / Actions */}
                    <View className="flex-row items-center justify-between p-4 border-b border-border bg-surface sm:rounded-t-2xl no-print">
                        <Text className="text-lg font-bold text-foreground">Rechnungsvorschau</Text>
                        <View className="flex-row gap-2">
                            <TouchableOpacity
                                onPress={handlePrint}
                                className="bg-primary px-4 py-2 rounded-lg flex-row items-center"
                            >
                                <IconSymbol name="printer.fill" size={20} color="#FFFFFF" />
                                <Text className="text-white font-semibold ml-2">Drucken / PDF</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} className="bg-muted/10 p-2 rounded-full">
                                <IconSymbol name="xmark" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Invoice Content (A4-ish look) */}
                    <ScrollView className="flex-1 bg-muted/5 p-4 sm:p-8">
                        <View className="bg-white p-8 shadow-sm min-h-[800px] text-black">
                            {/* Header Row */}
                            <View className="flex-row justify-between mb-12">
                                <View>
                                    <Text className="text-2xl font-bold text-black mb-2">Ihre Firma GmbH</Text>
                                    <Text className="text-gray-500">Musterstraße 123</Text>
                                    <Text className="text-gray-500">8000 Zürich</Text>
                                    <Text className="text-gray-500">Schweiz</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-xl font-semibold text-black mb-4">RECHNUNG</Text>
                                    <Text className="text-gray-600">Nr. {invoice.invoiceNumber || "ENTWURF"}</Text>
                                    <Text className="text-gray-600">Datum: {new Date(invoice.invoiceDate).toLocaleDateString("de-CH")}</Text>
                                </View>
                            </View>

                            {/* Bill To */}
                            <View className="mb-12">
                                <Text className="text-gray-500 mb-2 uppercase text-xs tracking-wider">Rechnungsempfänger</Text>
                                {/* Here we would normally fetch customer details. For now showing placeholder if missing */}
                                <Text className="text-lg font-bold text-black">{invoice.customerName || `Kunde ${invoice.customerId}`}</Text>
                                {invoice.customerCompany && <Text className="text-black">{invoice.customerCompany}</Text>}
                                <Text className="text-black">Musteradresse 123</Text>
                                <Text className="text-black">8000 Zürich</Text>
                            </View>

                            {/* Positions Table */}
                            <View className="mb-8">
                                <View className="flex-row border-b-2 border-gray-200 pb-2 mb-4">
                                    <Text className="flex-[3] font-bold text-gray-700">Beschreibung</Text>
                                    <Text className="flex-1 font-bold text-gray-700 text-right">Menge</Text>
                                    <Text className="flex-1 font-bold text-gray-700 text-right">Preis</Text>
                                    <Text className="flex-1 font-bold text-gray-700 text-right">Betrag</Text>
                                </View>

                                {invoice.positions?.map((pos: any, index: number) => (
                                    <View key={index} className="flex-row border-b border-gray-100 py-3">
                                        <Text className="flex-[3] text-black">{pos.description}</Text>
                                        <Text className="flex-1 text-black text-right">{pos.quantity}</Text>
                                        <Text className="flex-1 text-black text-right">{formatCurrency(pos.unitPrice)}</Text>
                                        <Text className="flex-1 text-black text-right font-medium">{formatCurrency(pos.total)}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Totals */}
                            <View className="items-end mt-8">
                                <View className="w-64">
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">Zwischensumme:</Text>
                                        <Text className="text-black font-medium">{formatCurrency(invoice.totalNet)}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2 pb-4 border-b border-gray-200">
                                        <Text className="text-gray-600">MwSt (8.1%):</Text>
                                        <Text className="text-black font-medium">{formatCurrency(invoice.totalTax)}</Text>
                                    </View>
                                    <View className="flex-row justify-between pt-2">
                                        <Text className="text-xl font-bold text-black">Gesamtsumme:</Text>
                                        <Text className="text-xl font-bold text-black">{formatCurrency(invoice.totalGross)}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Footer */}
                            <View className="mt-auto pt-16 border-t border-gray-100">
                                <Text className="text-gray-500 text-sm text-center">
                                    Vielen Dank für Ihren Auftrag! Zahlbar innerhalb von 30 Tagen.
                                </Text>
                                <View className="flex-row justify-center gap-8 mt-4">
                                    <Text className="text-gray-400 text-xs">IBAN: CH93 0000 0000 0000 0000 0</Text>
                                    <Text className="text-gray-400 text-xs">MWST-Nr: CHE-123.456.789</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
