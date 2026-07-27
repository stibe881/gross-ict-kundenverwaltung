import { View, ViewProps, Text, TextProps } from "react-native";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("bg-surface border border-border rounded-xl p-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-lg font-bold text-foreground mb-1", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-sm text-muted mb-4", className)}
      {...props}
    />
  );
}
