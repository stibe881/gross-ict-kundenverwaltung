// Generischer CSV-Export für Listen (Web: Download, Nativ: Teilen-Dialog)
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

export interface CsvColumn {
    key: string;
    label: string;
    map?: (row: any) => any;
}

function csvEscape(value: any): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

export function toCsv(rows: any[], columns: CsvColumn[]): string {
    const header = columns.map((c) => csvEscape(c.label)).join(";");
    const lines = rows.map((row) =>
        columns.map((c) => csvEscape(c.map ? c.map(row) : row[c.key])).join(";")
    );
    // BOM, damit Excel Umlaute korrekt anzeigt
    return "﻿" + [header, ...lines].join("\r\n");
}

export async function exportCsv(filename: string, rows: any[], columns: CsvColumn[]) {
    const csv = toCsv(rows, columns);

    if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }

    const fileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: filename,
    });
}
