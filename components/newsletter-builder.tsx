import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Platform, Image } from "react-native";
import { IconSymbol } from "./ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { showToast } from "./toast-provider";

export type BlockType = 'title' | 'text' | 'button' | 'image' | 'divider' | 'html' | 'columns-image-text' | 'columns-text-image' | 'row';

export interface NewsletterBlock {
  id: string;
  type: BlockType;
  titleLevel?: 1 | 2;
  text?: string;
  url?: string;
  src?: string;
  columns?: NewsletterBlock[][];
}

interface NewsletterBuilderProps {
  value: string;
  onChange: (html: string) => void;
}

export function generateBlockHtml(block: NewsletterBlock): string {
    switch (block.type) {
      case 'title':
        if (block.titleLevel === 1) {
          return `<h1 style="color: #121619; font-size: 32px; margin-top: 0; margin-bottom: 20px;">${block.text || 'Titel'}</h1>`;
        } else {
          return `<h2 style="color: #e6b24a; font-size: 22px; margin-top: 30px; margin-bottom: 15px;">${block.text || 'Titel 2'}</h2>`;
        }
      case 'text':
        return `<p style="color: #121619; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${(block.text || '').replace(/\n/g, '<br>')}</p>`;
      case 'button':
        return `<div style="margin: 25px 0; text-align: center;"><a href="${block.url || '#'}" style="display: inline-block; background-color: #e6b24a; color: #121619; padding: 14px 30px; text-decoration: none; font-weight: bold; border-radius: 6px;">${block.text || 'Klick mich'}</a></div>`;
      case 'image':
        let imgHtml = `<img src="${block.src || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=300&fit=crop'}" style="display: block; width: 100%; max-width: 100%; border-radius: 8px;" />`;
        if (block.url) {
           imgHtml = `<a href="${block.url}">${imgHtml}</a>`;
        }
        return `<div style="margin: 20px 0;">${imgHtml}</div>`;
      case 'divider':
        return `<hr style="border: none; border-top: 1px solid #a1aaaa; margin: 30px 0; opacity: 0.3;" />`;
      case 'row':
        if (!block.columns || block.columns.length === 0) return '';
        const colCount = block.columns.length;
        const widthPct = Math.floor(100 / colCount);
        let rowHtml = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;"><tr>`;
        for (let i = 0; i < colCount; i++) {
           const innerBlocks = block.columns[i] || [];
           let colHtml = innerBlocks.map(b => generateBlockHtml(b)).join('');
           rowHtml += `\n<td width="${widthPct}%" valign="top" class="stack-column" style="padding: 10px;">${colHtml}</td>`;
        }
        rowHtml += `</tr></table>`;
        return rowHtml;
      case 'html': // Legacy support
        return `<div style="margin-bottom: 20px;">${block.text || ''}</div>`;
      case 'columns-image-text':
        let leftImg = `<img src="${block.src || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=300&fit=crop'}" style="display: block; width: 100%; max-width: 100%; border-radius: 8px;" />`;
        if (block.url) leftImg = `<a href="${block.url}">${leftImg}</a>`;
        return `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
            <tr>
              <td width="48%" valign="middle" style="padding-right: 2%;">
                ${leftImg}
              </td>
              <td width="48%" valign="middle" style="padding-left: 2%;">
                <p style="color: #121619; font-size: 15px; line-height: 1.6; margin: 0;">${(block.text || '').replace(/\n/g, '<br>')}</p>
              </td>
            </tr>
          </table>
        `;
      case 'columns-text-image':
        let rightImg = `<img src="${block.src || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=300&fit=crop'}" style="display: block; width: 100%; max-width: 100%; border-radius: 8px;" />`;
        if (block.url) rightImg = `<a href="${block.url}">${rightImg}</a>`;
        return `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
            <tr>
              <td width="48%" valign="middle" style="padding-right: 2%;">
                <p style="color: #121619; font-size: 15px; line-height: 1.6; margin: 0;">${(block.text || '').replace(/\n/g, '<br>')}</p>
              </td>
              <td width="48%" valign="middle" style="padding-left: 2%;">
                ${rightImg}
              </td>
            </tr>
          </table>
        `;
      default:
        return '';
    }
}

// Generiert HTML aus den Blöcken
export function generateNewsletterHtml(blocks: NewsletterBlock[], bgColor: string = '#fbf8f6', fullWidth: boolean = false): string {
  const jsonStr = JSON.stringify({ bgColor, fullWidth, blocks });
  // Base64 encoding for safe transport inside HTML comment
  let base64Json = '';
  try {
    if (typeof window !== 'undefined' && window.btoa) {
      base64Json = window.btoa(unescape(encodeURIComponent(jsonStr)));
    } else {
      // Basic fallback
      base64Json = JSON.stringify(jsonStr); 
    }
  } catch (e) {
    console.error("Base64 error", e);
  }
  
  const builderDataComment = `<!-- BUILDER_DATA:${base64Json} -->`;

  let innerHtml = '';
  for (const block of blocks) {
     innerHtml += generateBlockHtml(block);
  }

  return `${builderDataComment}
<style>
  @media only screen and (max-width: 600px) {
    .stack-column { display: block !important; width: 100% !important; box-sizing: border-box; padding: 10px 0 !important; }
  }
</style>
<div style="background-color: ${bgColor}; padding: 40px 20px; font-family: 'Segoe UI', Arial, sans-serif;">
  <div style="max-width: ${fullWidth ? '100%' : '600px'}; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: ${fullWidth ? '20px' : '40px'}; box-shadow: 0 4px 10px rgba(18,22,25,0.05); overflow: hidden;">
    ${innerHtml}
  </div>
</div>`;
}

// Parst HTML zu Blöcken
export function parseHtmlToBlocks(html: string): { bgColor: string, fullWidth?: boolean, blocks: NewsletterBlock[] } {
  if (!html) return { bgColor: '#fbf8f6', fullWidth: false, blocks: [] };
  
  const match = html.match(/<!-- BUILDER_DATA:(.*?) -->/);
  if (match && match[1]) {
    try {
      let decoded = '';
      if (typeof window !== 'undefined' && window.atob) {
        decoded = decodeURIComponent(escape(window.atob(match[1])));
      } else {
        decoded = JSON.parse(match[1]);
      }
      return JSON.parse(decoded);
    } catch(e) {
      console.warn("Failed to parse builder data", e);
    }
  }
  
  // Fallback für alte HTML Templates
  return { bgColor: '#fbf8f6', blocks: [{ id: Date.now().toString(), type: 'html', text: html }] };
}

// Helper for deep tree manipulation
export function updateNodeInTree(nodes: NewsletterBlock[], id: string, updater: (b: NewsletterBlock) => Partial<NewsletterBlock>): NewsletterBlock[] {
  return nodes.map(n => {
     if (n.id === id) return { ...n, ...updater(n) };
     if (n.columns) return { ...n, columns: n.columns.map(col => updateNodeInTree(col, id, updater)) };
     return n;
  });
}

export function removeNodeFromTree(nodes: NewsletterBlock[], id: string): NewsletterBlock[] {
  return nodes.filter(n => n.id !== id).map(n => {
     if (n.columns) return { ...n, columns: n.columns.map(col => removeNodeFromTree(col, id)) };
     return n;
  });
}

export function addNodeToTree(nodes: NewsletterBlock[], newBlock: NewsletterBlock, parentId?: string, colIndex?: number): NewsletterBlock[] {
  if (!parentId) return [...nodes, newBlock];
  return nodes.map(n => {
    if (n.id === parentId && n.columns && colIndex !== undefined) {
      const newCols = [...n.columns];
      newCols[colIndex] = [...(newCols[colIndex] || []), newBlock];
      return { ...n, columns: newCols };
    }
    if (n.columns) return { ...n, columns: n.columns.map(col => addNodeToTree(col, newBlock, parentId, colIndex)) };
    return n;
  });
}

export function moveNodeInTree(nodes: NewsletterBlock[], id: string, dir: -1 | 1): NewsletterBlock[] {
  const index = nodes.findIndex(n => n.id === id);
  if (index !== -1) {
    if (index + dir < 0 || index + dir >= nodes.length) return nodes;
    const newNodes = [...nodes];
    const temp = newNodes[index];
    newNodes[index] = newNodes[index + dir];
    newNodes[index + dir] = temp;
    return newNodes;
  }
  return nodes.map(n => {
    if (n.columns) return { ...n, columns: n.columns.map(col => moveNodeInTree(col, id, dir)) };
    return n;
  });
}

export function NewsletterBuilder({ value, onChange }: NewsletterBuilderProps) {
  const colors = useColors();
  const [bgColor, setBgColor] = useState('#fbf8f6');
  const [fullWidth, setFullWidth] = useState(false);
  const [blocks, setBlocks] = useState<NewsletterBlock[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initiale Lade-Phase
  useEffect(() => {
    const parsed = parseHtmlToBlocks(value);
    setBgColor(parsed.bgColor || '#fbf8f6');
    setFullWidth(!!parsed.fullWidth);
    setBlocks(parsed.blocks || []);
  }, [value]); // Achtung: Das überschreibt bei externem Change.

  const triggerChange = (newBlocks: NewsletterBlock[], newBg: string, newFullWidth: boolean) => {
    setBlocks(newBlocks);
    setBgColor(newBg);
    setFullWidth(newFullWidth);
    onChange(generateNewsletterHtml(newBlocks, newBg, newFullWidth));
  };

  const addBlock = (type: BlockType, parentId?: string, colIndex?: number, initialCols?: number) => {
    const newBlock: NewsletterBlock = {
      id: Math.random().toString(36).substring(7),
      type,
      titleLevel: type === 'title' ? 1 : undefined,
    };
    if (type === 'row' && initialCols) {
       newBlock.columns = Array.from({ length: initialCols }).map(() => []);
    }
    const newBlocks = addNodeToTree(blocks, newBlock, parentId, colIndex);
    triggerChange(newBlocks, bgColor, fullWidth);
  };

  const updateBlock = (id: string, updates: Partial<NewsletterBlock>) => {
    const newBlocks = updateNodeInTree(blocks, id, () => updates);
    triggerChange(newBlocks, bgColor, fullWidth);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const newBlocks = moveNodeInTree(blocks, id, dir);
    triggerChange(newBlocks, bgColor, fullWidth);
  };

  const removeBlock = (id: string) => {
    const newBlocks = removeNodeFromTree(blocks, id);
    triggerChange(newBlocks, bgColor, fullWidth);
  };

  const handleImageUpload = async (id: string) => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, base64: true });
      if (!res.canceled && res.assets[0].base64) {
        const ext = res.assets[0].uri.split('.').pop() || 'png';
        const dataUri = `data:image/${ext};base64,${res.assets[0].base64}`;
        updateBlock(id, { src: dataUri });
      }
    } catch (e: any) {
      showToast("Bild-Upload fehlgeschlagen");
    }
  };

  const ToolbarButton = ({ icon, label, onPress }: { icon: any, label: string, onPress: () => void }) => (
    <TouchableOpacity 
      style={{ alignItems: "center", justifyContent: "center", padding: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, minWidth: 80 }}
      onPress={onPress}
    >
      <IconSymbol name={icon} size={20} color={colors.foreground} />
      <Text style={{ fontSize: 11, color: colors.foreground, marginTop: 4 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 20 }}>
      {/* Editor Panel */}
      <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
           <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Layout & Blöcke</Text>
           <TouchableOpacity 
             onPress={() => triggerChange(blocks, bgColor, !fullWidth)}
             style={{ backgroundColor: fullWidth ? colors.primary : colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: fullWidth ? colors.primary : colors.border }}
           >
             <Text style={{ fontSize: 11, fontWeight: "700", color: fullWidth ? "#fff" : colors.muted }}>{fullWidth ? "GANZE BREITE (100%)" : "ZENTRIERT (600px)"}</Text>
           </TouchableOpacity>
        </View>
        
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          <ToolbarButton icon="textformat.size" label="Titel" onPress={() => addBlock('title')} />
          <ToolbarButton icon="text.alignleft" label="Text" onPress={() => addBlock('text')} />
          <ToolbarButton icon="photo.fill" label="Bild" onPress={() => addBlock('image')} />
          <ToolbarButton icon="link" label="Button" onPress={() => addBlock('button')} />
          <ToolbarButton icon="minus" label="Trennlinie" onPress={() => addBlock('divider')} />
          <ToolbarButton icon="rectangle.split.3x1" label="Zeile (Leere Spalten)" onPress={() => addBlock('row', undefined, undefined, 2)} />
          <ToolbarButton icon="rectangle.split.2x1" label="Spalte: Bild / Text" onPress={() => addBlock('columns-image-text')} />
          <ToolbarButton icon="rectangle.split.2x1" label="Spalte: Text / Bild" onPress={() => addBlock('columns-text-image')} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
          {blocks.length === 0 && (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20 }}>Noch keine Blöcke vorhanden. Klicke oben auf einen Block, um zu starten.</Text>
          )}
          {blocks.map((block, index) => (
            <View key={block.id} style={{ backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
              
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary, textTransform: "uppercase" }}>{block.type}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity onPress={() => moveBlock(block.id, -1)} style={{ padding: 4 }}>
                    <IconSymbol name="arrow.up" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveBlock(block.id, 1)} style={{ padding: 4 }}>
                    <IconSymbol name="arrow.down" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeBlock(block.id)} style={{ padding: 4 }}>
                    <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row Block Controls */}
              {block.type === 'row' && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Spalten konfigurieren</Text>
                  {(!block.columns || block.columns.length === 0) ? (
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4].map(num => (
                        <TouchableOpacity key={num} onPress={() => updateBlock(block.id, { columns: Array.from({ length: num }).map(() => []) })} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ color: colors.foreground, fontSize: 13 }}>{num} Spalte{num > 1 ? 'n' : ''}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {block.columns.map((col, colIndex) => (
                         <View key={colIndex} style={{ padding: 10, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
                            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8, fontWeight: '700' }}>SPALTE {colIndex + 1}</Text>
                            <View style={{ gap: 8, marginBottom: col.length > 0 ? 12 : 0 }}>
                               {col.map((innerBlock, innerIndex) => (
                                   <View key={innerBlock.id} style={{ backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
                                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                        <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary, textTransform: "uppercase" }}>{innerBlock.type}</Text>
                                        <View style={{ flexDirection: "row", gap: 6 }}>
                                          <TouchableOpacity onPress={() => moveBlock(innerBlock.id, -1)} style={{ padding: 2 }}>
                                            <IconSymbol name="arrow.up" size={14} color={colors.foreground} />
                                          </TouchableOpacity>
                                          <TouchableOpacity onPress={() => moveBlock(innerBlock.id, 1)} style={{ padding: 2 }}>
                                            <IconSymbol name="arrow.down" size={14} color={colors.foreground} />
                                          </TouchableOpacity>
                                          <TouchableOpacity onPress={() => removeBlock(innerBlock.id)} style={{ padding: 2 }}>
                                            <IconSymbol name="trash.fill" size={14} color="#ef4444" />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                      {/* Mini Block Input Editor */}
                                      {innerBlock.type === 'text' && (
                                         <TextInput style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border, minHeight: 80, textAlignVertical: "top" }} placeholder="Spaltentext..." placeholderTextColor={colors.muted} value={innerBlock.text || ""} onChangeText={t => updateBlock(innerBlock.id, { text: t })} multiline />
                                      )}
                                      {innerBlock.type === 'title' && (
                                         <TextInput style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }} placeholder="Spaltentitel..." placeholderTextColor={colors.muted} value={innerBlock.text || ""} onChangeText={t => updateBlock(innerBlock.id, { text: t })} />
                                      )}
                                      {innerBlock.type === 'image' && (
                                         <View style={{ gap: 8 }}>
                                           {innerBlock.src && <View style={{ height: 60, backgroundColor: colors.surface, borderRadius: 6, overflow: "hidden" }}><Image source={{ uri: innerBlock.src }} style={{ width: "100%", height: "100%" }} /></View>}
                                           <TouchableOpacity style={{ padding: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignItems: "center" }} onPress={() => handleImageUpload(innerBlock.id)}><Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 11 }}>Bild Hochladen</Text></TouchableOpacity>
                                         </View>
                                      )}
                                      {innerBlock.type === 'button' && (
                                         <View style={{ gap: 8 }}>
                                           <TextInput style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }} placeholder="Button Text" placeholderTextColor={colors.muted} value={innerBlock.text || ""} onChangeText={t => updateBlock(innerBlock.id, { text: t })} />
                                           <TextInput style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }} placeholder="Button URL" placeholderTextColor={colors.muted} value={innerBlock.url || ""} onChangeText={t => updateBlock(innerBlock.id, { url: t })} />
                                         </View>
                                      )}
                                   </View>
                               ))}
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                               <ToolbarButton icon="textformat.size" label="Titel" onPress={() => addBlock('title', block.id, colIndex)} />
                               <ToolbarButton icon="text.alignleft" label="Text" onPress={() => addBlock('text', block.id, colIndex)} />
                               <ToolbarButton icon="photo.fill" label="Bild" onPress={() => addBlock('image', block.id, colIndex)} />
                               <ToolbarButton icon="link" label="Button" onPress={() => addBlock('button', block.id, colIndex)} />
                            </View>
                         </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Specific Block Controls */}
              {block.type === 'title' && (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity onPress={() => updateBlock(block.id, { titleLevel: 1 })} style={{ padding: 6, backgroundColor: block.titleLevel === 1 ? colors.primary : colors.surface, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: block.titleLevel === 1 ? '#fff' : colors.foreground, fontSize: 12, fontWeight: "600" }}>H1 Groß</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => updateBlock(block.id, { titleLevel: 2 })} style={{ padding: 6, backgroundColor: block.titleLevel === 2 ? colors.primary : colors.surface, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: block.titleLevel === 2 ? '#fff' : colors.foreground, fontSize: 12, fontWeight: "600" }}>H2 Mittel</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Titeltext..."
                    placeholderTextColor={colors.muted}
                    value={block.text || ""}
                    onChangeText={t => updateBlock(block.id, { text: t })}
                  />
                </View>
              )}

              {block.type === 'text' && (
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border, minHeight: 80, textAlignVertical: "top" }}
                  placeholder="Dein Text..."
                  placeholderTextColor={colors.muted}
                  value={block.text || ""}
                  onChangeText={t => updateBlock(block.id, { text: t })}
                  multiline
                />
              )}

              {block.type === 'button' && (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Button Beschriftung (z.B. Mehr erfahren)"
                    placeholderTextColor={colors.muted}
                    value={block.text || ""}
                    onChangeText={t => updateBlock(block.id, { text: t })}
                  />
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    placeholder="URL (https://...)"
                    placeholderTextColor={colors.muted}
                    value={block.url || ""}
                    onChangeText={t => updateBlock(block.id, { url: t })}
                  />
                </View>
              )}

              {block.type === 'image' && (
                <View style={{ gap: 8 }}>
                  {block.src ? (
                    <View style={{ height: 100, backgroundColor: colors.surface, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
                      <Image source={{ uri: block.src }} style={{ width: "100%", height: "100%" }} />
                    </View>
                  ) : null}
                  <TouchableOpacity 
                    style={{ padding: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignItems: "center" }}
                    onPress={() => handleImageUpload(block.id)}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Bild auswählen / Hochladen</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Bild-URL (alternativ zu Upload)"
                    placeholderTextColor={colors.muted}
                    value={block.src || ""}
                    onChangeText={t => updateBlock(block.id, { src: t })}
                  />
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Link beim Klick aufs Bild (URL)"
                    placeholderTextColor={colors.muted}
                    value={block.url || ""}
                    onChangeText={t => updateBlock(block.id, { url: t })}
                  />
                </View>
              )}

              {(block.type === 'columns-image-text' || block.type === 'columns-text-image') && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginTop: 4 }}>Bild-Bereich</Text>
                  {block.src ? (
                    <View style={{ height: 100, backgroundColor: colors.surface, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
                      <Image source={{ uri: block.src }} style={{ width: "100%", height: "100%" }} />
                    </View>
                  ) : null}
                  <TouchableOpacity 
                    style={{ padding: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignItems: "center" }}
                    onPress={() => handleImageUpload(block.id)}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Bild auswählen / Hochladen</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Bild-URL (alternativ zu Upload)"
                    placeholderTextColor={colors.muted}
                    value={block.src || ""}
                    onChangeText={t => updateBlock(block.id, { src: t })}
                  />
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Link beim Klick aufs Bild (URL)"
                    placeholderTextColor={colors.muted}
                    value={block.url || ""}
                    onChangeText={t => updateBlock(block.id, { url: t })}
                  />
                  
                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
                  
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Text-Bereich</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border, minHeight: 80, textAlignVertical: "top" }}
                    placeholder="Den passenden Text zur Spalte eingeben..."
                    placeholderTextColor={colors.muted}
                    value={block.text || ""}
                    onChangeText={t => updateBlock(block.id, { text: t })}
                    multiline
                  />
                </View>
              )}

              {block.type === 'html' && (
                <View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>Veralteter Legacy-HTML Block aus alter Vorlage. Er kann nur textuell bearbeitet werden.</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.foreground, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border, minHeight: 150, textAlignVertical: "top", fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}
                    value={block.text || ""}
                    onChangeText={t => updateBlock(block.id, { text: t })}
                    multiline
                  />
                </View>
              )}

            </View>
          ))}
        </ScrollView>
      </View>

      {/* Preview Panel (nur auf Web großartig, mobile unten) */}
      <View style={{ flex: Platform.OS === 'web' ? 1 : undefined, minHeight: 400, backgroundColor: "#e5e7eb", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        <View style={{ backgroundColor: "#1f2937", padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>E-Mail Vorschau (Live-Ansicht)</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          {Platform.OS === 'web' ? (
            <div style={{ backgroundColor: bgColor, padding: "40px 20px", fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: "100%" }}>
               <div style={{ maxWidth: fullWidth ? '100%' : 600, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 12, padding: fullWidth ? 20 : 40, boxShadow: "0 4px 10px rgba(18,22,25,0.05)", overflow: "hidden" }}>
                  {blocks.length === 0 && (
                     <div style={{ textAlign: "center", color: "#a1aaaa", padding: "40px 0" }}>Die E-Mail ist noch leer.</div>
                  )}
                  {blocks.map((block, index) => {
                     const isDragged = draggedIndex === index;
                     const isHovered = dragOverIndex === index;
                     
                     return (
                        <div
                           key={block.id}
                           draggable
                           onDragStart={(e) => setDraggedIndex(index)}
                           onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                           onDragLeave={() => { if (dragOverIndex === index) setDragOverIndex(null); }}
                           onDrop={(e) => {
                              e.preventDefault();
                              if (draggedIndex !== null && draggedIndex !== index) {
                                  const newBlocks = [...blocks];
                                  const temp = newBlocks[draggedIndex];
                                  newBlocks.splice(draggedIndex, 1);
                                  newBlocks.splice(index, 0, temp);
                                  triggerChange(newBlocks, bgColor, fullWidth);
                              }
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                           }}
                           onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                           style={{
                              opacity: isDragged ? 0.3 : 1,
                              borderTop: isHovered && draggedIndex !== null && draggedIndex > index ? "3px solid #e6b24a" : "3px solid transparent",
                              borderBottom: isHovered && draggedIndex !== null && draggedIndex < index ? "3px solid #e6b24a" : "3px solid transparent",
                              cursor: "grab",
                              position: "relative",
                              transition: "all 0.2s ease"
                           }}
                           onMouseEnter={(e) => e.currentTarget.style.outline = "2px dashed rgba(161, 170, 170, 0.4)"}
                           onMouseLeave={(e) => e.currentTarget.style.outline = "none"}
                        >
                           <div dangerouslySetInnerHTML={{ __html: generateBlockHtml(block) }} style={{ pointerEvents: "none" }} />
                        </div>
                     );
                  })}
               </div>
            </div>
          ) : (
            <View style={{ flex: 1, minHeight: 600 }}>
              <WebView 
                 originWhitelist={['*']} 
                 source={{ html: generateNewsletterHtml(blocks, bgColor, fullWidth) }} 
                 style={{ flex: 1, backgroundColor: bgColor }}
                 showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
