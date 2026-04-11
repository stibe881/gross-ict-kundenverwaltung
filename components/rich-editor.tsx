import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput, Platform, ScrollView } from "react-native";
import { IconSymbol } from "./ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { showToast } from "./toast-provider";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

// Fallback for native devices
const DefaultNativeEditor = ({ value, onChange, placeholder, minHeight }: RichEditorProps) => {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
        Der Rich-Text Editor ist aufgrund erweiterter Formatierungen nur am Computer (Web-Version) vollumfänglich verfügbar. Auf mobilen Geräten sehen Sie stattdessen die rohe HTML-Ansicht.
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.background,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.foreground,
          padding: 12,
          fontSize: 14,
          minHeight: minHeight || 200,
          textAlignVertical: "top",
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
        multiline
      />
    </View>
  );
};

export function RichEditor(props: RichEditorProps) {
  if (Platform.OS !== "web") {
    return <DefaultNativeEditor {...props} />;
  }

  // Web-only implementation using contentEditable
  const colors = useColors();
  const editorRef = useRef<any>(null);
  const [htmlContent, setHtmlContent] = useState(props.value || "");
  const [isUploading, setIsUploading] = useState(false);

  // Sync prop changes that come from outside (e.g. loading data)
  useEffect(() => {
    if (props.value !== htmlContent && editorRef.current) {
      if (editorRef.current.innerHTML !== props.value) {
        editorRef.current.innerHTML = props.value || "";
        setHtmlContent(props.value || "");
      }
    }
  }, [props.value]);

  const exec = (command: string, arg?: string) => {
    if (typeof document !== "undefined") {
      document.execCommand(command, false, arg);
      editorRef.current?.focus();
      handleInput();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setHtmlContent(html);
      props.onChange(html);
    }
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true, // we use base64 heavily to avoid extra storage complexity for newsletter drafts, but we could also upload it.
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const asset = result.assets[0];
        
        // Inline base64 for newsletters is the easiest approach for self-contained emails without external hosting dependencies
        const base64Url = `data:image/jpeg;base64,${asset.base64}`;
        exec("insertImage", base64Url);
      }
    } catch (e: any) {
      showToast("Bilder-Upload fehlgeschlagen");
    } finally {
      setIsUploading(false);
    }
  };

  const insertLink = () => {
    const url = window.prompt("URL eingeben:", "https://");
    if (url) {
      exec("createLink", url);
    }
  };

  const ToolbarButton = ({ icon, onPress, label, isActive = false }: { icon: any, onPress: () => void, label?: string, isActive?: boolean }) => (
    <TouchableOpacity
      style={{
        padding: 8,
        borderRadius: 8,
        backgroundColor: isActive ? colors.primary + "20" : "transparent",
        flexDirection: "row",
        alignItems: "center",
        gap: 4
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <IconSymbol name={icon} size={16} color={isActive ? colors.primary : colors.foreground} />
      {label && <Text style={{ fontSize: 12, fontWeight: "600", color: isActive ? colors.primary : colors.foreground }}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={{
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.surface
    }}>
      {/* Toolbar */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.background + "80",
        }}
        contentContainerStyle={{ padding: 6, gap: 4 }}
      >
        <ToolbarButton icon="textformat.size" onPress={() => exec("formatBlock", "H2")} label="H2" />
        <ToolbarButton icon="textformat.size" onPress={() => exec("formatBlock", "H3")} label="H3" />
        <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 6, marginHorizontal: 4 }} />
        <ToolbarButton icon="bold" onPress={() => exec("bold")} />
        <ToolbarButton icon="italic" onPress={() => exec("italic")} />
        <ToolbarButton icon="underline" onPress={() => exec("underline")} />
        <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 6, marginHorizontal: 4 }} />
        <ToolbarButton icon="list.bullet" onPress={() => exec("insertUnorderedList")} />
        <ToolbarButton icon="list.number" onPress={() => exec("insertOrderedList")} />
        <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 6, marginHorizontal: 4 }} />
        <ToolbarButton icon="link" onPress={insertLink} />
        <ToolbarButton icon="photo.fill" onPress={handleImageUpload} />
      </ScrollView>

      {/* Editor Area */}
      <View style={{ padding: 16 }}>
        {/* React Native Web allows direct DOM element mapping via createElement, but using a standard div in a generic way inside Platform.OS==="web" is cleaner. */}
        {React.createElement("div", {
          ref: editorRef,
          contentEditable: true,
          style: {
            outline: "none",
            minHeight: props.minHeight || 250,
            color: colors.foreground,
            fontSize: "15px",
            lineHeight: "1.6",
            fontFamily: "system-ui, -apple-system, sans-serif"
          },
          onInput: handleInput,
          onBlur: handleInput,
          dangerouslySetInnerHTML: { __html: htmlContent }
        })}
      </View>
    </View>
  );
}
