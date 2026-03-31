const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(tabs)', 'tickets.tsx');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

const newCode = `  const { isWide } = useResponsiveLayout();

  const renderMetadataSection = () => (
    <View style={{ gap: 16 }}>
      {/* ── Info Cards ── */}
      <View style={{ gap: 10 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <IconSymbol name="person.2.fill" size={13} color={colors.muted} />
            <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Kunde</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{customerName}</Text>
        </View>

        {(!ticket.customer_id && (ticket.contact_name || ticket.contact_email)) && (
          <View style={{ backgroundColor: colors.primary + "10", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.primary + "30" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <IconSymbol name="globe" size={16} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase" }}>Gastanfrage</Text>
            </View>
            <View style={{ gap: 6 }}>
              {ticket.contact_name && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Name:</Text> {ticket.contact_name}</Text>}
              {ticket.contact_company && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Firma:</Text> {ticket.contact_company}</Text>}
              {ticket.contact_email && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>E-Mail:</Text> {ticket.contact_email}</Text>}
              {ticket.contact_phone && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Telefon:</Text> {ticket.contact_phone}</Text>}
            </View>
          </View>
        )}

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <IconSymbol name="calendar" size={13} color={colors.muted} />
              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Erstellt</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{formatDate(ticket.created_at)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, alignSelf: "flex-end" }}>{ageLabel}</Text>
        </View>
      </View>

      {/* ── Status, Priorität, Assignee ── */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Zugewiesen an</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}
            onPress={() => setShowAssignPicker(!showAssignPicker)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: assignedUser ? colors.primary : colors.muted + "30", alignItems: "center", justifyContent: "center" }}>
                {assignedUser ? (
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>
                    {(assignedUser.name || "?").split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
                  </Text>
                ) : (
                  <IconSymbol name="person.fill.badge.plus" size={12} color={colors.muted} />
                )}
              </View>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{assignedUser ? assignedUser.name : "Niemand"}</Text>
            </View>
            <IconSymbol name={showAssignPicker ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
          </TouchableOpacity>
          {showAssignPicker && (
            <View style={{ marginTop: 8, gap: 4 }}>
              <TouchableOpacity onPress={() => handleAssign(null)} style={{ paddingVertical: 8 }}><Text style={{ color: colors.muted, fontStyle: "italic" }}>Nicht zugewiesen</Text></TouchableOpacity>
              {users.map((u) => (
                <TouchableOpacity key={u.id} onPress={() => handleAssign(u.id)} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.foreground, fontWeight: assignedTo === u.id ? "700" : "400" }}>{u.name}</Text>
                  {assignedTo === u.id && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Status</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sCfg.color }} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{sCfg.label}</Text>
            </View>
            <IconSymbol name={showStatusPicker ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
          </TouchableOpacity>
          {showStatusPicker && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {statusOptions.map((opt) => (
                <TouchableOpacity key={opt.key} onPress={() => { handleStatusChange(opt.key); setShowStatusPicker(false); }} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                    <Text style={{ color: colors.foreground, fontWeight: currentStatus === opt.key ? "700" : "400" }}>{opt.label}</Text>
                  </View>
                  {currentStatus === opt.key && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />

        <View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Priorität</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}
            onPress={() => setShowPriorityPicker(!showPriorityPicker)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pCfg.color }} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{pCfg.label}</Text>
            </View>
            <IconSymbol name={showPriorityPicker ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
          </TouchableOpacity>
          {showPriorityPicker && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {priorityOptions.map((opt) => (
                <TouchableOpacity key={opt.key} onPress={() => { handlePriorityChange(opt.key); setShowPriorityPicker(false); }} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                    <Text style={{ color: colors.foreground, fontWeight: currentPriority === opt.key ? "700" : "400" }}>{opt.label}</Text>
                  </View>
                  {currentPriority === opt.key && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Footer Actions am Desktop unten rechts */}
      {isWide && renderFooterActions()}
    </View>
  );

  const renderFooterActions = () => (
    <View style={{ flexDirection: isWide ? "column" : "row", gap: 10 }}>
      {currentStatus === "closed" && (
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary + "10", borderWidth: 1, borderColor: colors.primary + "25", paddingVertical: 12, borderRadius: 12 }}
          onPress={handleCreateInvoice}
          activeOpacity={0.8}
        >
          <IconSymbol name="doc.text.fill" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Rechnung</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.error + "10", borderWidth: 1, borderColor: colors.error + "25", paddingVertical: 12, borderRadius: 12 }}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <IconSymbol name="trash.fill" size={14} color={colors.error} />
        <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>Löschen</Text>
      </TouchableOpacity>
      
      {!isWide && (
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: 12 }}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Schliessen</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMainContent = () => (
    <View style={{ gap: 16 }}>
      {/* ── Tabs (Kommentare vs Aufwände) ── */}
      <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8, backgroundColor: activeTab === "comments" ? colors.primary + "20" : "transparent" }}
          onPress={() => setActiveTab("comments")}
        >
          <Text style={{ fontSize: 13, fontWeight: activeTab === "comments" ? "700" : "500", color: activeTab === "comments" ? colors.primary : colors.muted }}>Kommentare ({comments?.length || 0})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8, backgroundColor: activeTab === "items" ? colors.primary + "20" : "transparent" }}
          onPress={() => setActiveTab("items")}
        >
          <Text style={{ fontSize: 13, fontWeight: activeTab === "items" ? "700" : "500", color: activeTab === "items" ? colors.primary : colors.muted }}>Aufwände & Positionen</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "comments" ? (
        <View>
          {ticket.description && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", marginBottom: 8 }}>Beschreibung vom {formatDate(ticket.created_at)}</Text>
              <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>{ticket.description}</Text>
            </View>
          )}
          {comments && comments.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 12 }}>
              {comments.map((c: any) => (
                <View key={c.id} style={{
                  backgroundColor: colors.surface, borderRadius: 12,
                  padding: 14, borderWidth: 1, borderColor: colors.border,
                  borderLeftWidth: 3, borderLeftColor: c.is_internal ? colors.warning : colors.success,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>
                          {(c.user_name || "S")[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                        {c.user_name || "System"}
                      </Text>
                      <View style={{
                        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                        backgroundColor: c.is_internal ? colors.warning + "18" : colors.success + "18",
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: c.is_internal ? colors.warning : colors.success }}>
                          {c.is_internal ? "INTERN" : "EXTERN"}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {formatDateTime(c.created_at)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{c.comment}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
              <IconSymbol name="doc.text.fill" size={28} color={colors.muted} />
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>Noch keine Kommentare</Text>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <TouchableOpacity
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: isInternalComment ? colors.warning + "15" : colors.success + "15",
                borderWidth: 1, borderColor: isInternalComment ? colors.warning + "30" : colors.success + "30",
              }}
              onPress={() => setIsInternalComment(!isInternalComment)}
              activeOpacity={0.7}
            >
              <IconSymbol
                name={isInternalComment ? "lock.fill" : "globe"}
                size={12}
                color={isInternalComment ? colors.warning : colors.success}
              />
              <Text style={{ fontSize: 12, fontWeight: "600", color: isInternalComment ? colors.warning : colors.success }}>
                {isInternalComment ? "Nur intern" : "Kunde sichtbar"}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: colors.muted }}>Tippen um zu wechseln</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.border,
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                color: colors.foreground, fontSize: 14,
              }}
              placeholder="Kommentar schreiben..."
              placeholderTextColor={colors.muted}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary, borderRadius: 12,
                paddingHorizontal: 16, justifyContent: "center",
                opacity: addingComment || !newComment.trim() ? 0.5 : 1,
              }}
              onPress={handleAddComment}
              activeOpacity={0.7}
              disabled={addingComment || !newComment.trim()}
            >
              {addingComment ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <IconSymbol name="paperplane.fill" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TicketItemsList
          ticketId={ticket.id}
          ticketItems={ticketItems}
          products={products}
          colors={colors}
          onRefresh={refetchTicketItems}
        />
      )}
    </View>
  );

  return (
    <Modal visible={true} animationType={isWide ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity 
           activeOpacity={1} 
           style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: isWide ? 'center' : 'flex-end', alignItems: isWide ? 'center' : 'stretch' }}
           onPress={onClose}
        >
          <TouchableOpacity activeOpacity={1} style={{ flex: isWide ? 0 : 1 }} onPress={() => {}}>
            <View 
              style={{ 
                backgroundColor: colors.background, 
                borderTopLeftRadius: 24, 
                borderTopRightRadius: 24,
                borderBottomLeftRadius: isWide ? 24 : 0,
                borderBottomRightRadius: isWide ? 24 : 0,
                width: isWide ? 900 : '100%',
                maxHeight: '92%',
                flex: 1
              }}
            >
              {/* ── Hero Header ── */}
              <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, lineHeight: 30 }}>
                    {ticket.title}
                  </Text>
                </View>
                {isWide && (
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                    <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                  </TouchableOpacity>
                )}
                {!isWide && (
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{top:10, bottom:10, left:10, right:10}} style={{ backgroundColor: colors.surface, padding: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Schliessen</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Content ── */}
              <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ padding: isWide ? 24 : 16 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ flexDirection: isWide ? "row" : "column", gap: 24 }}>
                  {/* On Mobile: Metadata first */}
                  {!isWide && renderMetadataSection()}

                  {/* Main Content (Left column on Wide) */}
                  <View style={{ flex: isWide ? 2 : undefined }}>
                    {renderMainContent()}
                  </View>

                  {/* On Wide: Metadata on the right */}
                  {isWide && (
                    <View style={{ flex: 1 }}>
                      {renderMetadataSection()}
                    </View>
                  )}
                </View>
                
                {/* On Mobile: Footer actions at the bottom of the scroll */}
                {!isWide && (
                  <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
                     {renderFooterActions()}
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
`;

const startIndex = lines.findIndex(l => l.includes('<Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>'));
const endIndex = lines.findIndex((l, index) => index > startIndex && l.includes('</Modal>'));

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find Modal block", startIndex, endIndex);
  process.exit(1);
}

// Lines where:
// startIndex corresponds to <Modal...>
// line BEFORE startIndex is `  return (`
// endIndex corresponds to `    </Modal>`
// endIndex + 1 corresponds to `  );`
// So we replace from startIndex - 1 to endIndex + 1 inclusive!
const newLines = [
  ...lines.slice(0, startIndex - 1), 
  newCode,
  ...lines.slice(endIndex + 2) // keep from line endIndex + 2
];

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('Patched');
