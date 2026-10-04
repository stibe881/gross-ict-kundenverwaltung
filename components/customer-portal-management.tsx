import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "./ui/icon-symbol";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

interface CustomerPortalUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "user" | "admin";
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

interface CustomerPortalManagementProps {
  customerId: string;
  portalEnabled: boolean;
  onPortalToggle: (enabled: boolean) => void;
}

export function CustomerPortalManagement({
  customerId,
  portalEnabled,
  onPortalToggle,
}: CustomerPortalManagementProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    role: "user" as "user" | "admin",
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["customerPortalUsers", customerId],
    queryFn: () => Data.getCustomerPortalUsers(customerId),
    enabled: portalEnabled,
  });

  const createUser = useMutation({
    mutationFn: (user: any) => Data.createCustomerPortalUser({ ...user, customer_id: customerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerPortalUsers", customerId] });
      setNewUser({ email: "", firstName: "", lastName: "", password: "", role: "user" });
      setShowAddUserModal(false);
      showAlert("Erfolg", "Benutzer wurde erstellt");
    },
    onError: (error: any) => {
      showAlert("Fehler", error.message);
    }
  });

  const toggleUserActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string, is_active: boolean }) => Data.updateCustomerPortalUser(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerPortalUsers", customerId] });
    },
    onError: (error: any) => {
      showAlert("Fehler", error.message);
    }
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => Data.deleteCustomerPortalUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerPortalUsers", customerId] });
      showToast("Benutzer wurde gelöscht");
    },
    onError: (error: any) => {
      showAlert("Fehler", error.message);
    }
  });

  const handleAddUser = () => {
    createUser.mutate({
      email: newUser.email,
      first_name: newUser.firstName,
      last_name: newUser.lastName,
      password_hash: newUser.password,
      role: newUser.role,
      is_active: true
    });
  };

  const handleToggleUserActive = (userId: string, isActive: boolean) => {
    toggleUserActive.mutate({ id: userId, is_active: isActive });
  };

  const handleDeleteUser = (userId: string) => {
    showConfirm(
      "Benutzer löschen",
      "Möchten Sie diesen Benutzer wirklich löschen?",
      () => deleteUser.mutate(userId),
      "Löschen"
    );
  };

  return (
    <View className="gap-4">
      {/* Portal-Einstellungen */}
      <View className="bg-surface p-4 rounded-lg border border-border">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-base font-semibold text-foreground">
            Kunden-Portal
          </Text>
          <Switch
            value={portalEnabled}
            onValueChange={onPortalToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>
        <Text className="text-sm text-muted">
          Ermöglicht Kunden den Zugriff auf ihre Tickets über ein Web-Portal
        </Text>
      </View>

      {portalEnabled && (
        <>
          {/* Benutzer-Liste */}
          <View className="bg-surface p-4 rounded-lg border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-semibold text-foreground">
                Portal-Benutzer
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddUserModal(true)}
                style={{ backgroundColor: colors.primary }}
                className="px-4 py-2 rounded-lg"
              >
                <Text className="text-background font-semibold">
                  + Benutzer
                </Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : users.length === 0 ? (
              <Text className="text-sm text-muted text-center py-4">
                Noch keine Benutzer erstellt
              </Text>
            ) : (
              <View className="gap-2">
                {users.map((user) => (
                  <View
                    key={user.id}
                    className="bg-background p-3 rounded-lg border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">
                          {user.first_name} {user.last_name}
                        </Text>
                        <Text className="text-xs text-muted">{user.email}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View
                          style={{
                            backgroundColor:
                              user.role === "admin"
                                ? colors.primary + "20"
                                : colors.border,
                          }}
                          className="px-2 py-1 rounded"
                        >
                          <Text
                            style={{
                              color:
                                user.role === "admin"
                                  ? colors.primary
                                  : colors.muted,
                            }}
                            className="text-xs font-semibold"
                          >
                            {user.role === "admin" ? "Admin" : "Benutzer"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">
                        {user.last_login
                          ? `Letzter Login: ${(() => { const d = new Date(user.last_login); return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`; })()}`
                          : "Noch nie eingeloggt"}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <Switch
                          value={!!user.is_active}
                          onValueChange={(value) =>
                            handleToggleUserActive(user.id, value)
                          }
                          trackColor={{ false: colors.border, true: colors.primary }}
                          thumbColor={colors.background}
                        />
                        <TouchableOpacity
                          onPress={() => handleDeleteUser(user.id)}
                        >
                          <IconSymbol
                            name="trash.fill"
                            size={20}
                            color={colors.error}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Info-Box */}
          <View
            style={{
              backgroundColor: colors.primary + "10",
              borderColor: colors.primary + "30",
            }}
            className="p-4 rounded-lg border"
          >
            <Text className="text-sm text-foreground font-semibold mb-2">
              Benutzerrollen
            </Text>
            <Text className="text-sm text-muted mb-1">
              • <Text className="font-semibold">Benutzer:</Text> Sieht nur eigene
              Tickets
            </Text>
            <Text className="text-sm text-muted">
              • <Text className="font-semibold">Administrator:</Text> Sieht alle
              Tickets der Firma
            </Text>
          </View>
        </>
      )}

      {/* Benutzer hinzufügen Modal */}
      <Modal
        visible={showAddUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddUserModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end bg-black/50">
          <View
            style={{ backgroundColor: colors.background }}
            className="rounded-t-3xl p-6 max-h-[80%]"
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                Neuer Portal-Benutzer
              </Text>
              <TouchableOpacity onPress={() => setShowAddUserModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView className="gap-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Vorname
                </Text>
                <TextInput
                  value={newUser.firstName}
                  onChangeText={(text) =>
                    setNewUser({ ...newUser, firstName: text })
                  }
                  placeholder="Max"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="p-3 rounded-lg border"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Nachname
                </Text>
                <TextInput
                  value={newUser.lastName}
                  onChangeText={(text) =>
                    setNewUser({ ...newUser, lastName: text })
                  }
                  placeholder="Mustermann"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="p-3 rounded-lg border"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  E-Mail
                </Text>
                <TextInput
                  value={newUser.email}
                  onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                  placeholder="max@firma.ch"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="p-3 rounded-lg border"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Passwort
                </Text>
                <TextInput
                  value={newUser.password}
                  onChangeText={(text) =>
                    setNewUser({ ...newUser, password: text })
                  }
                  placeholder="Mindestens 8 Zeichen"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="p-3 rounded-lg border"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Rolle
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setNewUser({ ...newUser, role: "user" })}
                    style={{
                      backgroundColor:
                        newUser.role === "user"
                          ? colors.primary
                          : colors.surface,
                      borderColor:
                        newUser.role === "user" ? colors.primary : colors.border,
                    }}
                    className="flex-1 p-3 rounded-lg border"
                  >
                    <Text
                      style={{
                        color:
                          newUser.role === "user"
                            ? colors.background
                            : colors.foreground,
                      }}
                      className="text-center font-semibold"
                    >
                      Benutzer
                    </Text>
                    <Text
                      style={{
                        color:
                          newUser.role === "user"
                            ? colors.background + "CC"
                            : colors.muted,
                      }}
                      className="text-xs text-center mt-1"
                    >
                      Nur eigene Tickets
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setNewUser({ ...newUser, role: "admin" })}
                    style={{
                      backgroundColor:
                        newUser.role === "admin"
                          ? colors.primary
                          : colors.surface,
                      borderColor:
                        newUser.role === "admin" ? colors.primary : colors.border,
                    }}
                    className="flex-1 p-3 rounded-lg border"
                  >
                    <Text
                      style={{
                        color:
                          newUser.role === "admin"
                            ? colors.background
                            : colors.foreground,
                      }}
                      className="text-center font-semibold"
                    >
                      Administrator
                    </Text>
                    <Text
                      style={{
                        color:
                          newUser.role === "admin"
                            ? colors.background + "CC"
                            : colors.muted,
                      }}
                      className="text-xs text-center mt-1"
                    >
                      Alle Firmen-Tickets
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleAddUser}
                style={{ backgroundColor: colors.primary }}
                className="p-4 rounded-lg mt-4"
                disabled={
                  !newUser.email ||
                  !newUser.firstName ||
                  !newUser.lastName ||
                  !newUser.password ||
                  newUser.password.length < 8 ||
                  createUser.isPending
                }
              >
                {createUser.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-background font-semibold text-center">
                    Benutzer erstellen
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
