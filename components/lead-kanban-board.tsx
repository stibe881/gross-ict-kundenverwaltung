import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency } from "@/lib/format";

type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

interface Lead {
  id: number;
  name: string;
  company: string;
  value: number;
  status: LeadStatus;
}

interface LeadKanbanBoardProps {
  leads: Lead[];
  onStatusChange: (leadId: number, newStatus: LeadStatus) => void;
  onLeadPress: (lead: Lead) => void;
}

const COLUMN_WIDTH = 280;
const CARD_HEIGHT = 120;

export function LeadKanbanBoard({ leads, onStatusChange, onLeadPress }: LeadKanbanBoardProps) {
  const colors = useColors();

  const columns: { status: LeadStatus; label: string; color: string }[] = [
    { status: "new", label: "Neu", color: colors.muted },
    { status: "contacted", label: "Kontaktiert", color: "#3B82F6" },
    { status: "qualified", label: "Qualifiziert", color: "#8B5CF6" },
    { status: "proposal", label: "Angebot", color: "#F59E0B" },
    { status: "won", label: "Gewonnen", color: colors.success },
    { status: "lost", label: "Verloren", color: colors.error },
  ];

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
      <View className="flex-row gap-4 p-4">
        {columns.map((column) => (
          <View key={column.status} style={{ width: COLUMN_WIDTH }}>
            {/* Column Header */}
            <View
              className="p-3 rounded-lg mb-3"
              style={{ backgroundColor: `${column.color}20`, borderColor: column.color, borderWidth: 1 }}
            >
              <Text className="text-sm font-semibold" style={{ color: column.color }}>
                {column.label}
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.muted }}>
                {getLeadsByStatus(column.status).length} Leads
              </Text>
            </View>

            {/* Lead Cards */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {getLeadsByStatus(column.status).map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onPress={() => onLeadPress(lead)}
                  onStatusChange={onStatusChange}
                  columns={columns}
                  colors={colors}
                />
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
  onStatusChange: (leadId: number, newStatus: LeadStatus) => void;
  columns: { status: LeadStatus; label: string; color: string }[];
  colors: any;
}

function LeadCard({ lead, onPress, onStatusChange, columns, colors }: LeadCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [isDragging, setIsDragging] = useState(false);

  const gesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(setIsDragging)(true);
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      // Calculate which column the card was dropped on
      const columnIndex = Math.floor((event.absoluteX) / (COLUMN_WIDTH + 16));
      const targetColumn = columns[Math.max(0, Math.min(columnIndex, columns.length - 1))];

      if (targetColumn && targetColumn.status !== lead.status) {
        runOnJS(onStatusChange)(lead.id, targetColumn.status);
      }

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      runOnJS(setIsDragging)(false);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: isDragging ? 1.05 : 1 },
    ],
    zIndex: isDragging ? 999 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          className="p-4 rounded-lg mb-3"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            opacity: isDragging ? 0.8 : 1,
          }}
        >
          <Text className="text-base font-semibold mb-1" style={{ color: colors.foreground }}>
            {lead.name}
          </Text>
          <Text className="text-sm mb-2" style={{ color: colors.muted }}>
            {lead.company}
          </Text>
          <Text className="text-lg font-bold" style={{ color: colors.success }}>
            {formatCurrency(lead.value)}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}
