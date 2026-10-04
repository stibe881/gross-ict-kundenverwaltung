import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

export default function UsersScreen() {
  const colors = useColors();
  const { containerStyle, contentPadding } = useResponsiveLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = useGlobalRefresh();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editStreet, setEditStreet] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editIban, setEditIban] = useState("");
  const [editPushPrefs, setEditPushPrefs] = useState<Record<string, boolean>>({});
  const [editReadOnly, setEditReadOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>([]);

  const createUserMutation = useMutation({
    mutationFn: (user: { name: string; email: string; roles: string[]; password: string }) =>
      Data.createUser(user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreateModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRoles([]);
      showAlert("Erfolg", "Benutzer wurde erstellt.");
    },
    onError: (err: any) => {
      showAlert("Fehler", err.message);
    },
  });

  const handleCreateUser = () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      showAlert("Fehler", "Name, E-Mail und Passwort sind erforderlich.");
      return;
    }
    if (newUserPassword.length < 6) {
      showAlert("Fehler", "Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    createUserMutation.mutate({ name: newUserName.trim(), email: newUserEmail.trim(), roles: newUserRoles, password: newUserPassword });
  };

  const toggleNewUserRole = (roleKey: string) => {
    setNewUserRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]
    );
  };

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 900;

  const { data: users = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: Data.getAllUsers,
    retry: 3,
    retryDelay: 1000,
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roles, address, postal_code, city, iban, push_preferences, read_only }: { userId: string; roles: string[]; address: string; postal_code: string; city: string; iban: string; push_preferences?: Record<string, boolean>; read_only?: boolean }) =>
      Data.updateUserProfileAndRoles(userId, { roles, address, postal_code, city, iban, push_preferences, read_only }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUserId(null);
      showAlert("Erfolg", "Rollen wurden aktualisiert.");
    },
    onError: (err: any) => {
      showAlert("Fehler", err.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => Data.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast("Benutzer wurde gelöscht.");
    },
    onError: (err: any) => {
      showAlert("Fehler", err.message);
    },
  });

  const startEditRoles = (user: any) => {
    setEditingUserId(user.id);
    setEditRoles(user.roles || []);
    setEditStreet(user.address || "");
    setEditPostalCode(user.postal_code || "");
    setEditCity(user.city || "");
    setEditIban(user.iban || "");
    setEditPushPrefs(user.push_preferences || {});
    setEditReadOnly(user.read_only === true);
  };

  const toggleRole = (roleKey: string) => {
    setEditRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((r) => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const handleSaveRoles = async () => {
    if (!editingUserId) return;
    try {
      updateRolesMutation.mutate({ userId: editingUserId, roles: editRoles, address: editStreet, postal_code: editPostalCode, city: editCity, iban: editIban, push_preferences: editPushPrefs, read_only: editReadOnly });
    } catch (err: any) {
      showAlert("Fehler", err.message || "Fehler beim Speichern der Benutzerdaten");
    }
  };

  const getUserRoles = (user: any): string[] => user.roles || [];

  // Grüner Punkt: in den letzten 10 Minuten aktiv gewesen
  const isOnline = (user: any) =>
    !!user.last_seen_at && Date.now() - new Date(user.last_seen_at).getTime() < 10 * 60 * 1000;

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] || "?").toUpperCase();
  };

  // SSO/Local detection: use provider field, or fallback to checking email domain
  const isSSO = (user: any) => {
    if (user.provider && user.provider !== "local" && user.provider !== "email") return true;
    // Fallback: if email is @gross-ict.ch and provider is not explicitly "local", assume SSO
    return false;
  };

  const getProviderLabel = (user: any) => {
    if (user.provider === "azure" || user.provider === "microsoft") return "Microsoft SSO";
    if (user.provider === "google") return "Google SSO";
    if (user.provider && user.provider !== "local" && user.provider !== "email") return "SSO";
    return "Lokal";
  };

  const getProviderColor = (user: any) => {
    return isSSO(user) ? "#0078D4" : "#6B7280";
  };

  const activeUsers = users.filter((u: any) => u.is_active !== false);
  const ssoUsers = users.filter((u: any) => isSSO(u));

  const renderRoleBadge = (roleKey: string, small = false) => {
    const role = Data.ROLE_DEFINITIONS.find((r) => r.key === roleKey);
    if (!role) return null;
    return (
      <View
        key={roleKey}
        style={{
          backgroundColor: role.color + "18",
          paddingHorizontal: small ? 6 : 10,
          paddingVertical: small ? 2 : 3,
          borderRadius: 8,
        }}
      >
        <Text
          style={{
            color: role.color,
            fontSize: small ? 10 : 11,
            fontWeight: "700",
            textTransform: "uppercase",
          }}
        >
          {role.label}
        </Text>
      </View>
    );
  };

  const renderRoleEditor = (user: any) => (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.primary + "40",
        marginTop: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
        {user.name || user.email} bearbeiten
      </Text>
      <View style={{ gap: 8 }}>
        {Data.ROLE_DEFINITIONS.map((role) => {
          const isSelected = editRoles.includes(role.key);
          return (
            <TouchableOpacity
              key={role.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                backgroundColor: isSelected ? role.color + "15" : colors.surface,
                borderWidth: 1,
                borderColor: isSelected ? role.color + "50" : colors.border,
              }}
              activeOpacity={0.7}
              onPress={() => toggleRole(role.key)}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: isSelected ? role.color : colors.muted,
                  backgroundColor: isSelected ? role.color : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                {isSelected && (
                  <IconSymbol name="checkmark" size={12} color="#FFF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: isSelected ? role.color : colors.foreground }}>
                  {role.label}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                  {role.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginTop: 24, marginBottom: 8 }}>
        Persönliche Daten (Abrechnung)
      </Text>
      <View style={{ gap: 12 }}>
        <View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: "600" }}>Strasse</Text>
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.foreground,
            }}
            placeholder="Musterstrasse 1"
            placeholderTextColor={colors.muted}
            value={editStreet}
            onChangeText={setEditStreet}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 100 }}>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: "600" }}>PLZ</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.foreground,
              }}
              placeholder="8000"
              placeholderTextColor={colors.muted}
              value={editPostalCode}
              onChangeText={setEditPostalCode}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: "600" }}>Ort</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.foreground,
              }}
              placeholder="Zürich"
              placeholderTextColor={colors.muted}
              value={editCity}
              onChangeText={setEditCity}
            />
          </View>
        </View>
        <View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: "600" }}>IBAN für Auszahlung</Text>
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.foreground,
            }}
            placeholder="CHXX XXXX XXXX XXXX XXXX X"
            placeholderTextColor={colors.muted}
            value={editIban}
            onChangeText={setEditIban}
          />
        </View>
      </View>

      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginTop: 24, marginBottom: 8 }}>
        Push-Benachrichtigungen
      </Text>
      <View style={{ gap: 8 }}>
        {[
          { key: "tickets", label: "Tickets", desc: "Neue Tickets, Status, Kommentare", icon: "ticket.fill", color: "#F59E0B" },
          { key: "invoices", label: "Rechnungen (Portal)", desc: "Rechnung vom Kunden geöffnet", icon: "doc.text.fill", color: "#22C55E" },
          { key: "auto_invoices", label: "Auto-Mails & Mahnungen", desc: "Automatischer Versand an Kunden", icon: "paperplane.fill", color: "#EF4444" },
          { key: "quotes", label: "Angebote", desc: "Neue Anfragen, Kunde öffnet Angebot", icon: "doc.on.doc.fill", color: "#0EA5E9" },
          { key: "tasks", label: "Aufgaben", desc: "Aufgaben-Zuweisung, Erinnerungen", icon: "checklist", color: "#8B5CF6" },
          { key: "sticky_notes", label: "Sticky Notes", desc: "Neue Notizen auf dem Whiteboard", icon: "note.text", color: "#EAB308" },
          { key: "portal", label: "Kundenportal", desc: "Kunden-Antworten auf Tickets", icon: "person.2.fill", color: "#14B8A6" },
          { key: "lead_reminders", label: "Lead Terminierungen", desc: "Erinnerungen für Kontakt-Wiedervorlage", icon: "calendar", color: "#F97316" },
          { key: "monitoring_alerts", label: "Überwachung", desc: "Ausfälle von Webseiten & Servern", icon: "wifi", color: "#06B6D4" },
        ].map((cat) => {
          const isEnabled = editPushPrefs[cat.key] !== false;
          return (
            <TouchableOpacity
              key={cat.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                backgroundColor: isEnabled ? cat.color + "10" : colors.surface,
                borderWidth: 1,
                borderColor: isEnabled ? cat.color + "40" : colors.border,
              }}
              activeOpacity={0.7}
              onPress={() => {
                setEditPushPrefs(prev => ({ ...prev, [cat.key]: !isEnabled }));
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: isEnabled ? cat.color : colors.muted,
                  backgroundColor: isEnabled ? cat.color : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                {isEnabled && (
                  <IconSymbol name="checkmark" size={12} color="#FFF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: isEnabled ? cat.color : colors.foreground }}>
                  {cat.label}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                  {cat.desc}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginTop: 24, marginBottom: 8 }}>
        Zugriff
      </Text>
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
          borderRadius: 10,
          backgroundColor: editReadOnly ? "#F59E0B10" : colors.surface,
          borderWidth: 1,
          borderColor: editReadOnly ? "#F59E0B40" : colors.border,
        }}
        activeOpacity={0.7}
        onPress={() => setEditReadOnly(!editReadOnly)}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: editReadOnly ? "#F59E0B" : colors.muted,
            backgroundColor: editReadOnly ? "#F59E0B" : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {editReadOnly && <IconSymbol name="checkmark" size={12} color="#FFF" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: editReadOnly ? "#F59E0B" : colors.foreground }}>
            Nur-Lesen-Modus
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
            Benutzer sieht alles, kann aber nichts erstellen oder löschen (z.B. Treuhänder, Praktikant)
          </Text>
        </View>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
          }}
          onPress={() => setEditingUserId(null)}
        >
          <Text style={{ fontWeight: "600", color: colors.foreground }}>Abbrechen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
          }}
          onPress={handleSaveRoles}
        >
          {updateRolesMutation.isPending ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={{ fontWeight: "700", color: colors.background }}>Speichern</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUserCard = (user: any) => {
    const roles = getUserRoles(user);
    const isEditing = editingUserId === user.id;

    return (
      <View
        key={user.id}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isEditing ? colors.primary + "40" : colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Avatar */}
          <View style={{ marginRight: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: user.is_active !== false ? colors.primary : colors.muted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>
                {getInitials(user.name || user.email || "?")}
              </Text>
            </View>
            {isOnline(user) && (
              <View style={{ position: "absolute", right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: "#22C55E", borderWidth: 2, borderColor: colors.surface }} />
            )}
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
                {user.name || "Kein Name"}
              </Text>
              {/* SSO/Local badge */}
              <View style={{
                backgroundColor: getProviderColor(user) + "18",
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                flexDirection: "row", alignItems: "center", gap: 4,
              }}>
                <IconSymbol name={isSSO(user) ? "lock.fill" : "person.fill.badge.plus"} size={10} color={getProviderColor(user)} />
                <Text style={{ fontSize: 9, fontWeight: "700", color: getProviderColor(user) }}>
                  {getProviderLabel(user)}
                </Text>
              </View>
              {user.is_active === false && (
                <View style={{ backgroundColor: colors.error + "20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: colors.error }}>INAKTIV</Text>
                </View>
              )}
              {user.read_only === true && (
                <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: "#F59E0B" }}>NUR LESEN</Text>
                </View>
              )}
              {isOnline(user) && (
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#22C55E" }}>● online</Text>
              )}
            </View>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
              {user.email}
            </Text>
            {/* Role badges */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {roles.length > 0 ? (
                roles.map((r: string) => renderRoleBadge(r, true))
              ) : (
                <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>Keine Rollen zugewiesen</Text>
              )}
            </View>
          </View>

          {/* Edit/Delete buttons */}
          {!isEditing && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary + "15",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6
                }}
                activeOpacity={0.7}
                onPress={() => startEditRoles(user)}
              >
                <IconSymbol name="pencil" size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>Bearbeiten</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.error + "15",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  justifyContent: "center",
                  alignItems: "center"
                }}
                activeOpacity={0.7}
                onPress={() => {
                  showConfirm(
                    "Benutzer löschen",
                    "Bist du sicher, dass du diesen Benutzer löschen möchtest?",
                    () => deleteUserMutation.mutate(user.id),
                    "Löschen"
                  );
                }}
              >
                <IconSymbol name="trash.fill" size={14} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Role editor */}
        {isEditing && renderRoleEditor(user)}
      </View>
    );
  };

  const renderDesktopTable = () => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background + "80" }}>
        <Text style={{ width: 240, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>Benutzer</Text>
        <Text style={{ width: 130, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>Anmeldung</Text>
        <Text style={{ flex: 1, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>Rollen</Text>
        <Text style={{ width: 90, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>Status</Text>
        <View style={{ width: 100 }} />
      </View>
      {/* Rows */}
      {users.map((user: any) => {
        const roles = getUserRoles(user);
        const isEditing = editingUserId === user.id;

        return (
          <View key={user.id}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              {/* User info */}
              <View style={{ width: 240, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: user.is_active !== false ? colors.primary : colors.muted,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "700" }}>
                      {getInitials(user.name || user.email || "?")}
                    </Text>
                  </View>
                  {isOnline(user) && (
                    <View style={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: "#22C55E", borderWidth: 2, borderColor: colors.surface }} />
                  )}
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                    {user.name || "Kein Name"}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{user.email}</Text>
                </View>
              </View>
              {/* Provider / Anmeldung */}
              <View style={{ width: 130 }}>
                <View style={{
                  backgroundColor: getProviderColor(user) + "15",
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                  alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4,
                }}>
                  <IconSymbol name={isSSO(user) ? "lock.fill" : "person.fill.badge.plus"} size={11} color={getProviderColor(user)} />
                  <Text style={{
                    color: getProviderColor(user), fontSize: 11, fontWeight: "600",
                  }}>
                    {getProviderLabel(user)}
                  </Text>
                </View>
              </View>
              {/* Roles */}
              <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {roles.length > 0 ? (
                  roles.map((r: string) => renderRoleBadge(r))
                ) : (
                  <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>Keine Rollen</Text>
                )}
              </View>
              {/* Status */}
              <View style={{ width: 90 }}>
                <View style={{
                  backgroundColor: user.is_active !== false ? "#22C55E18" : colors.error + "18",
                  paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start",
                }}>
                  <Text style={{
                    color: user.is_active !== false ? "#22C55E" : colors.error,
                    fontSize: 11, fontWeight: "600",
                  }}>
                    {user.is_active !== false ? "Aktiv" : "Inaktiv"}
                  </Text>
                </View>
              </View>
              {/* Actions */}
              <View style={{ width: 100, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary + "15",
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                    flexDirection: "row", alignItems: "center", gap: 4
                  }}
                  activeOpacity={0.7}
                  onPress={() => isEditing ? setEditingUserId(null) : startEditRoles(user)}
                >
                  <IconSymbol name={isEditing ? "xmark" : "pencil"} size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                    {isEditing ? "Schliessen" : "Bearbeiten"}
                  </Text>
                </TouchableOpacity>
                {!isEditing && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.error + "15",
                      paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
                    }}
                    activeOpacity={0.7}
                    onPress={() => {
                      showConfirm(
                        "Benutzer löschen",
                        "Bist du sicher, dass du diesen Benutzer löschen möchtest?",
                        () => deleteUserMutation.mutate(user.id),
                        "Löschen"
                      );
                    }}
                  >
                    <IconSymbol name="trash.fill" size={14} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {/* Inline role editor */}
            {isEditing && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background + "40" }}>
                {renderRoleEditor(user)}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: contentPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={containerStyle}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BackButton to="/settings" />
              <View>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground }}>Benutzer & Rollen</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>{users.length} Mitarbeitende</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                width: 44, height: 44, borderRadius: 22,
                alignItems: "center", justifyContent: "center",
              }}
              activeOpacity={0.8}
              onPress={() => setShowCreateModal(true)}
            >
              <IconSymbol name="plus" size={22} color={colors.background} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>{users.length}</Text>
              <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600", textTransform: "uppercase" }}>Gesamt</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#0078D4" }}>{ssoUsers.length}</Text>
              <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600", textTransform: "uppercase" }}>SSO</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#6B7280" }}>{users.length - ssoUsers.length}</Text>
              <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600", textTransform: "uppercase" }}>Lokal</Text>
            </View>
          </View>

          {/* Role Legend */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 10 }}>Verfügbare Rollen</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Data.ROLE_DEFINITIONS.map((role) => (
                <View key={role.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: role.color }} />
                  <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{role.label}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>({role.description})</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Abwesenheiten (Ferien/Krankheit) */}
          <AbsencesCard colors={colors} users={users} />

          {/* Info hint */}
          <View style={{ backgroundColor: "#0078D4" + "10", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#0078D4" + "25", marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconSymbol name="lock.fill" size={16} color="#0078D4" />
            <Text style={{ fontSize: 12, color: colors.foreground, flex: 1, lineHeight: 18 }}>
              SSO-Benutzer werden automatisch bei der Anmeldung über Microsoft erstellt. Lokale Benutzer werden manuell verwaltet.
            </Text>
          </View>

          {/* User List */}
          {isLoading ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : isError ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
              <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
              <Text style={{ fontSize: 16, color: colors.error, marginTop: 12, fontWeight: "600" }}>Fehler beim Laden</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center" }}>
                {(error as Error)?.message || "Unbekannter Fehler"}
              </Text>
              <TouchableOpacity
                style={{ marginTop: 12, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                onPress={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.background, fontWeight: "600" }}>Erneut versuchen</Text>
              </TouchableOpacity>
            </View>
          ) : users.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
              <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
              <Text style={{ fontSize: 16, color: colors.muted, marginTop: 12 }}>Keine Benutzer gefunden</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center" }}>
                Benutzer werden automatisch erstellt, wenn sich jemand anmeldet.
              </Text>
            </View>
          ) : isDesktop ? (
            renderDesktopTable()
          ) : (
            users.map((user: any) => renderUserCard(user))
          )}
        </View>
      </ScrollView>
      {/* Create User Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <View className="flex-1 bg-black/50 justify-end">
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
              {/* Modal Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>Neuer Benutzer</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} activeOpacity={0.7}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 16, paddingBottom: 20 }}>
                  {/* Name */}
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 }}>Name *</Text>
                    <TextInput
                      style={{
                        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                        color: colors.foreground, fontSize: 15,
                      }}
                      placeholder="z.B. Max Muster"
                      placeholderTextColor={colors.muted}
                      value={newUserName}
                      onChangeText={setNewUserName}
                    />
                  </View>

                  {/* Email */}
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 }}>E-Mail *</Text>
                    <TextInput
                      style={{
                        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                        color: colors.foreground, fontSize: 15,
                      }}
                      placeholder="max.muster@gross-ict.ch"
                      placeholderTextColor={colors.muted}
                      value={newUserEmail}
                      onChangeText={setNewUserEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Password */}
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 }}>Passwort *</Text>
                    <TextInput
                      style={{
                        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                        color: colors.foreground, fontSize: 15,
                      }}
                      placeholder="Mindestens 6 Zeichen"
                      placeholderTextColor={colors.muted}
                      value={newUserPassword}
                      onChangeText={setNewUserPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Roles */}
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>Rollen zuweisen</Text>
                    <View style={{ gap: 8 }}>
                      {Data.ROLE_DEFINITIONS.map((role) => {
                        const isSelected = newUserRoles.includes(role.key);
                        return (
                          <TouchableOpacity
                            key={role.key}
                            style={{
                              flexDirection: "row", alignItems: "center",
                              padding: 12, borderRadius: 10,
                              backgroundColor: isSelected ? role.color + "15" : colors.surface,
                              borderWidth: 1, borderColor: isSelected ? role.color + "50" : colors.border,
                            }}
                            activeOpacity={0.7}
                            onPress={() => toggleNewUserRole(role.key)}
                          >
                            <View style={{
                              width: 22, height: 22, borderRadius: 6,
                              borderWidth: 2, borderColor: isSelected ? role.color : colors.muted,
                              backgroundColor: isSelected ? role.color : "transparent",
                              alignItems: "center", justifyContent: "center", marginRight: 12,
                            }}>
                              {isSelected && <IconSymbol name="checkmark" size={12} color="#FFF" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: "600", color: isSelected ? role.color : colors.foreground }}>
                                {role.label}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{role.description}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Provider hint */}
                  <View style={{ backgroundColor: "#6B728010", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <IconSymbol name="person.fill.badge.plus" size={14} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: colors.muted, flex: 1 }}>Dieser Benutzer wird als lokaler Benutzer erstellt.</Text>
                  </View>
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                    paddingVertical: 12, borderRadius: 12, alignItems: "center",
                  }}
                  onPress={() => setShowCreateModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontWeight: "600", color: colors.foreground, fontSize: 14 }}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1, backgroundColor: colors.primary,
                    paddingVertical: 12, borderRadius: 12, alignItems: "center",
                    opacity: (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) ? 0.5 : 1,
                  }}
                  onPress={handleCreateUser}
                  activeOpacity={0.8}
                  disabled={!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()}
                >
                  {createUserMutation.isPending ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={{ fontWeight: "700", color: colors.background, fontSize: 14 }}>Erstellen</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

// ── Abwesenheiten: Ferien & Krankheit verwalten ──
function AbsencesCard({ colors, users }: { colors: any; users: any[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [absUserId, setAbsUserId] = useState<string | null>(null);
  const [absFrom, setAbsFrom] = useState("");
  const [absTo, setAbsTo] = useState("");
  const [absType, setAbsType] = useState("vacation");
  const [saving, setSaving] = useState(false);

  const { data: absences = [] } = useQuery({
    queryKey: ["absences"],
    queryFn: Data.getAbsences,
  });

  const toIso = (s: string) => {
    const p = s.trim().split(".");
    return p.length === 3 ? `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}` : s.trim();
  };
  const fmtCh = (iso: string) => {
    const p = String(iso).split("-");
    return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
  };

  const typeLabel = (t: string) => (t === "vacation" ? "Ferien" : t === "sick" ? "Krank" : "Abwesend");
  const typeColor = (t: string) => (t === "vacation" ? "#0EA5E9" : t === "sick" ? "#EF4444" : "#6B7280");

  const handleSave = async () => {
    if (!absUserId || !absFrom.trim() || !absTo.trim()) {
      showAlert("Fehler", "Bitte Mitarbeiter, Von- und Bis-Datum angeben.");
      return;
    }
    setSaving(true);
    try {
      await Data.createAbsence({
        user_id: absUserId,
        start_date: toIso(absFrom),
        end_date: toIso(absTo),
        type: absType,
      });
      setShowForm(false); setAbsUserId(null); setAbsFrom(""); setAbsTo(""); setAbsType("vacation");
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      showToast("Abwesenheit erfasst");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Abwesenheiten (Ferien & Krankheit)</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary + "15", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
          onPress={() => setShowForm(!showForm)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{showForm ? "Schliessen" : "+ Erfassen"}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={{ gap: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {users.map((u: any) => (
              <TouchableOpacity
                key={u.id}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1,
                  borderColor: absUserId === u.id ? colors.primary : colors.border,
                  backgroundColor: absUserId === u.id ? colors.primary + "15" : colors.background,
                }}
                onPress={() => setAbsUserId(u.id)}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: absUserId === u.id ? colors.primary : colors.foreground }}>
                  {u.name || u.email}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, fontSize: 13 }}
              placeholder="Von (DD.MM.YYYY)" placeholderTextColor={colors.muted}
              value={absFrom} onChangeText={setAbsFrom}
            />
            <TextInput
              style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, fontSize: 13 }}
              placeholder="Bis (DD.MM.YYYY)" placeholderTextColor={colors.muted}
              value={absTo} onChangeText={setAbsTo}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[["vacation", "Ferien"], ["sick", "Krank"], ["other", "Anderes"]].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={{
                  flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1, alignItems: "center",
                  borderColor: absType === key ? typeColor(key) : colors.border,
                  backgroundColor: absType === key ? typeColor(key) + "15" : colors.background,
                }}
                onPress={() => setAbsType(key)}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: absType === key ? typeColor(key) : colors.foreground }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, paddingVertical: 9, borderRadius: 8, alignItems: "center" }}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color={colors.background} /> : (
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.background }}>Speichern</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {(absences as any[]).length === 0 ? (
        <Text style={{ fontSize: 12, color: colors.muted }}>Keine Abwesenheiten erfasst.</Text>
      ) : (
        (absences as any[]).map((a: any) => {
          const current = a.start_date <= today && a.end_date >= today;
          return (
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 }}>
              <View style={{ backgroundColor: typeColor(a.type) + "18", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: typeColor(a.type) }}>{typeLabel(a.type).toUpperCase()}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }} numberOfLines={1}>
                {a.user?.name || a.user?.email || "?"} · {fmtCh(a.start_date)} – {fmtCh(a.end_date)}
                {current ? "  (aktuell abwesend)" : ""}
              </Text>
              <TouchableOpacity
                onPress={() => showConfirm("Löschen", "Abwesenheit entfernen?", async () => {
                  await Data.deleteAbsence(a.id);
                  queryClient.invalidateQueries({ queryKey: ["absences"] });
                }, "Löschen")}
                activeOpacity={0.7}
              >
                <IconSymbol name="trash.fill" size={14} color={colors.error} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}
