import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { supabase } from "@/lib/supabase";

interface ContractFormModalProps {
  visible: boolean;
  contract?: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ContractFormModal({
  visible,
  contract,
  onClose,
  onSuccess,
}: ContractFormModalProps) {
  const queryClient = useQueryClient();
  const colors = useColors();
  // DB speichert YYYY-MM-DD, Anzeige als DD.MM.YYYY
  const toDisplay = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
  };
  const toDb = (d: string) => {
    if (!d) return "";
    const parts = d.split(".");
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
  };

  const [formData, setFormData] = useState({
    title: contract?.title || "",
    description: contract?.description || "",
    customerId: contract?.customer_id || contract?.customerId || null,
    employeeId: contract?.employee_id || contract?.employeeId || null,
    amount: (contract?.annual_amount || contract?.amount)?.toString() || "",
    startDate: toDisplay(contract?.start_date || contract?.startDate || ""),
    durationMonths: (contract?.duration_months || contract?.durationMonths)?.toString() || "12",
    noticePeriodMonths: (contract?.notice_period_months || contract?.noticePeriodMonths)?.toString() || "3",
    slaResponseHours: contract?.sla_response_hours?.toString() || "",
    contactPerson: contract?.contact_person || contract?.contactPerson || "",
    paymentTerms: contract?.payment_terms || contract?.paymentTerms || "",
    scopeOfServices: contract?.scope_of_services || contract?.scopeOfServices || "",
    specialAgreements: contract?.special_agreements || contract?.specialAgreements || "",
    recurringEnabled: contract?.recurring_enabled || false,
    billingCycle: contract?.billing_cycle || "yearly",
    autoRenewal: contract?.auto_renewal !== false,
    vatRate: (contract?.vat_rate ?? 0).toString(),
    isInternal: contract?.is_internal || false,
    nextInvoiceDate: toDisplay(contract?.next_invoice_date || contract?.nextInvoiceDate || ""),
    internalCosts: (contract?.internal_costs || contract?.internalCosts)?.toString() || "",
  });

  // Domain-Verwaltung (für Domainvertrag-Vorlage)
  type DomainEntry = { name: string; annual_amount: string; internal_costs: string };
  const [domains, setDomains] = useState<DomainEntry[]>(
    Array.isArray(contract?.domains)
      ? (contract.domains as any[]).map((d) => ({
          name: d.name || '',
          annual_amount: (d.annual_amount ?? '').toString(),
          internal_costs: (d.internal_costs ?? '').toString(),
        }))
      : []
  );

  const isDomainContract = domains.length > 0;
  const domainTotal = domains.reduce((s, d) => s + (parseFloat(d.annual_amount) || 0), 0);
  const domainInternalTotal = domains.reduce((s, d) => s + (parseFloat(d.internal_costs) || 0), 0);

  const handleDomainCountChange = (text: string) => {
    const count = Math.max(0, Math.min(50, parseInt(text) || 0));
    setDomains((prev) => {
      const next = [...prev];
      while (next.length < count) next.push({ name: '', annual_amount: '', internal_costs: '' });
      next.length = count;
      return next;
    });
  };

  const updateDomain = (idx: number, field: keyof DomainEntry, value: string) =>
    setDomains((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));

  // M365 Lizenzen Verwaltung
  type M365LicenseEntry = { baseName: string; quantity: number; withTeams: boolean };
  const [m365Licenses, setM365Licenses] = useState<M365LicenseEntry[]>(
    Array.isArray(contract?.m365_licenses)
      ? (contract.m365_licenses as any[]).map((l) => ({
          baseName: l.baseName || '',
          quantity: l.quantity || 0,
          withTeams: l.withTeams || false,
        }))
      : []
  );

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase.from('users').select('roles').eq('id', session.user.id).single();
        if (profile?.roles?.includes('admin')) setIsAdmin(true);
      }
    };
    checkAdmin();
  }, []);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    if (visible) {
      setFormData({
        title: contract?.title || "",
        description: contract?.description || "",
        customerId: contract?.customer_id || contract?.customerId || null,
        employeeId: contract?.employee_id || contract?.employeeId || null,
        amount: (contract?.annual_amount || contract?.amount)?.toString() || "",
        startDate: toDisplay(contract?.start_date || contract?.startDate || ""),
        durationMonths: (contract?.duration_months || contract?.durationMonths)?.toString() || "12",
        noticePeriodMonths: (contract?.notice_period_months || contract?.noticePeriodMonths)?.toString() || "3",
    slaResponseHours: contract?.sla_response_hours?.toString() || "",
        contactPerson: contract?.contact_person || contract?.contactPerson || "",
        paymentTerms: contract?.payment_terms || contract?.paymentTerms || "",
        scopeOfServices: contract?.scope_of_services || contract?.scopeOfServices || "",
        specialAgreements: contract?.special_agreements || contract?.specialAgreements || "",
        recurringEnabled: contract?.recurring_enabled || false,
        billingCycle: contract?.billing_cycle || "yearly",
        autoRenewal: contract?.auto_renewal !== false,
        vatRate: (contract?.vat_rate ?? 0).toString(),
        isInternal: contract?.is_internal || false,
        nextInvoiceDate: toDisplay(contract?.next_invoice_date || contract?.nextInvoiceDate || ""),
        internalCosts: (contract?.internal_costs || contract?.internalCosts)?.toString() || "",
      });
      setDomains(
        Array.isArray(contract?.domains)
          ? (contract.domains as any[]).map((d) => ({
              name: d.name || '',
              annual_amount: (d.annual_amount ?? '').toString(),
              internal_costs: (d.internal_costs ?? '').toString(),
            }))
          : []
      );
      setM365Licenses(
        Array.isArray(contract?.m365_licenses)
          ? (contract.m365_licenses as any[]).map((l) => ({
              baseName: l.baseName || '',
              quantity: l.quantity || 0,
              withTeams: l.withTeams || false,
            }))
          : []
      );
      setSelectedTemplate(null);
      setCustomerSearch("");
    }
  }, [visible, contract]);

  // Kunden laden
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

  // Benutzer laden
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: Data.getAllUsers,
  });

  // Produkte laden (für M365 Lizenzen)
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: Data.getProducts,
  });

  // Vorlagen laden
  const { data: templates } = useQuery({
    queryKey: ["contract_templates"],
    queryFn: Data.getContractTemplates,
  });

  // M365 Logik
  const m365Products = products?.filter((p: any) => p.category === 'Lizenz') || [];
  const isM365Contract = formData.title === 'MS365 Tenant' || selectedTemplate?.name === 'MS365 Tenant';
  
  // Lizenzen mit Produkten verknüpfen und Summen berechnen
  const calculateM365Totals = () => {
    let total = 0;
    let internalTotal = 0;
    m365Licenses.forEach(license => {
      if (license.quantity > 0) {
        const suffix = license.withTeams ? ' (mit Teams)' : ' (ohne Teams)';
        let product = m365Products.find((p: any) => p.name === license.baseName + suffix);
        if (!product) {
          product = m365Products.find((p: any) => p.name === license.baseName);
        }
        if (product) {
          total += (product.price || 0) * license.quantity;
          internalTotal += (product.internal_cost || 0) * license.quantity;
        }
      }
    });
    return { total, internalTotal };
  };
  const { total: m365Total, internalTotal: m365InternalTotal } = calculateM365Totals();

  const selectedCustomer = customers?.find((c: any) => c.id === formData.customerId);

  const getCustomerName = (c: any) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unbekannt';

  const filteredCustomers = customers?.filter((c: any) => {
    if (!customerSearch.trim()) return true;
    const search = customerSearch.toLowerCase();
    return (
      (c.company_name || '').toLowerCase().includes(search) ||
      (c.first_name || '').toLowerCase().includes(search) ||
      (c.last_name || '').toLowerCase().includes(search) ||
      (c.email || '').toLowerCase().includes(search)
    );
  });

  const applyTemplate = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      title: template.name || formData.title,
      amount: template.default_amount?.toString() || formData.amount,
      internalCosts: template.default_internal_costs?.toString() || formData.internalCosts,
      durationMonths: template.default_duration_months?.toString() || formData.durationMonths,
      noticePeriodMonths: template.default_notice_period_months?.toString() || formData.noticePeriodMonths,
      description: template.description || formData.description,
      paymentTerms: template.default_payment_terms || formData.paymentTerms,
      scopeOfServices: template.default_scope_of_services || formData.scopeOfServices,
      specialAgreements: template.default_special_agreements || formData.specialAgreements,
    });
    // Domainvertrag: automatisch 1 Domain-Zeile vorbereiten
    if (template.name === 'Domainvertrag' && domains.length === 0) {
      setDomains([{ name: '', annual_amount: template.default_amount?.toString() || '', internal_costs: template.default_internal_costs?.toString() || '' }]);
    }
    // M365 Tenant: automatisch M365 Zeilen vorbereiten
    if (template.name === 'MS365 Tenant' && m365Licenses.length === 0) {
      setM365Licenses([
        { baseName: 'Microsoft 365 Business Premium', quantity: 0, withTeams: true },
        { baseName: 'Microsoft 365 Business Standard', quantity: 0, withTeams: true },
        { baseName: 'Microsoft 365 Business Basic', quantity: 0, withTeams: true },
        { baseName: 'Microsoft 365 Apps for Business', quantity: 0, withTeams: false }
      ]);
    }
    setShowTemplatePicker(false);
  };

  // Enddatum automatisch berechnen (Input ist DD.MM.YYYY)
  const calculateEndDate = () => {
    try {
      if (!formData.startDate || !formData.durationMonths) return "";
      const dbDate = toDb(formData.startDate);
      const start = new Date(dbDate);
      if (isNaN(start.getTime())) return "";
      const end = new Date(start);
      end.setMonth(end.getMonth() + parseInt(formData.durationMonths));
      if (isNaN(end.getTime())) return "";
      return end.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const handleSubmit = async () => {
    // Pflichtfeld-Prüfung: Bei Domain-Vertrag muss mind. 1 Domain einen Namen haben
    const needsAmount = !formData.isInternal && !isDomainContract;
    if (!formData.title || (!formData.isInternal && !formData.customerId) || (formData.isInternal && !formData.employeeId) || (needsAmount && !formData.amount) || !formData.startDate) {
      alert("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }
    if (isDomainContract && domains.some((d) => !d.name.trim())) {
      alert("Bitte geben Sie für jede Domain einen Namen ein.");
      return;
    }

    try {
      const endDate = calculateEndDate();
      
      // M365 aktiv filtern
      const finalM365Licenses = isM365Contract ? m365Licenses.filter(l => l.quantity > 0) : [];

      // Bei Domain- oder M365-Vertrag: Summen automatisch berechnen
      let finalAmount = parseFloat(formData.amount) || 0;
      let finalInternalCosts = parseFloat(formData.internalCosts) || 0;
      
      if (!formData.isInternal) {
        if (isDomainContract) {
          finalAmount = domainTotal;
          finalInternalCosts = domainInternalTotal;
        } else if (isM365Contract) {
          finalAmount = m365Total;
          finalInternalCosts = m365InternalTotal;
        }
      } else {
        finalAmount = 0;
        finalInternalCosts = 0;
      }

      const contractData = {
        customer_id: formData.isInternal ? null : formData.customerId,
        employee_id: formData.isInternal ? formData.employeeId : null,
        title: formData.title,
        description: formData.description || undefined,
        amount: finalAmount,
        start_date: toDb(formData.startDate),
        end_date: formData.isInternal ? undefined : (endDate || undefined),
        duration_months: formData.isInternal ? undefined : (parseInt(formData.durationMonths) || 12),
        notice_period_months: formData.isInternal ? undefined : (parseInt(formData.noticePeriodMonths) || 3),
        sla_response_hours: formData.isInternal ? null : (parseInt(formData.slaResponseHours) || null),
        template_id: selectedTemplate?.id || undefined,
        contact_person: formData.contactPerson || undefined,
        payment_terms: formData.isInternal ? undefined : formData.paymentTerms || undefined,
        scope_of_services: formData.scopeOfServices || undefined,
        special_agreements: formData.specialAgreements || undefined,
        recurring_enabled: formData.isInternal ? false : formData.recurringEnabled,
        billing_cycle: (formData.recurringEnabled && !formData.isInternal) ? formData.billingCycle : undefined,
        auto_renewal: formData.isInternal ? false : formData.autoRenewal,
        vat_rate: formData.isInternal ? 0 : (parseFloat(formData.vatRate) || 0),
        is_internal: formData.isInternal,
        next_invoice_date: (formData.recurringEnabled && !formData.isInternal && formData.nextInvoiceDate) ? toDb(formData.nextInvoiceDate) : undefined,
        internal_costs: finalInternalCosts,
        domains: isDomainContract
          ? domains.map((d) => ({ name: d.name.trim(), annual_amount: parseFloat(d.annual_amount) || 0, internal_costs: parseFloat(d.internal_costs) || 0 }))
          : [],
        m365_licenses: finalM365Licenses,
      };

      if (contract?.id) {
        await Data.updateContract(contract.id, contractData);
        await Data.logContractActivity(contract.id, "edited", `Vertrag "${formData.title}" wurde bearbeitet`);
      } else {
        const newContract = await Data.createContract(contractData);
        if (newContract?.id) {
          await Data.logContractActivity(newContract.id, "created", `Vertrag "${formData.title}" wurde erstellt`);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      alert("Fehler: " + error.message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-background rounded-t-3xl"
          style={{ maxHeight: "90%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              {contract ? "Vertrag bearbeiten" : "Neuer Vertrag"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Vorlage auswählen */}
              {!contract && templates && templates.length > 0 && (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Vorlage verwenden
                  </Text>
                  <TouchableOpacity
                    className="bg-surface border border-border rounded-lg px-4 py-3 flex-row items-center justify-between"
                    onPress={() => setShowTemplatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text className={selectedTemplate ? "text-foreground" : "text-muted"}>
                      {selectedTemplate ? selectedTemplate.name : "Vorlage auswählen (optional)..."}
                    </Text>
                    <IconSymbol name="doc.on.doc.fill" size={18} color={selectedTemplate ? colors.primary : colors.muted} />
                  </TouchableOpacity>
                  {selectedTemplate && (
                    <TouchableOpacity
                      className="mt-1"
                      onPress={() => {
                        setSelectedTemplate(null);
                        setFormData({
                          ...formData,
                          title: "",
                          description: "",
                          amount: "",
                          durationMonths: "12",
                          noticePeriodMonths: "3",
                          slaResponseHours: "",
                        });
                      }}
                    >
                      <Text className="text-sm text-primary">Vorlage entfernen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Kunde / Mitarbeiter auswählen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  {formData.isInternal ? "Mitarbeiter *" : "Kunde *"}
                </Text>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-lg px-4 py-3"
                  onPress={() => { setCustomerSearch(''); setShowCustomerPicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text className={(formData.isInternal ? formData.employeeId : formData.customerId) ? "text-foreground" : "text-muted"}>
                    {formData.isInternal 
                        ? (users?.find((u: any) => u.id === formData.employeeId)?.name || users?.find((u: any) => u.id === formData.employeeId)?.email || "Mitarbeiter auswählen...")
                        : (selectedCustomer ? getCustomerName(selectedCustomer) : "Kunde auswählen...")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Titel */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Vertragstitel *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Wartungsvertrag Standard"
                  placeholderTextColor={colors.muted}
                  value={formData.title}
                  onChangeText={(text) =>
                    setFormData({ ...formData, title: text })
                  }
                />
              </View>

              {/* Kontaktperson */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kontaktperson
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Vorname Nachname"
                  placeholderTextColor={colors.muted}
                  value={formData.contactPerson}
                  onChangeText={(text) =>
                    setFormData({ ...formData, contactPerson: text })
                  }
                />
              </View>

              {/* Beschreibung */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Beschreibung
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Optionale Beschreibung"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                />
              </View>

              {/* Leistungsumfang */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Leistungsumfang
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Detaillierte Beschreibung der Leistungen"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.scopeOfServices}
                  onChangeText={(text) =>
                    setFormData({ ...formData, scopeOfServices: text })
                  }
                />
              </View>

              {/* Zahlungsbedingungen */}
              {!formData.isInternal && (
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Zahlungsbedingungen
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {Data.PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setFormData({ ...formData, paymentTerms: opt.label })}
                      activeOpacity={0.7}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 8,
                        backgroundColor: formData.paymentTerms === opt.label ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: formData.paymentTerms === opt.label ? colors.primary : colors.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: "600",
                        color: formData.paymentTerms === opt.label ? "#fff" : colors.foreground,
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              )}

              {/* Zusatzvereinbarungen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Zusatzvereinbarungen
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Optionale Zusatzvereinbarungen"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={formData.specialAgreements}
                  onChangeText={(text) =>
                    setFormData({ ...formData, specialAgreements: text })
                  }
                />
              </View>

              {/* Betrag / Domain-Verwaltung / M365 */}
              {!formData.isInternal && (
                <View style={{ gap: 12 }}>
                  {isM365Contract ? (
                    <View style={{ gap: 8 }}>
                      <Text className="text-sm font-semibold text-foreground">M365 Lizenzen</Text>
                      {m365Licenses.map((license, idx) => (
                        <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{license.baseName}</Text>
                          
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Anzahl Lizenzen</Text>
                              <TextInput
                                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                                placeholder="0"
                                placeholderTextColor={colors.muted}
                                keyboardType="number-pad"
                                value={license.quantity > 0 ? license.quantity.toString() : ''}
                                onChangeText={(text) => {
                                  const qty = Math.max(0, parseInt(text) || 0);
                                  setM365Licenses(prev => prev.map((l, i) => i === idx ? { ...l, quantity: qty } : l));
                                }}
                              />
                            </View>
                            
                            {license.baseName !== 'Microsoft 365 Apps for Business' && (
                              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8 }}>Inkl. MS Teams</Text>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() => setM365Licenses(prev => prev.map((l, i) => i === idx ? { ...l, withTeams: !l.withTeams } : l))}
                                  style={{
                                    width: 44, height: 24, borderRadius: 12,
                                    backgroundColor: license.withTeams ? colors.primary : colors.muted + '40',
                                    justifyContent: 'center',
                                    paddingHorizontal: 2
                                  }}
                                >
                                  <View style={{
                                    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                                    transform: [{ translateX: license.withTeams ? 20 : 0 }]
                                  }} />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}

                      {/* Summen-Vorschau M365 */}
                      <View style={{ backgroundColor: colors.primary + '10', borderRadius: 10, padding: 12, gap: 4, marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: colors.muted }}>Jahresbetrag total</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>CHF {m365Total.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: colors.muted }}>Eigenkosten total</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>CHF {m365InternalTotal.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text style={{ fontSize: 12, color: colors.muted }}>Marge</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>CHF {(m365Total - m365InternalTotal).toFixed(2)}</Text>
                        </View>
                      </View>
                    </View>
                  ) : isDomainContract ? (
                    <>
                      {/* Anzahl Domains */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text className="text-sm font-semibold text-foreground mb-2">
                            Anzahl Domains
                          </Text>
                          <TextInput
                            className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                            placeholder="0"
                            placeholderTextColor={colors.muted}
                            keyboardType="number-pad"
                            value={domains.length > 0 ? domains.length.toString() : ''}
                            onChangeText={handleDomainCountChange}
                          />
                          <Text className="text-xs text-muted mt-1">0 = pauschaler Betrag, &gt;0 = je Domain separat</Text>
                        </View>
                      </View>

                      {/* Domain-Zeilen */}
                      <View style={{ gap: 8 }}>
                        <Text className="text-sm font-semibold text-foreground">Domains</Text>
                        {domains.map((domain, idx) => (
                          <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 8 }}>
                            <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>Domain {idx + 1}</Text>
                            <TextInput
                              className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                              placeholder="z.B. example.ch"
                              placeholderTextColor={colors.muted}
                              value={domain.name}
                              onChangeText={(v) => updateDomain(idx, 'name', v)}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Jahresbetrag (CHF)</Text>
                                <TextInput
                                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                                  placeholder="0.00"
                                  placeholderTextColor={colors.muted}
                                  keyboardType="decimal-pad"
                                  value={domain.annual_amount}
                                  onChangeText={(v) => updateDomain(idx, 'annual_amount', v)}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Eigenkosten (CHF)</Text>
                                <TextInput
                                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                                  placeholder="0.00"
                                  placeholderTextColor={colors.muted}
                                  keyboardType="decimal-pad"
                                  value={domain.internal_costs}
                                  onChangeText={(v) => updateDomain(idx, 'internal_costs', v)}
                                />
                              </View>
                            </View>
                          </View>
                        ))}

                        {/* Summen-Vorschau Domains */}
                        <View style={{ backgroundColor: colors.primary + '10', borderRadius: 10, padding: 12, gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Jahresbetrag total</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>CHF {domainTotal.toFixed(2)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Eigenkosten total</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>CHF {domainInternalTotal.toFixed(2)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Marge</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>CHF {(domainTotal - domainInternalTotal).toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>
                    </>
                  ) : (
                    // Normaler Betrag + Eigenkosten
                    <>
                      <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Jahresbetrag (CHF) *</Text>
                        <TextInput
                          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                          placeholder="0.00"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          value={formData.amount}
                          onChangeText={(text) => setFormData({ ...formData, amount: text })}
                        />
                      </View>
                      <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Eigenkosten pro Jahr (CHF)</Text>
                        <TextInput
                          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                          placeholder="0.00"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          value={formData.internalCosts}
                          onChangeText={(text) => setFormData({ ...formData, internalCosts: text })}
                        />
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Startdatum */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Startdatum *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="DD.MM.YYYY"
                  placeholderTextColor={colors.muted}
                  value={formData.startDate}
                  onChangeText={(text) =>
                    setFormData({ ...formData, startDate: text })
                  }
                />
                <Text className="text-xs text-muted mt-1">
                  Format: TT.MM.JJJJ (z.B. 15.01.2026)
                </Text>
              </View>

              {/* MWST-Satz */}
              {!formData.isInternal && (
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  MWST-Satz
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[{ key: "0", label: "Keine MWST" }, { key: "2.6", label: "2.6%" }, { key: "8.1", label: "8.1%" }].map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setFormData({ ...formData, vatRate: opt.key })}
                      activeOpacity={0.7}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 8,
                        backgroundColor: formData.vatRate === opt.key ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: formData.vatRate === opt.key ? colors.primary : colors.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: "600",
                        color: formData.vatRate === opt.key ? "#fff" : colors.foreground,
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              )}

              {/* Laufzeit */}
              {!formData.isInternal && (
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Laufzeit (Monate)
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="12"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={formData.durationMonths}
                  onChangeText={(text) =>
                    setFormData({ ...formData, durationMonths: text })
                  }
                />
              </View>
              )}

              {/* Kündigungsfrist */}
              {!formData.isInternal && (
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kündigungsfrist (Monate)
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="3"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={formData.noticePeriodMonths}
                  onChangeText={(text) =>
                    setFormData({ ...formData, noticePeriodMonths: text })
                  }
                />
              </View>
              )}

              {/* SLA-Reaktionszeit */}
              {!formData.isInternal && (
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  SLA-Reaktionszeit (Stunden, optional)
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. 4 – leer = keine SLA"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={formData.slaResponseHours}
                  onChangeText={(text) =>
                    setFormData({ ...formData, slaResponseHours: text })
                  }
                />
                <Text className="text-xs text-muted mt-1">
                  Offene Tickets dieses Kunden zeigen dann einen Countdown; bei drohender Verletzung gibt es eine Push-Warnung.
                </Text>
              </View>
              )}

              {/* Berechnetes Enddatum */}
              {!formData.isInternal && formData.startDate && formData.durationMonths && (
                <View className="bg-primary/10 rounded-lg p-3">
                  <Text className="text-sm text-muted mb-1">Berechnetes Enddatum</Text>
                  <Text className="text-base font-semibold text-primary">
                    {(() => { const d = new Date(calculateEndDate()); return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`; })()}
                  </Text>
                </View>
              )}

              {/* Automatische Verlängerung */}
              {!formData.isInternal && (
              <View className="bg-surface rounded-lg p-4 border border-border">
                <TouchableOpacity
                  className="flex-row items-center justify-between"
                  onPress={() => setFormData({ ...formData, autoRenewal: !formData.autoRenewal })}
                  activeOpacity={0.7}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">Automatische Verlängerung</Text>
                    <Text className="text-xs text-muted mt-1">Vertrag verlängert sich automatisch um die gleiche Laufzeit</Text>
                  </View>
                  <View style={{
                    width: 48, height: 28, borderRadius: 14,
                    backgroundColor: formData.autoRenewal ? colors.primary : colors.border,
                    justifyContent: "center",
                    paddingHorizontal: 2,
                  }}>
                    <View style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: "#fff",
                      alignSelf: formData.autoRenewal ? "flex-end" : "flex-start",
                    }} />
                  </View>
                </TouchableOpacity>
              </View>
              )}

              {/* Regelmässige Rechnungen */}
              {!formData.isInternal && (
              <View className="bg-surface rounded-lg p-4 border border-border">
                <TouchableOpacity
                  className="flex-row items-center justify-between"
                  onPress={() => setFormData({ ...formData, recurringEnabled: !formData.recurringEnabled })}
                  activeOpacity={0.7}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">Regelmässige Rechnungen</Text>
                    <Text className="text-xs text-muted mt-1">Automatisch wiederkehrende Rechnungen erstellen</Text>
                  </View>
                  <View style={{
                    width: 48, height: 28, borderRadius: 14,
                    backgroundColor: formData.recurringEnabled ? colors.primary : colors.border,
                    justifyContent: "center",
                    paddingHorizontal: 2,
                  }}>
                    <View style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: "#fff",
                      alignSelf: formData.recurringEnabled ? "flex-end" : "flex-start",
                    }} />
                  </View>
                </TouchableOpacity>

                {formData.recurringEnabled && (
                  <View className="mt-4">
                    <Text className="text-sm font-semibold text-foreground mb-2">Abrechnungszyklus</Text>
                    <View className="flex-row gap-2 flex-wrap">
                      {Data.BILLING_CYCLES.map((cycle) => (
                        <TouchableOpacity
                          key={cycle.key}
                          onPress={() => setFormData({ ...formData, billingCycle: cycle.key })}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: formData.billingCycle === cycle.key ? colors.primary : colors.background,
                            borderWidth: 1,
                            borderColor: formData.billingCycle === cycle.key ? colors.primary : colors.border,
                          }}
                        >
                          <Text style={{
                            fontSize: 13, fontWeight: "600",
                            color: formData.billingCycle === cycle.key ? "#fff" : colors.foreground,
                          }}>
                            {cycle.label}
                          </Text>
                          {cycle.surcharge > 0 && (
                            <Text style={{
                              fontSize: 10,
                              color: formData.billingCycle === cycle.key ? "rgba(255,255,255,0.7)" : colors.muted,
                            }}>
                              +{cycle.surcharge} CHF
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View className="mt-4 gap-4">
                      <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Nächste Rechnung am</Text>
                        <TextInput
                          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                          placeholder="DD.MM.YYYY"
                          placeholderTextColor={colors.muted}
                          value={formData.nextInvoiceDate}
                          onChangeText={(text) => setFormData({ ...formData, nextInvoiceDate: text })}
                        />
                        <Text className="text-xs text-muted mt-1">Datum, an dem die nächste automatische Rechnung gesendet wird.</Text>
                      </View>

                      <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Zahlungsfrist (Zahlungsziel)</Text>
                        <TextInput
                          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                          placeholder="z.B. 30 Tage netto"
                          placeholderTextColor={colors.muted}
                          value={formData.paymentTerms}
                          onChangeText={(text) => setFormData({ ...formData, paymentTerms: text })}
                        />
                        <Text className="text-xs text-muted mt-1">Wann ist die Rechnung fällig (z.B. "30 Tage", "10 Tage netto")</Text>
                      </View>
                    </View>

                    {/* Preisvorschau */}
                    {formData.amount && (
                      <View className="mt-3 bg-primary/10 rounded-lg p-3">
                        <Text className="text-xs text-muted mb-1">Rechnungsbetrag pro Zyklus</Text>
                        {(() => {
                          const calc = Data.calculateCycleAmount(parseFloat(formData.amount), formData.billingCycle);
                          return (
                            <>
                              <Text className="text-base font-bold text-primary">
                                CHF {calc.totalAmount.toFixed(2)}
                              </Text>
                              {calc.surcharge > 0 && (
                                <Text className="text-xs text-muted">({"CHF "}{calc.baseAmount.toFixed(2)} + {calc.surcharge.toFixed(2)} Zuschlag)</Text>
                              )}
                            </>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                )}
              </View>
              )}

              {/* Interne Verträge (nur für Admins sichtbar) */}
              {isAdmin && (
                <View className="bg-surface rounded-lg p-4 border border-border mb-4">
                  <TouchableOpacity
                    className="flex-row items-center justify-between"
                    onPress={() => {
                        const nextInternal = !formData.isInternal;
                        setFormData({ 
                            ...formData, 
                            isInternal: nextInternal, 
                            customerId: nextInternal ? null : formData.customerId, 
                            employeeId: nextInternal ? formData.employeeId : null 
                        });
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">Interner Vertrag</Text>
                      <Text className="text-xs text-muted mt-1">Nur für Administratoren sichtbar. Wird Kunden oder normalen Mitarbeitern nicht angezeigt.</Text>
                    </View>
                    <View style={{
                      width: 48, height: 28, borderRadius: 14,
                      backgroundColor: formData.isInternal ? colors.primary : colors.border,
                      justifyContent: "center",
                      paddingHorizontal: 2,
                    }}>
                      <View style={{
                        width: 24, height: 24, borderRadius: 12,
                        backgroundColor: "#fff",
                        alignSelf: formData.isInternal ? "flex-end" : "flex-start",
                      }} />
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View className="p-4 border-t border-border flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text className="text-foreground font-semibold text-center">
                Abbrechen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary py-3 rounded-lg"
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center">
                {contract ? "Aktualisieren" : "Erstellen"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Kunden-Picker Modal */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomerPicker(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "70%" }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-xl font-bold text-foreground">
                Kunde auswählen
              </Text>
              <TouchableOpacity
                onPress={() => setShowCustomerPicker(false)}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {/* Suchfeld */}
            <View className="px-4 pt-3">
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="Kunde suchen..."
                placeholderTextColor={colors.muted}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoFocus
              />
            </View>
            <ScrollView className="p-4">
              {formData.isInternal ? (
                // Mitarbeiter-Liste
                users?.filter((u: any) => 
                  (u.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || 
                  (u.email || '').toLowerCase().includes(customerSearch.toLowerCase())
                ).map((user: any) => (
                  <TouchableOpacity
                    key={user.id}
                    className="py-3 border-b border-border"
                    onPress={() => {
                      setFormData({ ...formData, employeeId: user.id });
                      setShowCustomerPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base font-semibold text-foreground">
                      {user.name || user.email}
                    </Text>
                    {user.email && user.name && (
                      <Text className="text-sm text-muted">{user.email}</Text>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                // Kunden-Liste
                filteredCustomers && filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer: any) => (
                    <TouchableOpacity
                      key={customer.id}
                      className="py-3 border-b border-border"
                      onPress={() => {
                        setFormData({ ...formData, customerId: customer.id });
                        setShowCustomerPicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-base font-semibold text-foreground">
                        {getCustomerName(customer)}
                      </Text>
                      {customer.email && (
                        <Text className="text-sm text-muted">{customer.email}</Text>
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text className="text-center text-muted py-4">
                    {customerSearch ? "Kein Kunde gefunden" : "Keine Kunden vorhanden"}
                  </Text>
                )
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vorlagen-Picker Modal */}
      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "70%" }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-xl font-bold text-foreground">
                Vorlage auswählen
              </Text>
              <TouchableOpacity
                onPress={() => setShowTemplatePicker(false)}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              {templates && templates.length > 0 ? (
                templates.map((template: any) => (
                  <TouchableOpacity
                    key={template.id}
                    className="py-3 border-b border-border"
                    onPress={() => applyTemplate(template)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base font-semibold text-foreground">
                      {template.name}
                    </Text>
                    {template.description && (
                      <Text className="text-sm text-muted">{template.description}</Text>
                    )}
                    <View className="flex-row gap-4 mt-1">
                      {template.default_amount && (
                        <Text className="text-xs text-muted">
                          CHF {template.default_amount}/Jahr
                        </Text>
                      )}
                      <Text className="text-xs text-muted">
                        {template.default_duration_months} Monate
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-center text-muted py-4">
                  Keine Vorlagen vorhanden
                </Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}
