import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";

export default function TasksScreen() {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const { taskId } = useLocalSearchParams();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: Data.getTasks,
  });

  useEffect(() => {
    if (taskId && tasks.length > 0) {
      const foundTask = tasks.find((t: any) => t.id === taskId);
      if (foundTask && selectedTask?.id !== foundTask.id) {
        setSelectedTask(foundTask);
        setShowTaskModal(true);
      }
    }
  }, [taskId, tasks]);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: Data.getAllUsers,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return colors.error;
      case "in_progress": return colors.primary;
      case "completed": return colors.success;
      default: return colors.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Offen";
      case "in_progress": return "In Bearbeitung";
      case "completed": return "Erledigt";
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ padding: 20, paddingTop: Platform.OS === "android" ? 40 : 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8, backgroundColor: colors.surface, borderRadius: 12 }}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>Aufgaben</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setSelectedTask(null);
            setShowTaskModal(true);
          }}
          style={{ backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="plus" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 100 }}>
        {tasks.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <IconSymbol name="checklist" size={48} color={colors.muted} />
            <Text style={{ marginTop: 16, fontSize: 16, color: colors.muted, textAlign: "center" }}>Keine Aufgaben gefunden.</Text>
          </View>
        ) : (
          tasks.map((task: any) => (
            <TouchableOpacity
              key={task.id}
              onPress={() => {
                setSelectedTask(task);
                setShowTaskModal(true);
              }}
              style={{
                backgroundColor: colors.surface,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{task.title}</Text>
                  {task.description ? (
                    <Text numberOfLines={2} style={{ fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 }}>{task.description}</Text>
                  ) : null}
                </View>
                <View style={{ backgroundColor: getStatusColor(task.status) + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: getStatusColor(task.status), fontSize: 11, fontWeight: "700" }}>{getStatusLabel(task.status)}</Text>
                </View>
              </View>
              
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <IconSymbol name="person.fill" size={12} color={colors.muted} />
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "500" }}>
                    {task.assigned_to ? task.assigned_user?.name || "Zugewiesen" : "Nicht zugewiesen"}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {new Date(task.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {showTaskModal && (
        <TaskFormModal
          task={selectedTask}
          users={users}
          onClose={() => setShowTaskModal(false)}
        />
      )}
    </ScreenContainer>
  );
}

function TaskFormModal({ task, users, onClose }: { task: any; users: any[]; onClose: () => void }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState(task?.status || "open");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || "");
  
  const [showUserPicker, setShowUserPicker] = useState(false);

  const createMutation = useMutation({
    mutationFn: Data.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err: any) => showAlert("Fehler", err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => Data.updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err: any) => showAlert("Fehler", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: Data.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err: any) => showAlert("Fehler", err.message),
  });

  const handleSave = () => {
    if (!title.trim()) {
      showAlert("Fehler", "Bitte geben Sie einen Titel ein.");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      status,
      assigned_to: assignedTo || null,
    };

    const didUnassignToAssign = !task?.assigned_to && assignedTo;
    const assignedUserChanged = task?.assigned_to && assignedTo && task.assigned_to !== assignedTo;
    
    const triggerPushIfNeeded = (savedTask: any) => {
      if (assignedTo && (didUnassignToAssign || assignedUserChanged || !isEditing)) {
        Data.triggerPushNotification(
          [assignedTo],
          "admin",
          "Neue Aufgabe zugewiesen",
          `Dir wurde die Aufgabe "${payload.title}" zugewiesen.`,
          { type: "task_assigned", taskId: savedTask.id, url: `/tasks?taskId=${savedTask.id}` }
        ).catch(console.warn);
      }
    };

    if (isEditing) {
      updateMutation.mutate({ id: task.id, updates: payload }, {
        onSuccess: (data) => triggerPushIfNeeded(data || task)
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: (data) => triggerPushIfNeeded(data)
      });
    }
  };

  const handleDelete = () => {
    showConfirm(
      "Aufgabe löschen",
      "Soll diese Aufgabe unwiderruflich gelöscht werden?",
      () => deleteMutation.mutate(task.id),
      "Löschen"
    );
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const statusOptions = [
    { value: "open", label: "Offen", color: colors.error },
    { value: "in_progress", label: "In Bearbeitung", color: colors.primary },
    { value: "completed", label: "Erledigt", color: colors.success },
  ];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          {showUserPicker ? (
             <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", flex: 1 }}>
               <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Zugewiesen an</Text>
                  <TouchableOpacity onPress={() => setShowUserPicker(false)} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 12 }}>
                    <IconSymbol name="xmark" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                  <TouchableOpacity 
                    onPress={() => { setAssignedTo(""); setShowUserPicker(false); }}
                    style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 16 }}>Nicht zugewiesen</Text>
                    {assignedTo === "" && <IconSymbol name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                  {(users || []).map((u: any) => (
                    <TouchableOpacity 
                      key={u.id}
                      onPress={() => { setAssignedTo(u.id); setShowUserPicker(false); }}
                      style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 16 }}>{u.name || u.email}</Text>
                      {assignedTo === u.id && <IconSymbol name="checkmark" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
             </View>
          ) : (
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", flex: 1 }}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>
                  {isEditing ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
                </Text>
                <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 12 }}>
                  <IconSymbol name="xmark" size={20} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Titel *</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Aufgabentitel"
                    placeholderTextColor={colors.muted}
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border }}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Beschreibung</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Zusätzliche Details..."
                    placeholderTextColor={colors.muted}
                    multiline
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 16, borderRadius: 12, fontSize: 16, minHeight: 100, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border }}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Status</Text>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {statusOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setStatus(opt.value)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: status === opt.value ? opt.color : colors.border,
                          backgroundColor: status === opt.value ? opt.color + "15" : colors.surface,
                        }}
                      >
                        <Text style={{ color: status === opt.value ? opt.color : colors.muted, fontWeight: "600" }}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Zuweisen an</Text>
                  <TouchableOpacity
                    onPress={() => setShowUserPicker(true)}
                    style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 16, color: assignedTo ? colors.foreground : colors.muted }}>
                      {assignedTo ? (users || []).find((u: any) => u.id === assignedTo)?.name || "Benutzer" : "Nicht zugewiesen"}
                    </Text>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* Footer Buttons */}
              <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", gap: 12 }}>
                {isEditing && (
                  <TouchableOpacity
                    onPress={handleDelete}
                    disabled={deleteMutation.isPending}
                    style={{ padding: 16, backgroundColor: colors.error + "20", borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                  >
                    {deleteMutation.isPending ? <ActivityIndicator color={colors.error} /> : <IconSymbol name="trash.fill" size={20} color={colors.error} />}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isSaving}
                  style={{ flex: 1, backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                >
                  {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>Speichern</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
