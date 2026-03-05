import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase";

type UserRole = "admin" | "manager" | "accounting" | "sales" | "support";

interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

const mockUsers: User[] = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    isActive: true,
    createdAt: "2024-01-01",
  },
  {
    id: 2,
    name: "Max Manager",
    email: "max.manager@example.com",
    role: "manager",
    isActive: true,
    createdAt: "2024-02-15",
  },
  {
    id: 3,
    name: "Anna Buchhalter",
    email: "anna.buchhalter@example.com",
    role: "accounting",
    isActive: true,
    createdAt: "2024-03-20",
  },
  {
    id: 4,
    name: "Peter Vertrieb",
    email: "peter.vertrieb@example.com",
    role: "sales",
    isActive: false,
    createdAt: "2024-04-10",
  },
];

export default function UsersScreen() {
  const colors = useColors();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users] = useState<User[]>(mockUsers);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // Nur Admins dürfen diesen Screen sehen
  if ((user as any)?.role !== "admin") {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-4">
          <IconSymbol name="xmark.circle.fill" size={64} color={colors.error} />
          <Text className="text-xl font-bold text-foreground mt-4">Zugriff verweigert</Text>
          <Text className="text-base text-muted text-center mt-2">
            Sie benötigen Administrator-Rechte, um auf die Benutzerverwaltung zuzugreifen.
          </Text>
          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-lg mt-6"
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text className="text-background font-semibold">Zurück</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      admin: "Administrator",
      manager: "Manager",
      accounting: "Buchhalter",
      sales: "Vertrieb",
      support: "Support",
    };
    return labels[role];
  };

  const getRoleColor = (role: UserRole) => {
    const colorMap: Record<UserRole, string> = {
      admin: colors.error,
      manager: colors.primary,
      accounting: colors.success,
      sales: "#17A2B8",
      support: colors.warning,
    };
    return colorMap[role];
  };

  const filteredUsers =
    filter === "all"
      ? users
      : filter === "active"
        ? users.filter((u) => u.isActive)
        : users.filter((u) => !u.isActive);

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
            {!item.isActive && (
              <View className="px-2 py-0.5 rounded bg-error/20">
                <Text className="text-xs font-semibold text-error">Inaktiv</Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-muted mb-2">{item.email}</Text>
          <View
            className="px-3 py-1 rounded-full self-start"
            style={{ backgroundColor: getRoleColor(item.role) + "20" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: getRoleColor(item.role) }}
            >
              {getRoleLabel(item.role)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          className="bg-primary/20 px-3 py-2 rounded-lg"
          activeOpacity={0.7}
        >
          <Text className="text-primary text-xs font-semibold">Bearbeiten</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground">Benutzerverwaltung</Text>
          </View>
          <TouchableOpacity
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            activeOpacity={0.8}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Statistik */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-primary">
              {users.length}
            </Text>
            <Text className="text-sm text-muted">Gesamt</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-success">
              {users.filter((u) => u.isActive).length}
            </Text>
            <Text className="text-sm text-muted">Aktiv</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-error">
              {users.filter((u) => !u.isActive).length}
            </Text>
            <Text className="text-sm text-muted">Inaktiv</Text>
          </View>
        </View>

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {[
              { key: "all", label: "Alle" },
              { key: "active", label: "Aktiv" },
              { key: "inactive", label: "Inaktiv" },
            ].map((status) => (
              <TouchableOpacity
                key={status.key}
                className={`px-4 py-2 rounded-lg ${filter === status.key ? "bg-primary" : "bg-surface border border-border"
                  }`}
                onPress={() => setFilter(status.key as any)}
              >
                <Text
                  className={`font-semibold ${filter === status.key ? "text-background" : "text-foreground"
                    }`}
                >
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Benutzerliste */}
        {filteredUsers.length > 0 ? (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4">Keine Benutzer</Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
