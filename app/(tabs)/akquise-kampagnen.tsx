import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Platform, Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import * as Akq from "@/lib/akquise";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

type Farben = ReturnType<typeof useColors>;

const STATUS_LABEL: Record<Akq.ProspectStatus, string> = {
  neu: "Neu",
  geprueft: "Geprüft",
  freigegeben: "Freigegeben",
  uebernommen: "Als Lead übernommen",
  verworfen: "Verworfen",
};

const KAMPAGNEN_STATUS: Akq.Campaign["status"][] = ["entwurf", "aktiv", "pausiert", "abgeschlossen"];

function komma(text: string): string[] {
  return text.split(",").map((t) => t.trim()).filter(Boolean);
}

export default function AkquiseKampagnenScreen() {
  const colors = useColors();
  const { containerStyle } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  const [offen, setOffen] = useState<string | null>(null); // geöffnete Kampagne
  const [formOffen, setFormOffen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<Akq.Campaign | null>(null);

  useEffect(() => {
    Data.supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { data: kampagnen = [], isLoading } = useQuery({ queryKey: ["akqKampagnen"], queryFn: Akq.getCampaigns });
  const aktuelle = kampagnen.find((k) => k.id === offen) || null;

  const neuLaden = () => queryClient.invalidateQueries({ queryKey: ["akqKampagnen"] });

  return (
    <ScreenContainer>
      <ScrollView style={containerStyle} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {aktuelle ? (
          <KampagnenDetail
            kampagne={aktuelle}
            colors={colors}
            userId={userId}
            onZurueck={() => setOffen(null)}
            onBearbeiten={() => { setBearbeiten(aktuelle); setFormOffen(true); }}
          />
        ) : (
          <>
            <BackButton to="/leads" />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>Kampagnen</Text>
              <Knopf colors={colors} text="+ Neu" onPress={() => { setBearbeiten(null); setFormOffen(true); }} />
            </View>
            <Text style={{ fontSize: 13.5, color: colors.muted, marginBottom: 16 }}>
              Firmen werden zuerst als Prospect recherchiert und geprüft — erst nach der Freigabe werden sie als Lead ins CRM übernommen.
            </Text>
          </>
        )}

        {formOffen && (
          <KampagnenFormular
            colors={colors}
            kampagne={bearbeiten}
            onFertig={() => { setFormOffen(false); setBearbeiten(null); neuLaden(); }}
            onAbbrechen={() => { setFormOffen(false); setBearbeiten(null); }}
          />
        )}

        {!aktuelle && (isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : kampagnen.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30 }}>
            Noch keine Kampagne. Legen Sie mit «+ Neu» die erste an, z.B. «Websites für Sanitärbetriebe Luzern».
          </Text>
        ) : (
          kampagnen.map((k) => (
            <TouchableOpacity
              key={k.id}
              activeOpacity={0.8}
              onPress={() => setOffen(k.id)}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{k.name}</Text>
              <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 3 }}>
                {k.status.toUpperCase()}
                {k.kantone.length ? ` · ${k.kantone.join(", ")}` : ""}
                {k.branchen.length ? ` · ${k.branchen.join(", ")}` : ""}
              </Text>
              {!!k.call_ziel && <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>Ziel: {k.call_ziel}</Text>}
            </TouchableOpacity>
          ))
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── kleine Bausteine ──────────────────────────────────────────────────────

function Knopf({ colors, text, onPress, variante = "primaer", klein = false, aus = false }: {
  colors: Farben; text: string; onPress: () => void; variante?: "primaer" | "rand" | "gefahr"; klein?: boolean; aus?: boolean;
}) {
  const bg = variante === "primaer" ? colors.primary : "transparent";
  const rand = variante === "gefahr" ? "#EF4444" : variante === "rand" ? colors.border : colors.primary;
  const farbe = variante === "primaer" ? "#1C1D27" : variante === "gefahr" ? "#EF4444" : colors.text;
  return (
    <TouchableOpacity
      onPress={aus ? undefined : onPress}
      disabled={aus}
      activeOpacity={0.8}
      style={{ backgroundColor: bg, borderWidth: 1, borderColor: rand, borderRadius: 999, paddingHorizontal: klein ? 12 : 16, paddingVertical: klein ? 6 : 9, opacity: aus ? 0.4 : 1 }}
    >
      <Text style={{ fontSize: klein ? 12 : 13, fontWeight: "800", color: farbe }}>{text}</Text>
    </TouchableOpacity>
  );
}

function Chip({ colors, text, aktiv, onPress }: { colors: Farben; text: string; aktiv: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
        borderColor: aktiv ? colors.primary : colors.border,
        backgroundColor: aktiv ? colors.primary + "22" : colors.background,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: aktiv ? colors.primary : colors.muted }}>{text}</Text>
    </TouchableOpacity>
  );
}

function Feld({ colors, label, value, onChange, placeholder, multiline, tastatur }: {
  colors: Farben; label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; tastatur?: any;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={tastatur}
        autoCapitalize="none"
        style={{
          backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15, minHeight: multiline ? 70 : undefined,
        }}
      />
    </View>
  );
}

function Karte({ colors, children, titel }: { colors: Farben; children: any; titel: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 12 }}>{titel}</Text>
      {children}
    </View>
  );
}

// ── Kampagne anlegen / bearbeiten ─────────────────────────────────────────

function KampagnenFormular({ colors, kampagne, onFertig, onAbbrechen }: {
  colors: Farben; kampagne: Akq.Campaign | null; onFertig: () => void; onAbbrechen: () => void;
}) {
  const [name, setName] = useState(kampagne?.name || "");
  const [status, setStatus] = useState<Akq.Campaign["status"]>(kampagne?.status || "aktiv");
  const [kantone, setKantone] = useState<string[]>(kampagne?.kantone || []);
  const [plz, setPlz] = useState(kampagne?.plz_liste || "");
  const [radius, setRadius] = useState(kampagne?.radius_km ? String(kampagne.radius_km) : "");
  const [branchen, setBranchen] = useState((kampagne?.branchen || []).join(", "));
  const [angebot, setAngebot] = useState(kampagne?.angebotsprofil || "");
  const [ziel, setZiel] = useState(kampagne?.call_ziel || "");
  const [ausschluss, setAusschluss] = useState(kampagne?.ausschluesse || "");
  const [speichert, setSpeichert] = useState(false);

  const speichern = async () => {
    if (!name.trim()) { showAlert("Fehler", "Bitte einen Namen für die Kampagne angeben."); return; }
    setSpeichert(true);
    try {
      await Akq.saveCampaign(kampagne?.id || null, {
        name: name.trim(), status, kantone,
        plz_liste: plz.trim() || null,
        radius_km: Number(radius) || null,
        branchen: komma(branchen),
        angebotsprofil: angebot.trim() || null,
        call_ziel: ziel.trim() || null,
        ausschluesse: ausschluss.trim() || null,
      });
      showToast(kampagne ? "Kampagne aktualisiert" : "Kampagne angelegt");
      onFertig();
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSpeichert(false);
    }
  };

  return (
    <Karte colors={colors} titel={kampagne ? "Kampagne bearbeiten" : "Neue Kampagne"}>
      <Feld colors={colors} label="Name *" value={name} onChange={setName} placeholder="z.B. Websites für Sanitärbetriebe Luzern" />
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 }}>Status</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {KAMPAGNEN_STATUS.map((s) => <Chip key={s} colors={colors} text={s} aktiv={status === s} onPress={() => setStatus(s)} />)}
      </View>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 }}>Kantone</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {Akq.SCHWEIZER_KANTONE.map((k) => (
          <Chip key={k} colors={colors} text={k} aktiv={kantone.includes(k)}
            onPress={() => setKantone(kantone.includes(k) ? kantone.filter((x) => x !== k) : [...kantone, k])} />
        ))}
      </View>
      <Feld colors={colors} label="PLZ-Liste (optional)" value={plz} onChange={setPlz} placeholder="z.B. 6000, 6003, 6004" />
      <Feld colors={colors} label="Radius in km (optional)" value={radius} onChange={setRadius} tastatur="number-pad" />
      <Feld colors={colors} label="Branchen (mit Komma getrennt)" value={branchen} onChange={setBranchen} placeholder="Sanitär, Heizung, Gebäudetechnik" />
      <Feld colors={colors} label="Angebotsprofil" value={angebot} onChange={setAngebot} placeholder="z.B. Website-Erneuerung oder IT-Betreuung" multiline />
      <Feld colors={colors} label="Ziel des Anrufs" value={ziel} onChange={setZiel} placeholder="z.B. 15-Minuten-Analysegespräch" />
      <Feld colors={colors} label="Ausschlüsse" value={ausschluss} onChange={setAusschluss} placeholder="z.B. bestehende Kunden, Grossunternehmen" multiline />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Knopf colors={colors} text={speichert ? "Speichert…" : "Speichern"} onPress={speichern} aus={speichert} />
        <Knopf colors={colors} text="Abbrechen" variante="rand" onPress={onAbbrechen} />
      </View>
    </Karte>
  );
}

// ── Kampagne öffnen: Prospect-Queue ───────────────────────────────────────

function KampagnenDetail({ kampagne, colors, userId, onZurueck, onBearbeiten }: {
  kampagne: Akq.Campaign; colors: Farben; userId?: string; onZurueck: () => void; onBearbeiten: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<Akq.ProspectStatus | "alle">("alle");
  const [zeigeNeu, setZeigeNeu] = useState(false);
  const [zeigeImport, setZeigeImport] = useState(false);
  const [zeigeSuche, setZeigeSuche] = useState(false);

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["akqProspects", kampagne.id],
    queryFn: () => Akq.getProspects(kampagne.id),
  });
  const neuLaden = () => queryClient.invalidateQueries({ queryKey: ["akqProspects", kampagne.id] });

  const sichtbar = prospects.filter((p) => filter === "alle" || p.status === filter);
  const zaehle = (s: Akq.ProspectStatus) => prospects.filter((p) => p.status === s).length;

  return (
    <>
      <TouchableOpacity onPress={onZurueck} style={{ marginBottom: 10 }}>
        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>← Alle Kampagnen</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{kampagne.name}</Text>
      <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 4, marginBottom: 4 }}>
        {kampagne.status.toUpperCase()}
        {kampagne.kantone.length ? ` · ${kampagne.kantone.join(", ")}` : ""}
        {kampagne.branchen.length ? ` · ${kampagne.branchen.join(", ")}` : ""}
      </Text>
      {!!kampagne.angebotsprofil && <Text style={{ fontSize: 13, color: colors.muted }}>Angebot: {kampagne.angebotsprofil}</Text>}
      {!!kampagne.call_ziel && <Text style={{ fontSize: 13, color: colors.muted }}>Ziel: {kampagne.call_ziel}</Text>}
      {!!kampagne.ausschluesse && <Text style={{ fontSize: 13, color: colors.muted }}>Ausschlüsse: {kampagne.ausschluesse}</Text>}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 14 }}>
        <Knopf colors={colors} text="Firmen suchen (Google)" onPress={() => { setZeigeSuche(!zeigeSuche); setZeigeNeu(false); setZeigeImport(false); }} />
        <Knopf colors={colors} text="+ Prospect" variante="rand" onPress={() => { setZeigeNeu(!zeigeNeu); setZeigeImport(false); setZeigeSuche(false); }} />
        <Knopf colors={colors} text="Liste importieren" variante="rand" onPress={() => { setZeigeImport(!zeigeImport); setZeigeNeu(false); setZeigeSuche(false); }} />
        <Knopf colors={colors} text={`Leads öffnen${zaehle("uebernommen") ? ` (${zaehle("uebernommen")} aus dieser Kampagne)` : ""}`} variante="rand" onPress={() => router.push("/leads" as any)} />
        <Knopf colors={colors} text="Kampagne bearbeiten" variante="rand" onPress={onBearbeiten} />
        <Knopf colors={colors} text="Löschen" variante="gefahr" onPress={() => {
          showConfirm("Kampagne löschen", `«${kampagne.name}» samt allen Prospects wird gelöscht (übernommene Leads bleiben bestehen). Fortfahren?`, async () => {
            try { await Akq.deleteCampaign(kampagne.id); queryClient.invalidateQueries({ queryKey: ["akqKampagnen"] }); onZurueck(); showToast("Kampagne gelöscht"); }
            catch (e: any) { showAlert("Fehler", e.message); }
          });
        }} />
      </View>

      {zeigeSuche && <PlacesSuche colors={colors} kampagne={kampagne} userId={userId} onVorgemerkt={neuLaden} />}
      {zeigeNeu && <ProspectFormular colors={colors} kampagne={kampagne} userId={userId} onFertig={() => { setZeigeNeu(false); neuLaden(); }} />}
      {zeigeImport && <ImportPanel colors={colors} kampagne={kampagne} userId={userId} onFertig={() => { setZeigeImport(false); neuLaden(); }} />}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Chip colors={colors} text={`Alle (${prospects.length})`} aktiv={filter === "alle"} onPress={() => setFilter("alle")} />
        {(Object.keys(STATUS_LABEL) as Akq.ProspectStatus[]).filter((s) => s !== "freigegeben" || zaehle(s) > 0).map((s) => (
          <Chip key={s} colors={colors} text={`${STATUS_LABEL[s]} (${zaehle(s)})`} aktiv={filter === s} onPress={() => setFilter(s)} />
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : sichtbar.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>
          {prospects.length === 0 ? "Noch keine Prospects. Fügen Sie Firmen einzeln hinzu oder importieren Sie eine Liste." : "Keine Prospects in diesem Filter."}
        </Text>
      ) : (
        sichtbar.map((p) => <ProspectKarte key={p.id} p={p} kampagne={kampagne} colors={colors} userId={userId} onAenderung={neuLaden} />)
      )}
    </>
  );
}

// ── Firmen suchen (Google Places) ─────────────────────────────────────────
// Treffer werden nur angezeigt. Gespeichert wird beim Vormerken ausschliesslich
// die Google-ID (place_id) — so verlangt es Google.

function PlacesSuche({ colors, kampagne, userId, onVorgemerkt }: { colors: Farben; kampagne: Akq.Campaign; userId?: string; onVorgemerkt: () => void }) {
  // Suchbegriff = Branche; das Gebiet (Ort/PLZ + Umkreis) wird getrennt eingegrenzt
  const [suche, setSuche] = useState(kampagne.branchen[0] ?? "");
  const [gebietText, setGebietText] = useState((kampagne.plz_liste ?? "").trim());
  const [radius, setRadius] = useState(kampagne.radius_km ? String(kampagne.radius_km) : "");
  const [zentrum, setZentrum] = useState<{ lat: number; lng: number } | null>(null);
  const [ausgeblendet, setAusgeblendet] = useState(0);
  const [treffer, setTreffer] = useState<Akq.PlaceEintrag[]>([]);
  const [weiter, setWeiter] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [gesucht, setGesucht] = useState(false);

  const los = async (token?: string) => {
    setLaedt(true);
    try {
      const radiusKm = Math.max(Number(radius.replace(",", ".")) || 0, 0);
      const r = await Akq.placesSuchen(suche, kampagne.id, { eingabe: gebietText, radiusKm, zentrum: token ? zentrum : null }, token);
      setTreffer(token ? [...treffer, ...r.treffer] : r.treffer);
      setAusgeblendet((a) => (token ? a : 0) + (r.ausgeblendet ?? 0));
      setZentrum(r.zentrum ?? null);
      setWeiter(r.nextPageToken);
      setGesucht(true);
    } catch (e: any) {
      showAlert("Suche fehlgeschlagen", e.message);
    } finally { setLaedt(false); }
  };

  const vormerken = async (t: Akq.PlaceEintrag) => {
    try {
      await Akq.placeVormerken(kampagne.id, t.placeId, userId);
      setTreffer((alle) => alle.map((x) => (x.placeId === t.placeId ? { ...x, bereitsVorgemerkt: true } : x)));
      showToast("Vorgemerkt");
      onVorgemerkt();
    } catch (e: any) { showAlert("Fehler", e.message); }
  };

  return (
    <Karte colors={colors} titel="Firmen suchen (Google Maps)">
      <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 10 }}>
        Die Treffer stammen live aus Google Maps und werden nur angezeigt. Beim Vormerken speichern wir ausschliesslich die Google-ID,
        nicht Name oder Telefonnummer (Vorgabe von Google). Die Firmendaten holen Sie danach von der eigenen Website der Firma.
        Jede Suche und jede Seite «Mehr laden» verursacht Kosten bei Google.
      </Text>
      <Feld colors={colors} label="Suchbegriff (Branche)" value={suche} onChange={setSuche} placeholder="z.B. Sanitär" />
      <Feld colors={colors} label="Ort oder PLZ" value={gebietText} onChange={setGebietText} placeholder="z.B. Zell LU oder 6144, 6260" />
      <Feld colors={colors} label="Umkreis in km (leer oder 0 = nur dieser Ort bzw. diese PLZ)" value={radius} onChange={setRadius} placeholder="z.B. 10" tastatur="numeric" />
      {!gebietText.trim() && (
        <Text style={{ fontSize: 12, color: "#F59E0B", marginBottom: 8 }}>
          Ohne Ort oder PLZ wird nicht eingegrenzt — Google liefert dann Firmen aus der ganzen Schweiz.
        </Text>
      )}
      <Knopf colors={colors} text={laedt ? "Sucht…" : "Suchen"} onPress={() => los()} aus={laedt || suche.trim().length < 3} />

      {gesucht && treffer.length === 0 && (
        <Text style={{ color: colors.muted, marginTop: 12 }}>
          Keine Treffer im Gebiet.{ausgeblendet > 0 ? ` ${ausgeblendet} Treffer ausserhalb wurden ausgeblendet.` : ""}{weiter ? " Mit «Mehr laden» weitersuchen." : ""}
        </Text>
      )}
      {gesucht && treffer.length > 0 && ausgeblendet > 0 && (
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>{ausgeblendet} Treffer ausserhalb des Gebiets ausgeblendet.</Text>
      )}
      {treffer.map((t) => (
        <View key={t.placeId} style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{t.name}</Text>
          {!!t.adresse && <Text style={{ fontSize: 12.5, color: colors.muted }}>{t.adresse}</Text>}
          {!!t.telefon && <Text style={{ fontSize: 12.5, color: colors.muted }}>{t.telefon}</Text>}
          {!!t.website && <Text style={{ fontSize: 12.5, color: colors.primary }} onPress={() => Linking.openURL(t.website)}>{t.website}</Text>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
            <Knopf colors={colors} klein text={t.bereitsVorgemerkt ? "Vorgemerkt ✓" : "Vormerken"} aus={!!t.bereitsVorgemerkt} onPress={() => vormerken(t)} />
            {!!t.mapsUrl && <Knopf colors={colors} klein variante="rand" text="In Google Maps öffnen" onPress={() => Linking.openURL(t.mapsUrl)} />}
          </View>
        </View>
      ))}
      {!!weiter && <View style={{ marginTop: 14 }}><Knopf colors={colors} variante="rand" klein text={laedt ? "Lädt…" : "Mehr laden"} aus={laedt} onPress={() => los(weiter)} /></View>}
      {gesucht && <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 14 }}>Quelle der Treffer: Google Maps</Text>}
    </Karte>
  );
}

// ── Prospect von Hand erfassen ────────────────────────────────────────────

function ProspectFormular({ colors, kampagne, userId, onFertig }: { colors: Farben; kampagne: Akq.Campaign; userId?: string; onFertig: () => void }) {
  const [w, setW] = useState({ firma: "", domain: "", telefon: "", email: "", ansprechpartner: "", adresse: "", plz: "", ort: "", kanton: "", branche: "", quelle: "manuell", quelle_notiz: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof w) => (v: string) => setW((x) => ({ ...x, [k]: v }));

  const speichern = async () => {
    if (!w.firma.trim()) { showAlert("Fehler", "Bitte einen Firmennamen angeben."); return; }
    setBusy(true);
    try {
      const r = await Akq.createProspects(kampagne.id, [w], userId);
      if (r.uebersprungen.length) showAlert("Nicht angelegt", `${r.uebersprungen[0].firma}: ${r.uebersprungen[0].grund}`);
      else { showToast("Prospect angelegt"); onFertig(); }
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally { setBusy(false); }
  };

  return (
    <Karte colors={colors} titel="Neuer Prospect">
      <Feld colors={colors} label="Firma *" value={w.firma} onChange={set("firma")} />
      <Feld colors={colors} label="Website" value={w.domain} onChange={set("domain")} placeholder="firma.ch" />
      <Feld colors={colors} label="Telefon" value={w.telefon} onChange={set("telefon")} tastatur="phone-pad" />
      <Feld colors={colors} label="E-Mail" value={w.email} onChange={set("email")} tastatur="email-address" />
      <Feld colors={colors} label="Ansprechpartner" value={w.ansprechpartner} onChange={set("ansprechpartner")} />
      <Feld colors={colors} label="Strasse" value={w.adresse} onChange={set("adresse")} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Feld colors={colors} label="PLZ" value={w.plz} onChange={set("plz")} tastatur="number-pad" /></View>
        <View style={{ flex: 2 }}><Feld colors={colors} label="Ort" value={w.ort} onChange={set("ort")} /></View>
        <View style={{ flex: 1 }}><Feld colors={colors} label="Kanton" value={w.kanton} onChange={set("kanton")} placeholder="LU" /></View>
      </View>
      <Feld colors={colors} label="Branche" value={w.branche} onChange={set("branche")} />
      <Feld colors={colors} label="Woher stammt der Eintrag?" value={w.quelle_notiz} onChange={set("quelle_notiz")} placeholder="z.B. Handelsregister, Empfehlung, Branchenverzeichnis" />
      <Knopf colors={colors} text={busy ? "Speichert…" : "Prospect anlegen"} onPress={speichern} aus={busy} />
    </Karte>
  );
}

// ── Liste importieren (CSV) ───────────────────────────────────────────────

function ImportPanel({ colors, kampagne, userId, onFertig }: { colors: Farben; kampagne: Akq.Campaign; userId?: string; onFertig: () => void }) {
  const [text, setText] = useState("");
  const [quelle, setQuelle] = useState("");
  const [busy, setBusy] = useState(false);

  const parse = (csv: string): Akq.NeuerProspect[] => {
    const zeilen = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (zeilen.length < 2) return [];
    const kopf = zeilen[0];
    const trenner = kopf.includes(";") ? ";" : kopf.includes("\t") ? "\t" : ",";
    const spalten = kopf.split(trenner).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    const idx = (namen: string[]) => spalten.findIndex((h) => namen.includes(h));
    const i = {
      firma: idx(["firma", "company", "firmenname", "unternehmen", "name"]),
      domain: idx(["website", "webseite", "url", "domain", "web", "homepage"]),
      telefon: idx(["telefon", "phone", "tel", "telefonnummer"]),
      email: idx(["email", "e-mail", "mail"]),
      ansprechpartner: idx(["ansprechpartner", "kontakt", "kontaktperson", "person"]),
      adresse: idx(["adresse", "strasse", "address"]),
      plz: idx(["plz", "zip", "postleitzahl"]),
      ort: idx(["ort", "city", "stadt", "gemeinde"]),
      kanton: idx(["kanton", "canton"]),
      branche: idx(["branche", "industry", "sektor"]),
    };
    if (i.firma < 0) return [];
    return zeilen.slice(1).map((z) => {
      const c = z.split(trenner).map((x) => x.trim().replace(/^"|"$/g, ""));
      const g = (n: number) => (n >= 0 ? c[n] || "" : "");
      return {
        firma: g(i.firma), domain: g(i.domain), telefon: g(i.telefon), email: g(i.email), ansprechpartner: g(i.ansprechpartner),
        adresse: g(i.adresse), plz: g(i.plz), ort: g(i.ort), kanton: g(i.kanton), branche: g(i.branche),
        quelle: "CSV-Import", quelle_notiz: quelle,
      };
    }).filter((r) => r.firma);
  };
  const vorschau = parse(text);

  const datei = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const uri = r.assets[0].uri;
      setText(Platform.OS === "web" ? await (await fetch(uri)).text() : await FileSystem.readAsStringAsync(uri));
    } catch (e: any) { showAlert("Fehler", "Datei konnte nicht gelesen werden: " + e.message); }
  };

  const importieren = async () => {
    if (!vorschau.length) return;
    if (!quelle.trim()) { showAlert("Quelle fehlt", "Bitte angeben, woher die Liste stammt (z.B. «Handelsregister-Export Okt 2026»). Die Herkunft muss nachvollziehbar bleiben."); return; }
    setBusy(true);
    try {
      const r = await Akq.createProspects(kampagne.id, vorschau, userId);
      const doppelt = r.uebersprungen.length ? `\n\nÜbersprungen (${r.uebersprungen.length}):\n` + r.uebersprungen.slice(0, 8).map((u) => `• ${u.firma}: ${u.grund}`).join("\n") : "";
      showAlert("Import abgeschlossen", `${r.angelegt} Prospects angelegt.${doppelt}`);
      onFertig();
    } catch (e: any) { showAlert("Fehler", e.message); }
    finally { setBusy(false); }
  };

  return (
    <Karte colors={colors} titel="Liste importieren">
      <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 10 }}>
        CSV mit Kopfzeile. Erkannte Spalten: Firma, Website, Telefon, E-Mail, Ansprechpartner, Adresse, PLZ, Ort, Kanton, Branche.
        Duplikate (Website, Telefon, E-Mail) zu Prospects, Leads und Kunden werden übersprungen. Es entstehen nur Prospects — noch keine Leads.
      </Text>
      <Feld colors={colors} label="Herkunft der Liste *" value={quelle} onChange={setQuelle} placeholder="z.B. Handelsregister-Export Okt 2026" />
      <View style={{ marginBottom: 10 }}><Knopf colors={colors} text="Datei wählen" variante="rand" klein onPress={datei} /></View>
      <Feld colors={colors} label="oder CSV einfügen" value={text} onChange={setText} multiline />
      {!!text && <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 10 }}>{vorschau.length} Firmen erkannt</Text>}
      <Knopf colors={colors} text={busy ? "Importiert…" : `${vorschau.length} Prospects anlegen`} onPress={importieren} aus={busy || !vorschau.length} />
    </Karte>
  );
}

// ── Ein Prospect ──────────────────────────────────────────────────────────

function ProspectKarte({ p, kampagne, colors, userId, onAenderung }: {
  p: Akq.Prospect; kampagne: Akq.Campaign; colors: Farben; userId?: string; onAenderung: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [panel, setPanel] = useState<null | "sperre" | "belege" | "google">(null);
  const [google, setGoogle] = useState<Akq.PlaceEintrag | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [grund, setGrund] = useState("");
  // Gesperrt = steht auf der Sperrliste «Nicht kontaktieren» (oder wurde früher so markiert)
  const gesperrt = p.compliance_status.startsWith("blocked");
  const befund = Akq.webBefund(p.web_check);

  const { data: belege = [] } = useQuery({
    queryKey: ["akqBelege", p.id],
    queryFn: () => Akq.getEvidence(p.id),
    enabled: panel === "belege",
  });

  const lauf = async (name: string, fn: () => Promise<any>, erfolg?: string) => {
    setBusy(name);
    try { await fn(); if (erfolg) showToast(erfolg); onAenderung(); }
    catch (e: any) { showAlert("Fehler", e.message); }
    finally { setBusy(null); }
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: gesperrt ? "#EF444466" : colors.border, borderRadius: 14, padding: 14, marginBottom: 10, opacity: p.status === "verworfen" ? 0.55 : 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: p.firma ? colors.text : colors.muted }}>{p.firma || "Google-Eintrag (Firmendaten noch nicht übernommen)"}</Text>
          <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
            {[p.plz, p.ort, p.kanton].filter(Boolean).join(" ")}{p.branche ? ` · ${p.branche}` : ""}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Quelle: {p.quelle}{p.quelle_notiz ? ` (${p.quelle_notiz})` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>{STATUS_LABEL[p.status]}</Text>
          {p.score != null && <Text style={{ fontSize: 12.5, color: colors.text, marginTop: 2 }}>Score {p.score}/100</Text>}
        </View>
      </View>

      <View style={{ marginTop: 8, gap: 2 }}>
        {!!p.telefon && (
          <Text style={{ fontSize: 13, color: colors.text }}>
            Tel. {p.telefon}
          </Text>
        )}
        {!!p.email && <Text style={{ fontSize: 13, color: colors.text }}>{p.email}</Text>}
        {!!p.domain && <Text style={{ fontSize: 13, color: colors.primary }} onPress={() => Linking.openURL(`https://${p.domain}`)}>{p.domain}</Text>}
        {gesperrt && <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#EF4444", marginTop: 4 }}>● Auf der Sperrliste — nicht kontaktieren</Text>}
      </View>

      {befund && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 6 }}>
            Website-Befund{p.web_check?.abgerufen_am ? <Text style={{ fontWeight: "400", color: colors.muted }}> · {new Date(p.web_check.abgerufen_am).toLocaleDateString("de-CH")}</Text> : null}
          </Text>
          {befund.botSchutz ? (
            <Text style={{ fontSize: 12.5, color: "#F59E0B" }}>
              Die Website blockt automatische Prüfungen (Bot-Schutz). Impressum, Datenschutz und Alter konnten nicht gelesen werden — bitte von Hand ansehen.
            </Text>
          ) : (
            befund.zeilen.map((z) => {
              const farbe = z.ok === true ? "#22C55E" : z.ok === false ? "#EF4444" : colors.muted;
              return (
                <View key={z.label} style={{ flexDirection: "row", gap: 8, marginBottom: 3 }}>
                  <Text style={{ width: 16, fontSize: 13, fontWeight: "800", color: farbe }}>{z.ok === true ? "✓" : z.ok === false ? "✗" : "–"}</Text>
                  <Text style={{ flex: 1, fontSize: 12.5, color: colors.text }}>
                    <Text style={{ fontWeight: "700" }}>{z.label}: </Text>
                    <Text style={{ color: z.ok === false ? "#EF4444" : colors.muted }}>{z.text}</Text>
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}

      {!!p.score_begruendung?.length && (
        <View style={{ marginTop: 8 }}>
          {p.score_begruendung.map((z, i) => <Text key={i} style={{ fontSize: 12, color: colors.muted }}>{z}</Text>)}
        </View>
      )}

      {p.status !== "uebernommen" && p.status !== "verworfen" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <Knopf colors={colors} klein variante="rand" text={busy === "web" ? "Prüft…" : "Website prüfen"} aus={(!p.domain && !p.google_place_id) || !!busy}
            onPress={() => lauf("web", () => Akq.pruefeWebsite(p, kampagne, userId), "Website geprüft")} />
          {!!p.google_place_id && !p.firma && (
            <Knopf colors={colors} klein text={busy === "daten" ? "Liest…" : "Firmendaten von Website holen"} aus={!!busy}
              onPress={() => lauf("daten", async () => {
                const r = await Akq.datenVonWebsiteUebernehmen(p, kampagne, userId);
                if (r.hinweis) showAlert("Hinweis", r.hinweis);
              }, "Firmendaten übernommen")} />
          )}
          {!!p.google_place_id && (
            <Knopf colors={colors} klein variante="rand" text="Google-Eintrag ansehen" aus={!!busy}
              onPress={async () => {
                if (panel === "google") { setPanel(null); return; }
                setPanel("google");
                try { setGoogle(await Akq.placeDetails(p.google_place_id!)); }
                catch (e: any) { setPanel(null); showAlert("Fehler", e.message); }
              }} />
          )}
          <Knopf colors={colors} klein variante="rand" text="Belege" onPress={() => setPanel(panel === "belege" ? null : "belege")} />
          <Knopf colors={colors} klein text={busy === "lead" ? "Übernimmt…" : "Als Lead übernehmen"} aus={gesperrt || !!busy}
            onPress={() => lauf("lead", async () => {
              await Akq.alsLeadUebernehmen(p, kampagne, userId);
              queryClient.invalidateQueries({ queryKey: ["leads"] });
            }, "Als Lead übernommen")} />
          <Knopf colors={colors} klein variante="gefahr" text="Nicht kontaktieren" onPress={() => setPanel(panel === "sperre" ? null : "sperre")} />
          <Knopf colors={colors} klein variante="rand" text="Verwerfen" aus={!!busy}
            onPress={() => lauf("verw", () => Akq.updateProspect(p.id, { status: "verworfen" }), "Verworfen")} />
        </View>
      )}
      {p.status === "uebernommen" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {!!p.lead_id && <Knopf colors={colors} klein text="Lead öffnen" onPress={() => router.push(`/leads?leadId=${p.lead_id}` as any)} />}
          <Text style={{ fontSize: 12, color: colors.muted, alignSelf: "center" }}>Als Lead im CRM — dort geht es mit Anruf, Mail und Angebot weiter.</Text>
        </View>
      )}

      {panel === "sperre" && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 8 }}>
            Setzt Telefon, E-Mail und Website dieser Firma dauerhaft auf die Sperrliste. Alle Treffer in allen Kampagnen werden sofort gesperrt. Das lässt sich in der App nicht rückgängig machen.
          </Text>
          <Feld colors={colors} label="Grund" value={grund} onChange={setGrund} placeholder="z.B. Wunsch am Telefon, Sterneintrag entdeckt" />
          <Knopf colors={colors} variante="gefahr" text={busy === "sperre" ? "Sperrt…" : "Dauerhaft sperren"} aus={!!busy}
            onPress={() => lauf("sperre", async () => { await Akq.aufSperrlisteSetzen(p, grund, userId); setPanel(null); }, "Auf die Sperrliste gesetzt")} />
        </View>
      )}

      {panel === "google" && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          {!google ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{google.name}</Text>
              {!!google.adresse && <Text style={{ fontSize: 12.5, color: colors.muted }}>{google.adresse}</Text>}
              {!!google.telefon && <Text style={{ fontSize: 12.5, color: colors.muted }}>{google.telefon}</Text>}
              {!!google.website && <Text style={{ fontSize: 12.5, color: colors.primary }} onPress={() => Linking.openURL(google.website)}>{google.website}</Text>}
              {!!google.mapsUrl && <Text style={{ fontSize: 12.5, color: colors.primary, marginTop: 4 }} onPress={() => Linking.openURL(google.mapsUrl)}>In Google Maps öffnen</Text>}
              <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 8 }}>Live von Google Maps abgerufen und nicht gespeichert. Quelle: Google Maps</Text>
            </>
          )}
        </View>
      )}

      {panel === "belege" && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          {belege.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: colors.muted }}>Noch keine Belege. «Website prüfen» speichert, was gefunden wurde, mit URL und Zeitpunkt.</Text>
          ) : (
            belege.map((b: any) => (
              <View key={b.id} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.text }}>{b.feld} <Text style={{ fontWeight: "400", color: colors.muted }}>· Vertrauen {b.vertrauen}</Text></Text>
                <Text style={{ fontSize: 12.5, color: colors.text }}>{b.textauszug}</Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>{b.quelle_url} · {new Date(b.abgerufen_am).toLocaleString("de-CH")}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}
