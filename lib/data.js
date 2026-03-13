"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUNNING_LEVELS = exports.PAYMENT_METHODS = exports.EXPENSE_CATEGORIES = exports.ROLE_TILE_ACCESS = exports.ROLE_DEFINITIONS = exports.BILLING_CYCLES = exports.PAYMENT_TERMS_OPTIONS = exports.supabase = void 0;
exports.triggerPushNotification = triggerPushNotification;
exports.getCustomersWithCounts = getCustomersWithCounts;
exports.getCustomerById = getCustomerById;
exports.createCustomer = createCustomer;
exports.updateCustomer = updateCustomer;
exports.deleteCustomer = deleteCustomer;
exports.uploadCustomerLogo = uploadCustomerLogo;
exports.getCustomerContacts = getCustomerContacts;
exports.createCustomerContact = createCustomerContact;
exports.updateCustomerContact = updateCustomerContact;
exports.deleteCustomerContact = deleteCustomerContact;
exports.getAllProducts = getAllProducts;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.getNextInvoiceNumber = getNextInvoiceNumber;
exports.getAllInvoices = getAllInvoices;
exports.getInvoiceById = getInvoiceById;
exports.getCustomerInvoices = getCustomerInvoices;
exports.createInvoice = createInvoice;
exports.updateInvoice = updateInvoice;
exports.deleteInvoice = deleteInvoice;
exports.addPayment = addPayment;
exports.getInvoiceActivities = getInvoiceActivities;
exports.addInvoiceActivity = addInvoiceActivity;
exports.getCustomerContracts = getCustomerContracts;
exports.getAllTickets = getAllTickets;
exports.getCustomerTickets = getCustomerTickets;
exports.createTicket = createTicket;
exports.updateTicket = updateTicket;
exports.deleteTicket = deleteTicket;
exports.getTicketComments = getTicketComments;
exports.addTicketComment = addTicketComment;
exports.getCustomerCommunications = getCustomerCommunications;
exports.createCommunication = createCommunication;
exports.getNextQuoteNumber = getNextQuoteNumber;
exports.getAllQuotes = getAllQuotes;
exports.getQuoteById = getQuoteById;
exports.createQuote = createQuote;
exports.updateQuote = updateQuote;
exports.deleteQuote = deleteQuote;
exports.convertQuoteToInvoice = convertQuoteToInvoice;
exports.updateQuoteStatus = updateQuoteStatus;
exports.autoExpireQuotes = autoExpireQuotes;
exports.sendQuoteEmail = sendQuoteEmail;
exports.getContracts = getContracts;
exports.calculateCycleAmount = calculateCycleAmount;
exports.createRecurringInvoiceFromContract = createRecurringInvoiceFromContract;
exports.createContract = createContract;
exports.updateContract = updateContract;
exports.deleteContract = deleteContract;
exports.uploadDocument = uploadDocument;
exports.deleteCustomerDocument = deleteCustomerDocument;
exports.uploadCancellationDocument = uploadCancellationDocument;
exports.getContractTemplates = getContractTemplates;
exports.createContractTemplate = createContractTemplate;
exports.updateContractTemplate = updateContractTemplate;
exports.deleteContractTemplate = deleteContractTemplate;
exports.getNextProjectNumber = getNextProjectNumber;
exports.getAllProjects = getAllProjects;
exports.getProjectById = getProjectById;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
exports.getProjectMilestones = getProjectMilestones;
exports.createMilestone = createMilestone;
exports.updateMilestone = updateMilestone;
exports.deleteMilestone = deleteMilestone;
exports.getProjectActivities = getProjectActivities;
exports.addProjectActivity = addProjectActivity;
exports.getProjectTasks = getProjectTasks;
exports.createProjectTask = createProjectTask;
exports.updateProjectTask = updateProjectTask;
exports.deleteProjectTask = deleteProjectTask;
exports.getAccountingYear = getAccountingYear;
exports.closeAccountingYear = closeAccountingYear;
exports.getProjectQuotes = getProjectQuotes;
exports.getProjectInvoices = getProjectInvoices;
exports.convertQuoteToProject = convertQuoteToProject;
exports.getCustomerPortalUsers = getCustomerPortalUsers;
exports.createCustomerPortalUser = createCustomerPortalUser;
exports.getPortalTickets = getPortalTickets;
exports.getPortalTicketComments = getPortalTicketComments;
exports.addPortalTicketComment = addPortalTicketComment;
exports.updateCustomerPortalUser = updateCustomerPortalUser;
exports.deleteCustomerPortalUser = deleteCustomerPortalUser;
exports.toggleCustomerPortal = toggleCustomerPortal;
exports.getAllUsers = getAllUsers;
exports.getUserProfile = getUserProfile;
exports.getAllowedTileIds = getAllowedTileIds;
exports.updateUserRoles = updateUserRoles;
exports.updateUserProfileAndRoles = updateUserProfileAndRoles;
exports.updateUserProfile = updateUserProfile;
exports.createUser = createUser;
exports.deleteUser = deleteUser;
exports.getLeads = getLeads;
exports.createLead = createLead;
exports.updateLead = updateLead;
exports.deleteLead = deleteLead;
exports.getLeadItems = getLeadItems;
exports.getLeadWithItems = getLeadWithItems;
exports.getLeadActivities = getLeadActivities;
exports.addLeadActivity = addLeadActivity;
exports.getAllExpenses = getAllExpenses;
exports.createExpense = createExpense;
exports.updateExpense = updateExpense;
exports.deleteExpense = deleteExpense;
exports.uploadExpenseReceipt = uploadExpenseReceipt;
exports.deleteExpenseReceipt = deleteExpenseReceipt;
exports.getDunningSettings = getDunningSettings;
exports.updateDunningSettings = updateDunningSettings;
exports.getInvoiceDunningHistory = getInvoiceDunningHistory;
exports.addDunningRecord = addDunningRecord;
exports.getInvoiceSettings = getInvoiceSettings;
exports.updateInvoiceSettings = updateInvoiceSettings;
exports.getDocumentFolders = getDocumentFolders;
exports.createDocumentFolder = createDocumentFolder;
exports.deleteDocumentFolder = deleteDocumentFolder;
exports.getDocuments = getDocuments;
exports.deleteDocument = deleteDocument;
exports.getDocumentDownloadUrl = getDocumentDownloadUrl;
exports.getKbCategories = getKbCategories;
exports.createKbCategory = createKbCategory;
exports.updateKbCategory = updateKbCategory;
exports.deleteKbCategory = deleteKbCategory;
exports.getKbArticles = getKbArticles;
exports.getKbArticleById = getKbArticleById;
exports.createKbArticle = createKbArticle;
exports.updateKbArticle = updateKbArticle;
exports.deleteKbArticle = deleteKbArticle;
exports.getPopularKbArticles = getPopularKbArticles;
exports.getRelatedKbArticles = getRelatedKbArticles;
exports.addKbArticleAttachment = addKbArticleAttachment;
exports.deleteKbArticleAttachment = deleteKbArticleAttachment;
/**
 * Client-side data layer — communicates directly with Supabase.
 * Replaces the old tRPC/Express server middleware.
 */
var supabase_1 = require("./supabase");
Object.defineProperty(exports, "supabase", { enumerable: true, get: function () { return supabase_1.supabase; } });
var api_1 = require("./_core/api");
var FileSystem = __importStar(require("expo-file-system/legacy"));
var buffer_1 = require("buffer");
var react_native_1 = require("react-native");
function triggerPushNotification(recipients, recipientType, title, body, data) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, result, error, ctx, details, errBody, _1, session, insErr, e_1, e_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 17, , 18]);
                    console.log("[Push] Sending via Edge Function:", { recipients: recipients, recipientType: recipientType, title: title });
                    return [4 /*yield*/, supabase_1.supabase.functions.invoke('send-push', {
                            body: { recipients: recipients, recipientType: recipientType, title: title, body: body, data: data },
                        })];
                case 1:
                    _a = _b.sent(), result = _a.data, error = _a.error;
                    if (!error) return [3 /*break*/, 9];
                    ctx = error === null || error === void 0 ? void 0 : error.context;
                    details = '';
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 7, , 8]);
                    if (!(ctx && typeof ctx.json === 'function')) return [3 /*break*/, 4];
                    return [4 /*yield*/, ctx.json()];
                case 3:
                    errBody = _b.sent();
                    details = JSON.stringify(errBody);
                    return [3 /*break*/, 6];
                case 4:
                    if (!(ctx && typeof ctx.text === 'function')) return [3 /*break*/, 6];
                    return [4 /*yield*/, ctx.text()];
                case 5:
                    details = _b.sent();
                    _b.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    _1 = _b.sent();
                    return [3 /*break*/, 8];
                case 8:
                    console.error("[Push] Edge Function error:", error.message, "Details:", details);
                    return [3 /*break*/, 10];
                case 9:
                    console.log("[Push] Edge Function response:", JSON.stringify(result));
                    _b.label = 10;
                case 10:
                    _b.trys.push([10, 15, , 16]);
                    return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 11:
                    session = (_b.sent()).data.session;
                    if (!(session === null || session === void 0 ? void 0 : session.user)) return [3 /*break*/, 13];
                    return [4 /*yield*/, supabase_1.supabase.from("notifications").insert({
                            user_id: session.user.id,
                            title: title,
                            message: body,
                            is_read: true,
                        })];
                case 12:
                    insErr = (_b.sent()).error;
                    console.log("[Push] Activity saved for user:", session.user.id, insErr ? "ERROR: " + insErr.message : "OK");
                    return [3 /*break*/, 14];
                case 13:
                    console.log("[Push] No session, cannot save activity");
                    _b.label = 14;
                case 14: return [3 /*break*/, 16];
                case 15:
                    e_1 = _b.sent();
                    console.warn("[Push] Failed to save activity:", e_1);
                    return [3 /*break*/, 16];
                case 16: return [3 /*break*/, 18];
                case 17:
                    e_2 = _b.sent();
                    console.error("[Push] Failed to send:", e_2);
                    return [3 /*break*/, 18];
                case 18: return [2 /*return*/];
            }
        });
    });
}
// ==================== KUNDEN ====================
function getCustomersWithCounts() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, customers, error, _b, contractsRes, ticketsRes, invoicesRes, contracts, tickets, invoices;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customers")
                        .select("*")
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _c.sent(), customers = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    if (!customers || customers.length === 0)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, Promise.all([
                            supabase_1.supabase.from("contracts").select("customer_id, status"),
                            supabase_1.supabase.from("tickets").select("customer_id, status"),
                            supabase_1.supabase.from("invoices").select("customer_id, status"),
                        ])];
                case 2:
                    _b = _c.sent(), contractsRes = _b[0], ticketsRes = _b[1], invoicesRes = _b[2];
                    contracts = contractsRes.data || [];
                    tickets = ticketsRes.data || [];
                    invoices = invoicesRes.data || [];
                    return [2 /*return*/, customers.map(function (customer) {
                            var activeContracts = contracts.filter(function (c) { return c.customer_id === customer.id && c.status === "active"; }).length;
                            var openTickets = tickets.filter(function (t) {
                                return t.customer_id === customer.id &&
                                    (t.status === "open" || t.status === "in_progress");
                            }).length;
                            var openInvoices = invoices.filter(function (i) {
                                return i.customer_id === customer.id &&
                                    (i.status === "open" || i.status === "overdue");
                            }).length;
                            return __assign(__assign({}, customer), { _counts: { activeContracts: activeContracts, openTickets: openTickets, openInvoices: openInvoices } });
                        })];
            }
        });
    });
}
function getCustomerById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customers")
                        .select("*")
                        .eq("id", id)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function createCustomer(customer) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customers")
                        .insert([customer])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateCustomer(id, customer) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customers")
                        .update(customer)
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteCustomer(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("customers").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
// ── Customer Logo ──
function uploadCustomerLogo(customerId, uri) {
    return __awaiter(this, void 0, void 0, function () {
        var fileData, contentType, ext, path, blob, formData, response, blob, formData, error, publicUrlData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    contentType = "image/jpeg";
                    ext = "jpeg";
                    path = "".concat(customerId, "/logo_").concat(Date.now(), ".").concat(ext);
                    if (!uri.startsWith("data:")) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var xhr = new XMLHttpRequest();
                            xhr.onload = function () { return resolve(xhr.response); };
                            xhr.onerror = function () { return reject(new Error("Failed to convert image")); };
                            xhr.responseType = "blob";
                            xhr.open("GET", uri, true);
                            xhr.send(null);
                        })];
                case 1:
                    blob = _a.sent();
                    contentType = blob.type || "image/jpeg";
                    formData = new FormData();
                    formData.append("", blob, "logo.".concat(ext));
                    fileData = formData;
                    return [3 /*break*/, 5];
                case 2: return [4 /*yield*/, fetch(uri)];
                case 3:
                    response = _a.sent();
                    return [4 /*yield*/, response.blob()];
                case 4:
                    blob = _a.sent();
                    contentType = blob.type || "image/jpeg";
                    formData = new FormData();
                    formData.append("", {
                        uri: uri,
                        name: "logo.".concat(ext),
                        type: contentType,
                    });
                    fileData = formData;
                    _a.label = 5;
                case 5: return [4 /*yield*/, supabase_1.supabase.storage
                        .from("customer-logos")
                        .upload(path, fileData, { contentType: contentType, upsert: true })];
                case 6:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    publicUrlData = supabase_1.supabase.storage
                        .from("customer-logos")
                        .getPublicUrl(path).data;
                    // Update the customer record
                    return [4 /*yield*/, updateCustomer(customerId, { logo_url: publicUrlData.publicUrl })];
                case 7:
                    // Update the customer record
                    _a.sent();
                    return [2 /*return*/, publicUrlData.publicUrl];
            }
        });
    });
}
// ── Customer Contacts ──
function getCustomerContacts(customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customer_contacts")
                        .select("*")
                        .eq("customer_id", customerId)
                        .order("is_primary", { ascending: false })
                        .order("last_name", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createCustomerContact(contact) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customer_contacts")
                        .insert([contact])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateCustomerContact(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customer_contacts")
                        .update(__assign(__assign({}, updates), { updated_at: new Date().toISOString() }))
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteCustomerContact(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("customer_contacts").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
// ==================== PRODUKTE ====================
function getAllProducts() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("products")
                        .select("*")
                        .eq("is_active", true)
                        .order("name", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createProduct(product) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("products")
                        .insert([{
                            name: product.name,
                            description: product.description,
                            price: product.price,
                            vat_rate: (_c = (_b = product.vatRate) !== null && _b !== void 0 ? _b : product.vat_rate) !== null && _c !== void 0 ? _c : 8.1,
                            unit: product.unit,
                            type: product.type,
                            category: product.category || null,
                        }])
                        .select()
                        .single()];
                case 1:
                    _a = _d.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateProduct(id, product) {
    return __awaiter(this, void 0, void 0, function () {
        var cleanProduct, _i, _a, _b, key, value, _c, data, error;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    cleanProduct = {};
                    for (_i = 0, _a = Object.entries(product); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], value = _b[1];
                        if (value !== undefined)
                            cleanProduct[key] = value;
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from("products")
                            .update(cleanProduct)
                            .eq("id", id)
                            .select()
                            .single()];
                case 1:
                    _c = _d.sent(), data = _c.data, error = _c.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== RECHNUNGEN ====================
function getNextInvoiceNumber() {
    return __awaiter(this, void 0, void 0, function () {
        var currentYear, prefix, invoiceData, activityData, maxSeq, seq, _i, activityData_1, act, match, seq;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    currentYear = new Date().getFullYear();
                    prefix = "RE-".concat(currentYear, "-");
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoices")
                            .select("invoice_number")
                            .like("invoice_number", "".concat(prefix, "%"))
                            .order("invoice_number", { ascending: false })
                            .limit(1)];
                case 1:
                    invoiceData = (_b.sent()).data;
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoice_activities")
                            .select("description")
                            .like("description", "%".concat(prefix, "%"))
                            .order("created_at", { ascending: false })
                            .limit(50)];
                case 2:
                    activityData = (_b.sent()).data;
                    maxSeq = 0;
                    // Check max from existing invoices
                    if (invoiceData && invoiceData.length > 0) {
                        seq = parseInt(invoiceData[0].invoice_number.replace(prefix, ""), 10);
                        if (!isNaN(seq) && seq > maxSeq)
                            maxSeq = seq;
                    }
                    // Check max from activities (catches deleted invoices)
                    if (activityData) {
                        for (_i = 0, activityData_1 = activityData; _i < activityData_1.length; _i++) {
                            act = activityData_1[_i];
                            match = (_a = act.description) === null || _a === void 0 ? void 0 : _a.match(new RegExp("".concat(prefix.replace('-', '\\-'), "(\\d+)")));
                            if (match) {
                                seq = parseInt(match[1], 10);
                                if (!isNaN(seq) && seq > maxSeq)
                                    maxSeq = seq;
                            }
                        }
                    }
                    return [2 /*return*/, "".concat(prefix).concat(String(maxSeq + 1).padStart(3, "0"))];
            }
        });
    });
}
function getAllInvoices() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoices")
                        .select("*, customer:customers(*), items:invoice_items(*)")
                        .order("invoice_date", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function getInvoiceById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoices")
                        .select("*, customer:customers(*), items:invoice_items(*)")
                        .eq("id", id)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function getCustomerInvoices(customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoices")
                        .select("*, items:invoice_items(*)")
                        .eq("customer_id", customerId)
                        .order("invoice_date", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createInvoice(invoice, items) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, invoiceData, invoiceError, itemsWithId, itemsError;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoices")
                        .insert([invoice])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), invoiceData = _a.data, invoiceError = _a.error;
                    if (invoiceError)
                        throw new Error(invoiceError.message);
                    if (!(items.length > 0)) return [3 /*break*/, 3];
                    itemsWithId = items.map(function (item) { return (__assign(__assign({}, item), { invoice_id: invoiceData.id })); });
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoice_items")
                            .insert(itemsWithId)];
                case 2:
                    itemsError = (_b.sent()).error;
                    if (itemsError)
                        throw new Error(itemsError.message);
                    _b.label = 3;
                case 3: return [2 /*return*/, invoiceData];
            }
        });
    });
}
function updateInvoice(id, invoice, items) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, invoiceData, invoiceError, deleteError, itemsWithId, itemsError;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoices")
                        .update(invoice)
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), invoiceData = _a.data, invoiceError = _a.error;
                    if (invoiceError)
                        throw new Error(invoiceError.message);
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoice_items")
                            .delete()
                            .eq("invoice_id", id)];
                case 2:
                    deleteError = (_b.sent()).error;
                    if (deleteError)
                        throw new Error(deleteError.message);
                    if (!(items.length > 0)) return [3 /*break*/, 4];
                    itemsWithId = items.map(function (item) { return (__assign(__assign({}, item), { invoice_id: id })); });
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoice_items")
                            .insert(itemsWithId)];
                case 3:
                    itemsError = (_b.sent()).error;
                    if (itemsError)
                        throw new Error(itemsError.message);
                    _b.label = 4;
                case 4: return [2 /*return*/, invoiceData];
            }
        });
    });
}
function deleteInvoice(id) {
    return __awaiter(this, void 0, void 0, function () {
        var itemsError, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoice_items")
                        .delete()
                        .eq("invoice_id", id)];
                case 1:
                    itemsError = (_a.sent()).error;
                    if (itemsError)
                        throw new Error(itemsError.message);
                    return [4 /*yield*/, supabase_1.supabase.from("invoices").delete().eq("id", id)];
                case 2:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
function addPayment(invoiceId, amount) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, invoice, fetchError, newPaidAmount, newStatus, _b, data, error;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoices")
                        .select("total, paid_amount")
                        .eq("id", invoiceId)
                        .single()];
                case 1:
                    _a = _c.sent(), invoice = _a.data, fetchError = _a.error;
                    if (fetchError)
                        throw new Error(fetchError.message);
                    newPaidAmount = (invoice.paid_amount || 0) + amount;
                    newStatus = newPaidAmount >= invoice.total ? "paid" : "open";
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoices")
                            .update({ paid_amount: newPaidAmount, status: newStatus })
                            .eq("id", invoiceId)
                            .select()
                            .single()];
                case 2:
                    _b = _c.sent(), data = _b.data, error = _b.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function getInvoiceActivities(invoiceId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoice_activities")
                        .select("*")
                        .eq("invoice_id", invoiceId)
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function addInvoiceActivity(invoiceId, type, description, userName) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoice_activities")
                        .insert({
                        invoice_id: invoiceId,
                        type: type,
                        description: description,
                        user_name: userName || "System",
                    })
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== VERTRÄGE ====================
function getCustomerContracts(customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("contracts")
                        .select("*")
                        .eq("customer_id", customerId)
                        .order("start_date", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
// ==================== TICKETS ====================
function getAllTickets() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("tickets")
                        .select("*, customer:customers(company_name, first_name, last_name)")
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function getCustomerTickets(customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("tickets")
                        .select("*")
                        .eq("customer_id", customerId)
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createTicket(ticket) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("tickets")
                        .insert([ticket])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateTicket(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("tickets")
                        .update(__assign(__assign({}, updates), { updated_at: new Date().toISOString() }))
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteTicket(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("tickets").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
function getTicketComments(ticketId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("ticket_comments")
                        .select("*")
                        .eq("ticket_id", ticketId)
                        .order("created_at", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function addTicketComment(ticketId_1, comment_1) {
    return __awaiter(this, arguments, void 0, function (ticketId, comment, userName, isInternal) {
        var _a, data, error;
        if (userName === void 0) { userName = "Admin"; }
        if (isInternal === void 0) { isInternal = true; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("ticket_comments")
                        .insert({
                        ticket_id: ticketId,
                        comment: comment,
                        user_name: userName,
                        is_internal: isInternal,
                        is_system: false,
                    })
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== KOMMUNIKATION ====================
function getCustomerCommunications(customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("communications")
                        .select("*")
                        .eq("customer_id", customerId)
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createCommunication(communication) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("communications")
                        .insert([communication])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== ANGEBOTE (QUOTES) ====================
function getNextQuoteNumber() {
    return __awaiter(this, void 0, void 0, function () {
        var currentYear, prefix, data, maxSeq, seq;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentYear = new Date().getFullYear();
                    prefix = "AN-".concat(currentYear, "-");
                    return [4 /*yield*/, supabase_1.supabase
                            .from("quotes")
                            .select("quote_number")
                            .like("quote_number", "".concat(prefix, "%"))
                            .order("quote_number", { ascending: false })
                            .limit(1)];
                case 1:
                    data = (_a.sent()).data;
                    maxSeq = 0;
                    if (data && data.length > 0) {
                        seq = parseInt(data[0].quote_number.replace(prefix, ""), 10);
                        if (!isNaN(seq) && seq > maxSeq)
                            maxSeq = seq;
                    }
                    return [2 /*return*/, "".concat(prefix).concat(String(maxSeq + 1).padStart(3, "0"))];
            }
        });
    });
}
function getAllQuotes() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("quotes")
                        .select("*, customer:customers(*), items:quote_items(*)")
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function getQuoteById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("quotes")
                        .select("*, customer:customers(*), items:quote_items(*)")
                        .eq("id", id)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function createQuote(quote, items) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, quoteData, quoteError, itemsWithId, itemsError;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("quotes")
                        .insert([quote])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), quoteData = _a.data, quoteError = _a.error;
                    if (quoteError)
                        throw new Error(quoteError.message);
                    if (!(items.length > 0)) return [3 /*break*/, 3];
                    itemsWithId = items.map(function (item) { return (__assign(__assign({}, item), { quote_id: quoteData.id })); });
                    return [4 /*yield*/, supabase_1.supabase
                            .from("quote_items")
                            .insert(itemsWithId)];
                case 2:
                    itemsError = (_b.sent()).error;
                    if (itemsError)
                        throw new Error(itemsError.message);
                    _b.label = 3;
                case 3: return [2 /*return*/, quoteData];
            }
        });
    });
}
function updateQuote(id, quote, items) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, quoteData, quoteError, itemsWithId;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("quotes")
                        .update(quote)
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), quoteData = _a.data, quoteError = _a.error;
                    if (quoteError)
                        throw new Error(quoteError.message);
                    // Delete old items, insert new
                    return [4 /*yield*/, supabase_1.supabase.from("quote_items").delete().eq("quote_id", id)];
                case 2:
                    // Delete old items, insert new
                    _b.sent();
                    if (!(items.length > 0)) return [3 /*break*/, 4];
                    itemsWithId = items.map(function (item) { return (__assign(__assign({}, item), { quote_id: id })); });
                    return [4 /*yield*/, supabase_1.supabase.from("quote_items").insert(itemsWithId)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4: return [2 /*return*/, quoteData];
            }
        });
    });
}
function deleteQuote(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("quote_items").delete().eq("quote_id", id)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, supabase_1.supabase.from("quotes").delete().eq("id", id)];
                case 2:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
function convertQuoteToInvoice(quoteId) {
    return __awaiter(this, void 0, void 0, function () {
        var quote, invoiceNumber, today, dueDate, invoice;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getQuoteById(quoteId)];
                case 1:
                    quote = _a.sent();
                    if (!quote)
                        throw new Error("Angebot nicht gefunden");
                    return [4 /*yield*/, getNextInvoiceNumber()];
                case 2:
                    invoiceNumber = _a.sent();
                    today = new Date().toISOString().split("T")[0];
                    dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                    return [4 /*yield*/, createInvoice({
                            customer_id: quote.customer_id,
                            invoice_number: invoiceNumber,
                            invoice_date: today,
                            due_date: dueDate,
                            subtotal: quote.subtotal,
                            vat_amount: quote.tax,
                            total: quote.total,
                            status: "open",
                        }, (quote.items || []).map(function (item) { return ({
                            description: item.description,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            vat_rate: item.vat_rate,
                            total: item.total,
                            product_id: item.product_id || null,
                        }); }))];
                case 3:
                    invoice = _a.sent();
                    // 4. Mark quote as accepted
                    return [4 /*yield*/, supabase_1.supabase.from("quotes").update({ status: "accepted" }).eq("id", quoteId)];
                case 4:
                    // 4. Mark quote as accepted
                    _a.sent();
                    if (quote.quote_number) {
                        triggerPushNotification("all_admins", "admin", "Angebot angenommen", "Das Angebot ".concat(quote.quote_number, " wurde angenommen und in eine Rechnung umgewandelt!"), { url: "/quotes" });
                    }
                    return [2 /*return*/, invoice];
            }
        });
    });
}
function updateQuoteStatus(quoteId, status) {
    return __awaiter(this, void 0, void 0, function () {
        var error, quote;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("quotes")
                        .update({ status: status })
                        .eq("id", quoteId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    if (!(status === "accepted")) return [3 /*break*/, 3];
                    return [4 /*yield*/, getQuoteById(quoteId).catch(function () { return null; })];
                case 2:
                    quote = _a.sent();
                    if (quote) {
                        triggerPushNotification("all_admins", "admin", "Angebot angenommen", "Das Angebot ".concat(quote.quote_number || quoteId, " wurde angenommen!"), { url: "/quotes" });
                    }
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Auto-expire quotes whose valid_until date has passed
function autoExpireQuotes() {
    return __awaiter(this, void 0, void 0, function () {
        var today;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    today = new Date().toISOString().split("T")[0];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("quotes")
                            .update({ status: "expired" })
                            .in("status", ["draft", "sent"])
                            .lt("valid_until", today)
                            .not("valid_until", "is", null)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function sendQuoteEmail(quoteId, pdfBase64) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.functions.invoke('send-quote-email', {
                        body: { quoteId: quoteId, pdfBase64: pdfBase64 },
                    })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message || "E-Mail konnte nicht gesendet werden");
                    if (data === null || data === void 0 ? void 0 : data.error)
                        throw new Error(data.error);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== VERTRÄGE ====================
function getContracts() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("contracts")
                        .select("*, customers(company_name, first_name, last_name)")
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, (data || []).map(function (c) {
                            var _a, _b, _c;
                            return (__assign(__assign({}, c), { customer_name: ((_a = c.customers) === null || _a === void 0 ? void 0 : _a.company_name) ||
                                    "".concat(((_b = c.customers) === null || _b === void 0 ? void 0 : _b.first_name) || '', " ").concat(((_c = c.customers) === null || _c === void 0 ? void 0 : _c.last_name) || '').trim() ||
                                    'Unbekannt' }));
                        })];
            }
        });
    });
}
// Payment terms options
exports.PAYMENT_TERMS_OPTIONS = [
    { key: "7", label: "7 Tage netto", days: 7 },
    { key: "14", label: "14 Tage netto", days: 14 },
    { key: "30", label: "30 Tage netto", days: 30 },
];
// Billing cycle configuration
exports.BILLING_CYCLES = [
    { key: "monthly", label: "Monatlich", months: 1, surcharge: 2 },
    { key: "quarterly", label: "Quartal", months: 3, surcharge: 2 },
    { key: "semi_annual", label: "Halbjährlich", months: 6, surcharge: 2 },
    { key: "yearly", label: "Jährlich", months: 12, surcharge: 0 },
];
function calculateCycleAmount(annualAmount, cycleKey) {
    var cycle = exports.BILLING_CYCLES.find(function (c) { return c.key === cycleKey; }) || exports.BILLING_CYCLES[3];
    var baseAmount = Math.round((annualAmount / 12 * cycle.months) * 100) / 100;
    return { baseAmount: baseAmount, surcharge: cycle.surcharge, totalAmount: baseAmount + cycle.surcharge };
}
function calculateNextInvoiceDate(fromDate, cycleKey) {
    var date = new Date(fromDate);
    var cycle = exports.BILLING_CYCLES.find(function (c) { return c.key === cycleKey; }) || exports.BILLING_CYCLES[3];
    date.setMonth(date.getMonth() + cycle.months);
    return date.toISOString().split("T")[0];
}
function createRecurringInvoiceFromContract(contract) {
    return __awaiter(this, void 0, void 0, function () {
        var invoiceNumber, _a, baseAmount, surcharge, totalAmount, cycleName, today, ptMatch, paymentDays, dueDate, vatRate, vatMultiplier, items, invoice, nextDate;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, getNextInvoiceNumber()];
                case 1:
                    invoiceNumber = _d.sent();
                    _a = calculateCycleAmount(contract.annual_amount || contract.amount || 0, contract.billing_cycle || "yearly"), baseAmount = _a.baseAmount, surcharge = _a.surcharge, totalAmount = _a.totalAmount;
                    cycleName = ((_b = exports.BILLING_CYCLES.find(function (c) { return c.key === contract.billing_cycle; })) === null || _b === void 0 ? void 0 : _b.label) || "Jährlich";
                    today = new Date().toISOString().split("T")[0];
                    ptMatch = (contract.payment_terms || "").match(/(\d+)/);
                    paymentDays = ptMatch ? parseInt(ptMatch[1]) : 30;
                    dueDate = new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                    vatRate = (_c = contract.vat_rate) !== null && _c !== void 0 ? _c : 0;
                    vatMultiplier = vatRate / 100;
                    items = [
                        {
                            description: "".concat(contract.title, " \u2014 ").concat(cycleName, "e Abrechnung"),
                            quantity: 1,
                            unit: "Pauschale",
                            unit_price: baseAmount,
                            vat_rate: vatRate,
                            total: baseAmount,
                        },
                    ];
                    if (surcharge > 0) {
                        items.push({
                            description: "Zuschlag ".concat(cycleName, "e Abrechnung"),
                            quantity: 1,
                            unit: "Pauschale",
                            unit_price: surcharge,
                            vat_rate: vatRate,
                            total: surcharge,
                        });
                    }
                    return [4 /*yield*/, createInvoice({
                            customer_id: contract.customer_id,
                            invoice_number: invoiceNumber,
                            invoice_date: today,
                            due_date: dueDate,
                            subtotal: totalAmount,
                            vat_amount: Math.round(totalAmount * vatMultiplier * 100) / 100,
                            total: Math.round(totalAmount * (1 + vatMultiplier) * 100) / 100,
                            status: "open",
                            notes: "Automatische Rechnung aus Vertrag: ".concat(contract.title),
                        }, items)];
                case 2:
                    invoice = _d.sent();
                    nextDate = calculateNextInvoiceDate(today, contract.billing_cycle || "yearly");
                    return [4 /*yield*/, supabase_1.supabase.from("contracts").update({
                            last_invoice_date: today,
                            next_invoice_date: nextDate,
                            updated_at: new Date().toISOString(),
                        }).eq("id", contract.id)];
                case 3:
                    _d.sent();
                    return [2 /*return*/, invoice];
            }
        });
    });
}
function createContract(contract) {
    return __awaiter(this, void 0, void 0, function () {
        var insertData, _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    insertData = __assign(__assign({}, contract), { status: "active" });
                    if (contract.recurring_enabled && !contract.next_invoice_date) {
                        insertData.next_invoice_date = contract.start_date;
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from("contracts")
                            .insert([insertData])
                            .select()
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateContract(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("contracts")
                        .update(__assign(__assign({}, updates), { updated_at: new Date().toISOString() }))
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteContract(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("contracts").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
function uploadDocument(customerId, uri, filename) {
    return __awaiter(this, void 0, void 0, function () {
        var path, fileBody, res, base64Str, ext, mimeType, _a, data, error, publicUrlData, err_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 7, , 8]);
                    path = "".concat(customerId, "/").concat(Date.now(), "_").concat(filename.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
                    fileBody = void 0;
                    if (!(react_native_1.Platform.OS === 'web')) return [3 /*break*/, 3];
                    return [4 /*yield*/, fetch(uri)];
                case 1:
                    res = _c.sent();
                    return [4 /*yield*/, res.blob()];
                case 2:
                    fileBody = _c.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, FileSystem.readAsStringAsync(uri, { encoding: 'base64' })];
                case 4:
                    base64Str = _c.sent();
                    fileBody = buffer_1.Buffer.from(base64Str, 'base64');
                    _c.label = 5;
                case 5:
                    ext = (_b = filename.split(".").pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase();
                    mimeType = "application/octet-stream";
                    if (ext === "pdf")
                        mimeType = "application/pdf";
                    else if (ext === "png")
                        mimeType = "image/png";
                    else if (ext === "jpg" || ext === "jpeg")
                        mimeType = "image/jpeg";
                    return [4 /*yield*/, supabase_1.supabase.storage
                            .from("customer_documents")
                            .upload(path, fileBody, {
                            contentType: mimeType,
                            upsert: true,
                        })];
                case 6:
                    _a = _c.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    publicUrlData = supabase_1.supabase.storage
                        .from("customer_documents")
                        .getPublicUrl(path).data;
                    return [2 /*return*/, publicUrlData.publicUrl];
                case 7:
                    err_1 = _c.sent();
                    throw new Error(err_1.message || "Fehler beim Hochladen des Dokuments");
                case 8: return [2 /*return*/];
            }
        });
    });
}
function deleteCustomerDocument(fileUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var urlObj, pathParts, filePath, error_1, e_3, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    urlObj = new URL(fileUrl);
                    pathParts = urlObj.pathname.split("customer_documents/");
                    if (!(pathParts.length === 2)) return [3 /*break*/, 2];
                    filePath = decodeURIComponent(pathParts[1]);
                    return [4 /*yield*/, supabase_1.supabase.storage.from("customer_documents").remove([filePath])];
                case 1:
                    error_1 = (_a.sent()).error;
                    if (error_1)
                        console.error("Storage delete fail:", error_1);
                    _a.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    e_3 = _a.sent();
                    console.error("Could not parse Document URL for deletion:", e_3);
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, supabase_1.supabase
                        .from("customer_documents")
                        .delete()
                        .eq("file_url", fileUrl)];
                case 5:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
function uploadCancellationDocument(contractId, uri, filename) {
    return __awaiter(this, void 0, void 0, function () {
        var response, blob, path, _a, data, error, publicUrlData, err_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, fetch(uri)];
                case 1:
                    response = _b.sent();
                    return [4 /*yield*/, response.blob()];
                case 2:
                    blob = _b.sent();
                    path = "".concat(contractId, "/").concat(Date.now(), "_").concat(filename);
                    return [4 /*yield*/, supabase_1.supabase.storage
                            .from("documents") // assuming generic documents bucket, or you could create 'cancellations'
                            .upload(path, blob, {
                            contentType: blob.type || "application/pdf",
                            upsert: true,
                        })];
                case 3:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    publicUrlData = supabase_1.supabase.storage
                        .from("documents")
                        .getPublicUrl(path).data;
                    return [2 /*return*/, publicUrlData.publicUrl];
                case 4:
                    err_2 = _b.sent();
                    throw new Error(err_2.message || "Fehler beim Hochladen des Kündigungsdokuments");
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ==================== VERTRAGSVORLAGEN ====================
function getContractTemplates() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("contract_templates")
                        .select("*")
                        .order("name", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createContractTemplate(template) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("contract_templates")
                        .insert([template])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateContractTemplate(id, template) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("contract_templates")
                        .update(template)
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteContractTemplate(id) {
    return __awaiter(this, void 0, void 0, function () {
        var count, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("contracts")
                        .select("id", { count: "exact", head: true })
                        .eq("template_id", id)];
                case 1:
                    count = (_a.sent()).count;
                    if (count && count > 0) {
                        throw new Error("Diese Vorlage kann nicht gel\u00F6scht werden, da noch ".concat(count, " Vertrag/Vertr\u00E4ge darauf basieren. Bitte l\u00F6schen Sie zuerst die zugeh\u00F6rigen Vertr\u00E4ge."));
                    }
                    return [4 /*yield*/, supabase_1.supabase.from("contract_templates").delete().eq("id", id)];
                case 2:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
// ==================== PROJEKTE ====================
function getNextProjectNumber() {
    return __awaiter(this, void 0, void 0, function () {
        var year, prefix, data, nextNum, last, num;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    year = new Date().getFullYear();
                    prefix = "PRJ-".concat(year, "-");
                    return [4 /*yield*/, supabase_1.supabase
                            .from("projects")
                            .select("project_number")
                            .like("project_number", "".concat(prefix, "%"))
                            .order("project_number", { ascending: false })
                            .limit(1)];
                case 1:
                    data = (_a.sent()).data;
                    nextNum = 1;
                    if (data && data.length > 0) {
                        last = data[0].project_number;
                        num = parseInt(last.replace(prefix, ""), 10);
                        if (!isNaN(num))
                            nextNum = num + 1;
                    }
                    return [2 /*return*/, "".concat(prefix).concat(String(nextNum).padStart(3, "0"))];
            }
        });
    });
}
function getAllProjects() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("projects")
                        .select("*, customer:customers(*), milestones:project_milestones(*)")
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function getProjectById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("projects")
                        .select("*, customer:customers(*), milestones:project_milestones(*)")
                        .eq("id", id)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function createProject(project) {
    return __awaiter(this, void 0, void 0, function () {
        var projectNumber, _a, data, error, _2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getNextProjectNumber()];
                case 1:
                    projectNumber = _b.sent();
                    return [4 /*yield*/, supabase_1.supabase
                            .from("projects")
                            .insert(__assign(__assign({}, project), { project_number: projectNumber }))
                            .select()
                            .single()];
                case 2:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, addProjectActivity(data.id, "system", "Projekt ".concat(projectNumber, " erstellt"))];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 6];
                case 5:
                    _2 = _b.sent();
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/, data];
            }
        });
    });
}
function updateProject(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("projects")
                        .update(__assign(__assign({}, updates), { updated_at: new Date().toISOString() }))
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteProject(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("projects").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
// ==================== MEILENSTEINE ====================
function getProjectMilestones(projectId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("project_milestones")
                        .select("*")
                        .eq("project_id", projectId)
                        .order("sort_order", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createMilestone(milestone) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("project_milestones")
                        .insert(milestone)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateMilestone(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("project_milestones")
                        .update(updates)
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteMilestone(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("project_milestones").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
// ==================== PROJEKT-AKTIVITÄTEN (TIMELINE) ====================
function getProjectActivities(projectId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("project_activities")
                        .select("*")
                        .eq("project_id", projectId)
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function addProjectActivity(projectId, type, description, userName) {
    return __awaiter(this, void 0, void 0, function () {
        var resolvedName, sessionData, user, _a, profile, profileError, meta, metaName, e_4, _b, data, error;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    resolvedName = userName;
                    if (!!resolvedName) return [3 /*break*/, 7];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 2:
                    sessionData = (_d.sent()).data;
                    user = (_c = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _c === void 0 ? void 0 : _c.user;
                    console.log("[Activity Debug] user id:", user === null || user === void 0 ? void 0 : user.id, "email:", user === null || user === void 0 ? void 0 : user.email);
                    if (!user) return [3 /*break*/, 4];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("users")
                            .select("*")
                            .eq("id", user.id)
                            .single()];
                case 3:
                    _a = _d.sent(), profile = _a.data, profileError = _a.error;
                    console.log("[Activity Debug] profile:", JSON.stringify(profile), "error:", profileError === null || profileError === void 0 ? void 0 : profileError.message);
                    if (profile && profile.name) {
                        resolvedName = profile.name;
                    }
                    // Versuch 2: User Metadata
                    if (!resolvedName && user.user_metadata) {
                        meta = user.user_metadata;
                        console.log("[Activity Debug] metadata:", JSON.stringify(meta));
                        metaName = "".concat(meta.first_name || meta.name || "", " ").concat(meta.last_name || "").trim();
                        if (metaName)
                            resolvedName = metaName;
                    }
                    // Versuch 3: Email
                    if (!resolvedName && user.email) {
                        resolvedName = user.email.split("@")[0];
                    }
                    _d.label = 4;
                case 4:
                    console.log("[Activity Debug] resolvedName:", resolvedName);
                    return [3 /*break*/, 6];
                case 5:
                    e_4 = _d.sent();
                    console.warn("Could not resolve user name for activity:", e_4);
                    return [3 /*break*/, 6];
                case 6:
                    if (!resolvedName)
                        resolvedName = "System";
                    _d.label = 7;
                case 7: return [4 /*yield*/, supabase_1.supabase
                        .from("project_activities")
                        .insert({
                        project_id: projectId,
                        type: type,
                        description: description,
                        user_name: resolvedName,
                    })
                        .select()
                        .single()];
                case 8:
                    _b = _d.sent(), data = _b.data, error = _b.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== PROJEKT-AUFGABEN ====================
function getProjectTasks(projectId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("project_tasks")
                        .select("*")
                        .eq("project_id", projectId)
                        .order("sort_order", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createProjectTask(task) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("project_tasks")
                        .insert(task)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateProjectTask(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("project_tasks")
                        .update(__assign(__assign({}, updates), { updated_at: new Date().toISOString() }))
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteProjectTask(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("project_tasks").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
// ==================== JAHRESABSCHLUSS / ARCHIVIERUNG ====================
function getAccountingYear(year) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("accounting_years")
                        .select("*")
                        .eq("year", year)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error && error.code !== "PGRST116") {
                        console.error("[getAccountingYear] Error:", error.message);
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, data];
            }
        });
    });
}
function closeAccountingYear(year) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionData, userId, _a, data, updateError, _b, insertData, insertError;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 1:
                    sessionData = (_e.sent()).data;
                    userId = (_d = (_c = sessionData.session) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.id;
                    return [4 /*yield*/, supabase_1.supabase
                            .from("accounting_years")
                            .update({
                            is_closed: true,
                            closed_at: new Date().toISOString(),
                            closed_by: userId,
                        })
                            .eq("year", year)
                            .select()
                            .single()];
                case 2:
                    _a = _e.sent(), data = _a.data, updateError = _a.error;
                    if (!(updateError || !data)) return [3 /*break*/, 4];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("accounting_years")
                            .insert({
                            year: year,
                            is_closed: true,
                            closed_at: new Date().toISOString(),
                            closed_by: userId,
                        })
                            .select()
                            .single()];
                case 3:
                    _b = _e.sent(), insertData = _b.data, insertError = _b.error;
                    if (insertError)
                        throw new Error(insertError.message);
                    data = insertData;
                    _e.label = 4;
                case 4: return [2 /*return*/, data];
            }
        });
    });
}
// ==================== PROJEKT-VERKNÜPFUNGEN ====================
function getProjectQuotes(projectId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, project, quotes;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("quotes")
                        .select("*, customer:customers(*)")
                        .or("id.in.(select quote_id from projects where id='".concat(projectId, "')"))
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (!(error || !data || data.length === 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("projects")
                            .select("quote_id")
                            .eq("id", projectId)
                            .single()];
                case 2:
                    project = (_b.sent()).data;
                    if (!(project === null || project === void 0 ? void 0 : project.quote_id)) return [3 /*break*/, 4];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("quotes")
                            .select("*, customer:customers(*)")
                            .eq("id", project.quote_id)];
                case 3:
                    quotes = (_b.sent()).data;
                    return [2 /*return*/, quotes || []];
                case 4: return [2 /*return*/, []];
                case 5: return [2 /*return*/, data];
            }
        });
    });
}
function getProjectInvoices(projectId) {
    return __awaiter(this, void 0, void 0, function () {
        var project, _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("projects")
                        .select("customer_id, quote_id")
                        .eq("id", projectId)
                        .single()];
                case 1:
                    project = (_b.sent()).data;
                    if (!project)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoices")
                            .select("*, customer:customers(*)")
                            .eq("customer_id", project.customer_id)
                            .order("invoice_date", { ascending: false })];
                case 2:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function convertQuoteToProject(quoteId) {
    return __awaiter(this, void 0, void 0, function () {
        var quote, project, items, i;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getQuoteById(quoteId)];
                case 1:
                    quote = _b.sent();
                    if (!quote)
                        throw new Error("Angebot nicht gefunden");
                    return [4 /*yield*/, createProject({
                            title: "Projekt aus ".concat(quote.quote_number),
                            description: quote.notes || "",
                            customer_id: quote.customer_id,
                            quote_id: quoteId,
                            budget: quote.total || 0,
                            status: "planning",
                            priority: "medium",
                        })];
                case 2:
                    project = _b.sent();
                    items = quote.items || [];
                    i = 0;
                    _b.label = 3;
                case 3:
                    if (!(i < items.length)) return [3 /*break*/, 6];
                    return [4 /*yield*/, createMilestone({
                            project_id: project.id,
                            title: ((_a = items[i].description) === null || _a === void 0 ? void 0 : _a.split("\n")[0]) || "Position ".concat(i + 1),
                            status: "pending",
                            sort_order: i,
                        })];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/, project];
            }
        });
    });
}
// ==================== KUNDENPORTAL ====================
function getCustomerPortalUsers(customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customer_portal_users")
                        .select("*")
                        .eq("customer_id", customerId)
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createCustomerPortalUser(user) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionData, token, payload, data, err_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 1:
                    sessionData = (_b.sent()).data;
                    token = (_a = sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token;
                    payload = __assign(__assign({}, user), { password: user.password_hash });
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, api_1.apiCall)("/api/create-portal-user", {
                            method: "POST",
                            headers: {
                                "Authorization": token ? "Bearer ".concat(token) : ""
                            },
                            body: JSON.stringify(payload)
                        })];
                case 3:
                    data = _b.sent();
                    if (!data || !data.success) {
                        throw new Error((data === null || data === void 0 ? void 0 : data.error) || "Fehler beim Erstellen des Portal-Benutzers");
                    }
                    return [2 /*return*/, data.user];
                case 4:
                    err_3 = _b.sent();
                    throw new Error(err_3.message || "Fehler beim Erstellen des Portal-Benutzers");
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ==================== KUNDENPORTAL TICKETS ====================
function getPortalTickets(customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!customerId)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("tickets")
                            .select("*")
                            .eq("customer_id", customerId)
                            .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function getPortalTicketComments(ticketId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("ticket_comments")
                        .select("*")
                        .eq("ticket_id", ticketId)
                        .eq("is_internal", false)
                        .order("created_at", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function addPortalTicketComment(ticketId, comment, customerName) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, ticket;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("ticket_comments")
                        .insert({
                        ticket_id: ticketId,
                        comment: comment,
                        user_name: customerName,
                        is_internal: false,
                        // A system comment wouldn't be added directly by the customer this way,
                        // so we hardcode is_system to false
                        is_system: false
                    })
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [4 /*yield*/, supabase_1.supabase.from("tickets").select("title").eq("id", ticketId).single()];
                case 2:
                    ticket = (_b.sent()).data;
                    triggerPushNotification("all_admins", "admin", "Neue Kunden-Antwort", "Der Kunde hat auf das Ticket \"".concat((ticket === null || ticket === void 0 ? void 0 : ticket.title) || ticketId, "\" geantwortet."), { url: '/tickets' }).catch(console.error);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateCustomerPortalUser(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionData, token, _a, portalUser, error;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 1:
                    sessionData = (_c.sent()).data;
                    token = (_b = sessionData.session) === null || _b === void 0 ? void 0 : _b.access_token;
                    return [4 /*yield*/, supabase_1.supabase
                            .from("customer_portal_users")
                            .update(updates)
                            .eq("id", id)
                            .select()
                            .single()];
                case 2:
                    _a = _c.sent(), portalUser = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, portalUser];
            }
        });
    });
}
function deleteCustomerPortalUser(id) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionData, token, error;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 1:
                    sessionData = (_b.sent()).data;
                    token = (_a = sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token;
                    return [4 /*yield*/, supabase_1.supabase
                            .from("customer_portal_users")
                            .delete()
                            .eq("id", id)];
                case 2:
                    error = (_b.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
function toggleCustomerPortal(customerId, hasPortal) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("customers")
                        .update({ has_portal: hasPortal })
                        .eq("id", customerId)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== BENUTZER / MITARBEITER ====================
function getAllUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("users")
                        .select("*")
                        .order("name", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        console.error("[getAllUsers] Error:", error.message);
                        return [2 /*return*/, []];
                    }
                    // Filter out dummy or auto-created portal users that shouldn't appear in the employee list
                    return [2 /*return*/, (data || []).filter(function (u) {
                            // App User without roles is typically from Apple TestFlight SSO
                            if (u.name === "App User" && (!u.roles || u.roles.length === 0))
                                return false;
                            return true;
                        })];
            }
        });
    });
}
function getUserProfile(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("users")
                        .select("*")
                        .eq("id", id)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error && error.code !== "PGRST116")
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ── Role Definitions ──
exports.ROLE_DEFINITIONS = [
    { key: "admin", label: "Admin", color: "#EF4444", description: "Zugriff auf alles" },
    { key: "administration", label: "Administration", color: "#8B5CF6", description: "Kunden, Akquise, Angebote, Verträge" },
    { key: "akquise", label: "Akquise", color: "#0EA5E9", description: "Akquise und Angebote" },
    { key: "finanzen", label: "Finanzen", color: "#22C55E", description: "Buchhaltung" },
    { key: "technik", label: "Technik", color: "#F59E0B", description: "Tickets, Wissensdatenbank, Projekte, Verträge" },
    { key: "projekte", label: "Projekte", color: "#14B8A6", description: "Projekte" },
];
// Role → allowed dashboard tile IDs
exports.ROLE_TILE_ACCESS = {
    admin: [], // empty = everything
    administration: ["customers", "leads", "quotes", "contracts"],
    akquise: ["leads", "quotes"],
    finanzen: ["accounting"],
    technik: ["tickets", "knowledge-base", "projects", "contracts"],
    projekte: ["projects"],
};
// Konfiguration tiles are always visible for all roles
var ALWAYS_VISIBLE_TILES = ["products", "dunning", "business-card", "users", "newsletter"];
function getAllowedTileIds(userRoles) {
    // No roles or admin role = access to everything
    if (!userRoles || userRoles.length === 0 || userRoles.includes("admin")) {
        return null; // null = no filtering, show everything
    }
    var allowed = new Set(ALWAYS_VISIBLE_TILES);
    for (var _i = 0, userRoles_1 = userRoles; _i < userRoles_1.length; _i++) {
        var role = userRoles_1[_i];
        var tiles = exports.ROLE_TILE_ACCESS[role];
        if (tiles) {
            for (var _a = 0, tiles_1 = tiles; _a < tiles_1.length; _a++) {
                var t = tiles_1[_a];
                allowed.add(t);
            }
        }
    }
    return Array.from(allowed);
}
function updateUserRoles(userId, roles) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("users")
                        .update({ roles: roles })
                        .eq("id", userId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
function updateUserProfileAndRoles(userId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("users")
                        .update(updates)
                        .eq("id", userId)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateUserProfile(userId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("users")
                        .update(updates)
                        .eq("id", userId)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function createUser(user) {
    return __awaiter(this, void 0, void 0, function () {
        var createClient, signUpClient, _a, authData, authError, userId, _b, signInData, signInError, error;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require("@supabase/supabase-js")); })];
                case 1:
                    createClient = (_e.sent()).createClient;
                    signUpClient = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL || "", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "", { auth: { persistSession: false, autoRefreshToken: false } });
                    return [4 /*yield*/, signUpClient.auth.signUp({
                            email: user.email,
                            password: user.password,
                            options: { data: { full_name: user.name } },
                        })];
                case 2:
                    _a = _e.sent(), authData = _a.data, authError = _a.error;
                    userId = (_c = authData === null || authData === void 0 ? void 0 : authData.user) === null || _c === void 0 ? void 0 : _c.id;
                    if (!authError) return [3 /*break*/, 5];
                    if (!(authError.message.includes("already registered") || authError.message.includes("already been registered"))) return [3 /*break*/, 4];
                    return [4 /*yield*/, signUpClient.auth.signInWithPassword({
                            email: user.email,
                            password: user.password,
                        })];
                case 3:
                    _b = _e.sent(), signInData = _b.data, signInError = _b.error;
                    if (signInError) {
                        // Can't sign in — just create public profile without auth link
                        // Generate a UUID for the user
                        userId = crypto.randomUUID();
                    }
                    else {
                        userId = (_d = signInData.user) === null || _d === void 0 ? void 0 : _d.id;
                    }
                    return [3 /*break*/, 5];
                case 4: throw new Error(authError.message);
                case 5:
                    if (!userId) return [3 /*break*/, 7];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("users")
                            .upsert({
                            id: userId,
                            name: user.name,
                            email: user.email,
                            roles: user.roles,
                            role: "admin",
                            provider: "local",
                            is_active: true,
                        }, { onConflict: "id" })];
                case 6:
                    error = (_e.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    _e.label = 7;
                case 7: return [2 /*return*/];
            }
        });
    });
}
function deleteUser(id) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionData, token, data, err_4;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 1:
                    sessionData = (_b.sent()).data;
                    token = (_a = sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, api_1.apiCall)("/api/delete-admin-user", {
                            method: "POST",
                            headers: {
                                "Authorization": token ? "Bearer ".concat(token) : ""
                            },
                            body: JSON.stringify({ userId: id })
                        })];
                case 3:
                    data = _b.sent();
                    if (!data || !data.success) {
                        throw new Error((data === null || data === void 0 ? void 0 : data.error) || "Fehler beim Löschen des Benutzers");
                    }
                    return [3 /*break*/, 5];
                case 4:
                    err_4 = _b.sent();
                    throw new Error(err_4.message || "Fehler beim Löschen des Benutzers");
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ==================== LEADS / AKQUISE ====================
function getLeads() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("leads")
                        .select("*")
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createLead(lead, items) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, itemsWithLeadId, itemsError;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("leads")
                        .insert(lead)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    if (!(items && items.length > 0)) return [3 /*break*/, 3];
                    itemsWithLeadId = items.map(function (item) { return (__assign(__assign({}, item), { lead_id: data.id })); });
                    return [4 /*yield*/, supabase_1.supabase
                            .from("lead_items")
                            .insert(itemsWithLeadId)];
                case 2:
                    itemsError = (_b.sent()).error;
                    if (itemsError)
                        console.error("[Lead] Items insert error:", itemsError.message);
                    _b.label = 3;
                case 3: return [2 /*return*/, data];
            }
        });
    });
}
function updateLead(id, updates, items) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, itemsWithLeadId, itemsError;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("leads")
                        .update(__assign(__assign({}, updates), { updated_at: new Date().toISOString() }))
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    if (!(items !== undefined)) return [3 /*break*/, 4];
                    // Delete old items, insert new
                    return [4 /*yield*/, supabase_1.supabase.from("lead_items").delete().eq("lead_id", id)];
                case 2:
                    // Delete old items, insert new
                    _b.sent();
                    if (!(items.length > 0)) return [3 /*break*/, 4];
                    itemsWithLeadId = items.map(function (item) { return (__assign(__assign({}, item), { lead_id: id })); });
                    return [4 /*yield*/, supabase_1.supabase
                            .from("lead_items")
                            .insert(itemsWithLeadId)];
                case 3:
                    itemsError = (_b.sent()).error;
                    if (itemsError)
                        console.error("[Lead] Items update error:", itemsError.message);
                    _b.label = 4;
                case 4: return [2 /*return*/, data];
            }
        });
    });
}
function deleteLead(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("leads")
                        .delete()
                        .eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
function getLeadItems(leadId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("lead_items")
                        .select("*")
                        .eq("lead_id", leadId)
                        .order("created_at", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function getLeadWithItems(leadId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("leads")
                        .select("*, items:lead_items(*)")
                        .eq("id", leadId)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function getLeadActivities(leadId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("lead_activities")
                        .select("*")
                        .eq("lead_id", leadId)
                        .order("created_at", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function addLeadActivity(activity) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("lead_activities")
                        .insert(activity)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== AUSGABEN ====================
exports.EXPENSE_CATEGORIES = [
    { value: "accounting", label: "Buchhaltung & Beratung" },
    { value: "office", label: "Büro & Miete" },
    { value: "vehicle", label: "Fahrzeug & Transport" },
    { value: "equipment", label: "Geräte & Werkzeug" },
    { value: "software", label: "Lizenzen & Software" },
    { value: "salary", label: "Lohnzahlung" },
    { value: "material", label: "Material & Waren" },
    { value: "travel", label: "Reisen & Spesen" },
    { value: "other", label: "Sonstiges" },
    { value: "telecom", label: "Telefon & Internet" },
    { value: "insurance", label: "Versicherungen" },
    { value: "education", label: "Weiterbildung" },
    { value: "marketing", label: "Werbung & Marketing" },
];
exports.PAYMENT_METHODS = [
    { value: "bank", label: "Banküberweisung" },
    { value: "card", label: "Kreditkarte" },
    { value: "cash", label: "Bargeld" },
    { value: "twint", label: "TWINT" },
    { value: "other", label: "Sonstiges" },
];
function getAllExpenses() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("expenses")
                        .select("*")
                        .order("expense_date", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createExpense(expense) {
    return __awaiter(this, void 0, void 0, function () {
        var taxAmount, date, receipt_path, receipt_url, rest, sessionData, _a, data, error;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    taxAmount = expense.tax_rate
                        ? (expense.amount * expense.tax_rate) / 100
                        : 0;
                    date = expense.date, receipt_path = expense.receipt_path, receipt_url = expense.receipt_url, rest = __rest(expense, ["date", "receipt_path", "receipt_url"]);
                    return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 1:
                    sessionData = (_c.sent()).data;
                    return [4 /*yield*/, supabase_1.supabase
                            .from("expenses")
                            .insert(__assign(__assign({}, rest), { user_id: (_b = sessionData.session) === null || _b === void 0 ? void 0 : _b.user.id, expense_date: date, tax_amount: taxAmount, receipt_path: receipt_path || null, receipt_url: receipt_url || null }))
                            .select()
                            .single()];
                case 2:
                    _a = _c.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateExpense(id, expense) {
    return __awaiter(this, void 0, void 0, function () {
        var taxAmount, date, receipt_path, receipt_url, rest, payload, _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    taxAmount = expense.tax_rate
                        ? (expense.amount * expense.tax_rate) / 100
                        : 0;
                    date = expense.date, receipt_path = expense.receipt_path, receipt_url = expense.receipt_url, rest = __rest(expense, ["date", "receipt_path", "receipt_url"]);
                    payload = __assign(__assign({}, rest), { expense_date: date, tax_amount: taxAmount, updated_at: new Date().toISOString() });
                    // Only update receipt fields if they are explicitly provided in the object
                    if (expense.hasOwnProperty('receipt_path'))
                        payload.receipt_path = receipt_path;
                    if (expense.hasOwnProperty('receipt_url'))
                        payload.receipt_url = receipt_url;
                    return [4 /*yield*/, supabase_1.supabase
                            .from("expenses")
                            .update(payload)
                            .eq("id", id)
                            .select()
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteExpense(id) {
    return __awaiter(this, void 0, void 0, function () {
        var expense, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("expenses").select("receipt_path").eq("id", id).single()];
                case 1:
                    expense = (_a.sent()).data;
                    if (!(expense === null || expense === void 0 ? void 0 : expense.receipt_path)) return [3 /*break*/, 3];
                    return [4 /*yield*/, supabase_1.supabase.storage.from("expense_receipts").remove([expense.receipt_path])];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [4 /*yield*/, supabase_1.supabase
                        .from("expenses")
                        .delete()
                        .eq("id", id)];
                case 4:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
function uploadExpenseReceipt(file, expenseId) {
    return __awaiter(this, void 0, void 0, function () {
        var timestamp, safeName, filePath, fileBody, res, base64Str, ext, mimeType, uploadErr, publicUrl;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timestamp = Date.now();
                    safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                    filePath = "".concat(timestamp, "_").concat(safeName);
                    if (!(react_native_1.Platform.OS === 'web')) return [3 /*break*/, 3];
                    return [4 /*yield*/, fetch(file.uri)];
                case 1:
                    res = _b.sent();
                    return [4 /*yield*/, res.blob()];
                case 2:
                    fileBody = _b.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' })];
                case 4:
                    base64Str = _b.sent();
                    fileBody = buffer_1.Buffer.from(base64Str, 'base64');
                    _b.label = 5;
                case 5:
                    ext = (_a = safeName.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                    mimeType = file.type || "application/octet-stream";
                    if (ext === "pdf")
                        mimeType = "application/pdf";
                    else if (ext === "png")
                        mimeType = "image/png";
                    else if (ext === "jpg" || ext === "jpeg")
                        mimeType = "image/jpeg";
                    return [4 /*yield*/, supabase_1.supabase.storage
                            .from("expense_receipts")
                            .upload(filePath, fileBody, { contentType: mimeType, upsert: true })];
                case 6:
                    uploadErr = (_b.sent()).error;
                    if (uploadErr)
                        throw new Error(uploadErr.message);
                    publicUrl = supabase_1.supabase.storage
                        .from("expense_receipts")
                        .getPublicUrl(filePath).data.publicUrl;
                    if (!expenseId) return [3 /*break*/, 8];
                    return [4 /*yield*/, updateExpense(expenseId, { receipt_path: filePath, receipt_url: publicUrl })];
                case 7:
                    _b.sent();
                    _b.label = 8;
                case 8: return [2 /*return*/, { filePath: filePath, publicUrl: publicUrl }];
            }
        });
    });
}
function deleteExpenseReceipt(filePath, expenseId) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.storage.from("expense_receipts").remove([filePath])];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    if (!expenseId) return [3 /*break*/, 3];
                    return [4 /*yield*/, updateExpense(expenseId, { receipt_path: null, receipt_url: null })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ==================== MAHNWESEN ====================
exports.DUNNING_LEVELS = [
    { value: 0, label: "Zahlungserinnerung", color: "#f59e0b" },
    { value: 1, label: "1. Mahnung", color: "#f97316" },
    { value: 2, label: "2. Mahnung", color: "#ef4444" },
    { value: 3, label: "Betreibungsandrohung", color: "#dc2626" },
];
function getDunningSettings() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("dunning_settings")
                        .select("*")
                        .limit(1)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error || !data) {
                        // Return defaults if table doesn't exist yet
                        return [2 /*return*/, {
                                auto_enabled: false,
                                days_after_due_reminder: 5,
                                days_between_levels: 10,
                                dunning_fee: 20,
                                text_reminder: "Wir möchten Sie freundlich daran erinnern, dass die Rechnung {invoice_number} über CHF {amount} am {due_date} fällig war.",
                                text_level1: "Trotz unserer Erinnerung ist die Zahlung der Rechnung {invoice_number} über CHF {amount} noch ausstehend.",
                                text_level2: "Die Rechnung {invoice_number} über CHF {amount} ist trotz mehrfacher Mahnung weiterhin unbezahlt.",
                                text_level3: "Letzte Mahnung vor Einleitung des Betreibungsverfahrens für Rechnung {invoice_number} über CHF {amount}.",
                                subject_reminder: "Zahlungserinnerung: Rechnung {invoice_number}",
                                subject_level1: "1. Mahnung: Rechnung {invoice_number}",
                                subject_level2: "2. Mahnung: Rechnung {invoice_number}",
                                subject_level3: "Betreibungsandrohung: Rechnung {invoice_number}",
                            }];
                    }
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateDunningSettings(settings) {
    return __awaiter(this, void 0, void 0, function () {
        var existing, _a, data, error, _b, data, error, e_5;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, getDunningSettings()];
                case 1:
                    existing = _e.sent();
                    if (!(existing === null || existing === void 0 ? void 0 : existing.id)) return [3 /*break*/, 3];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("dunning_settings")
                            .update(__assign(__assign({}, settings), { updated_at: new Date().toISOString() }))
                            .eq("id", existing.id)
                            .select()
                            .single()];
                case 2:
                    _a = _e.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
                case 3: return [4 /*yield*/, supabase_1.supabase
                        .from("dunning_settings")
                        .insert(__assign({}, settings))
                        .select()
                        .single()];
                case 4:
                    _b = _e.sent(), data = _b.data, error = _b.error;
                    if (error)
                        throw new Error("Bitte führe zuerst die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
                    return [2 /*return*/, data];
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_5 = _e.sent();
                    if (((_c = e_5.message) === null || _c === void 0 ? void 0 : _c.includes("schema cache")) || ((_d = e_5.message) === null || _d === void 0 ? void 0 : _d.includes("relation"))) {
                        throw new Error("Tabelle 'dunning_settings' existiert noch nicht. Bitte führe die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
                    }
                    throw e_5;
                case 7: return [2 /*return*/];
            }
        });
    });
}
function getInvoiceDunningHistory(invoiceId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoice_dunning_history")
                        .select("*")
                        .eq("invoice_id", invoiceId)
                        .order("sent_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function addDunningRecord(record) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoice_dunning_history")
                        .insert(record)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    // Update invoice dunning_level
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoices")
                            .update({
                            dunning_level: record.dunning_level,
                            last_dunning_at: new Date().toISOString(),
                        })
                            .eq("id", record.invoice_id)];
                case 2:
                    // Update invoice dunning_level
                    _b.sent();
                    return [2 /*return*/, data];
            }
        });
    });
}
// ==================== RECHNUNGSEINSTELLUNGEN ====================
function getInvoiceSettings() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("invoice_settings")
                        .select("*")
                        .limit(1)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error || !data) {
                        // Return defaults if table doesn't exist yet
                        return [2 /*return*/, {
                                greeting_text: "Vielen Dank für Ihren Auftrag. Wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:",
                                closing_text: "Freundliche Grüsse",
                                payment_terms_days: 30,
                                bank_name: "",
                                account_holder: "",
                                iban: "",
                                swift_bic: "",
                                account_number: "",
                            }];
                    }
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateInvoiceSettings(settings) {
    return __awaiter(this, void 0, void 0, function () {
        var existing, _a, data, error, _b, data, error, e_6;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, getInvoiceSettings()];
                case 1:
                    existing = _e.sent();
                    if (!(existing === null || existing === void 0 ? void 0 : existing.id)) return [3 /*break*/, 3];
                    return [4 /*yield*/, supabase_1.supabase
                            .from("invoice_settings")
                            .update(__assign(__assign({}, settings), { updated_at: new Date().toISOString() }))
                            .eq("id", existing.id)
                            .select()
                            .single()];
                case 2:
                    _a = _e.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
                case 3: return [4 /*yield*/, supabase_1.supabase
                        .from("invoice_settings")
                        .insert(__assign({}, settings))
                        .select()
                        .single()];
                case 4:
                    _b = _e.sent(), data = _b.data, error = _b.error;
                    if (error)
                        throw new Error("Bitte führe zuerst die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
                    return [2 /*return*/, data];
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_6 = _e.sent();
                    if (((_c = e_6.message) === null || _c === void 0 ? void 0 : _c.includes("schema cache")) || ((_d = e_6.message) === null || _d === void 0 ? void 0 : _d.includes("relation"))) {
                        throw new Error("Tabelle 'invoice_settings' existiert noch nicht. Bitte führe die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
                    }
                    throw e_6;
                case 7: return [2 /*return*/];
            }
        });
    });
}
// ==================== DOKUMENTE ====================
function getDocumentFolders(parentId) {
    return __awaiter(this, void 0, void 0, function () {
        var query, _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    query = supabase_1.supabase.from("document_folders").select("*").order("name");
                    if (parentId) {
                        query = query.eq("parent_id", parentId);
                    }
                    else {
                        query = query.is("parent_id", null);
                    }
                    return [4 /*yield*/, query];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        return [2 /*return*/, []];
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createDocumentFolder(name, parentId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("document_folders")
                        .insert({ name: name, parent_id: parentId || null })
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteDocumentFolder(id) {
    return __awaiter(this, void 0, void 0, function () {
        var docs, _i, docs_1, doc, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDocuments(id)];
                case 1:
                    docs = _a.sent();
                    _i = 0, docs_1 = docs;
                    _a.label = 2;
                case 2:
                    if (!(_i < docs_1.length)) return [3 /*break*/, 5];
                    doc = docs_1[_i];
                    return [4 /*yield*/, deleteDocument(doc.id, doc.file_path)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, supabase_1.supabase.from("document_folders").delete().eq("id", id)];
                case 6:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
function getDocuments(folderId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("documents")
                        .select("*")
                        .eq("folder_id", folderId)
                        .order("created_at", { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        return [2 /*return*/, []];
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function deleteDocument(id, filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.storage.from("documents").remove([filePath])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, supabase_1.supabase.from("documents").delete().eq("id", id)];
                case 2:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/];
            }
        });
    });
}
function getDocumentDownloadUrl(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.storage.from("documents").createSignedUrl(filePath, 3600)];
                case 1:
                    data = (_a.sent()).data;
                    return [2 /*return*/, (data === null || data === void 0 ? void 0 : data.signedUrl) || ""];
            }
        });
    });
}
// ==================== KNOWLEDGE BASE ====================
// ── Kategorien ──
function getKbCategories() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_categories")
                        .select("*")
                        .order("sort_order", { ascending: true })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function createKbCategory(category) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_categories")
                        .insert([category])
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateKbCategory(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_categories")
                        .update(updates)
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteKbCategory(id) {
    return __awaiter(this, void 0, void 0, function () {
        var count, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_articles")
                        .select("id", { count: "exact", head: true })
                        .eq("category_id", id)];
                case 1:
                    count = (_a.sent()).count;
                    if (count && count > 0) {
                        throw new Error("Diese Kategorie kann nicht gel\u00F6scht werden, da noch ".concat(count, " Artikel zugeordnet sind. Bitte verschieben oder l\u00F6schen Sie zuerst die zugeh\u00F6rigen Artikel."));
                    }
                    return [4 /*yield*/, supabase_1.supabase.from("kb_categories").delete().eq("id", id)];
                case 2:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
// ── Artikel ──
function getKbArticles(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var query, _a, data, error, results, term_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    query = supabase_1.supabase
                        .from("kb_articles")
                        .select("*, category:kb_categories(id, name, icon, color)");
                    if (filters === null || filters === void 0 ? void 0 : filters.category_id) {
                        query = query.eq("category_id", filters.category_id);
                    }
                    if (filters === null || filters === void 0 ? void 0 : filters.status) {
                        query = query.eq("status", filters.status);
                    }
                    if (filters === null || filters === void 0 ? void 0 : filters.visibility) {
                        query = query.eq("visibility", filters.visibility);
                    }
                    if (filters === null || filters === void 0 ? void 0 : filters.tag) {
                        query = query.contains("tags", [filters.tag]);
                    }
                    // Sorting
                    if ((filters === null || filters === void 0 ? void 0 : filters.sort) === "popular") {
                        query = query.order("view_count", { ascending: false });
                    }
                    else if ((filters === null || filters === void 0 ? void 0 : filters.sort) === "alphabetical") {
                        query = query.order("title", { ascending: true });
                    }
                    else {
                        query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
                    }
                    return [4 /*yield*/, query];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    results = data || [];
                    // Client-side text search (Supabase JS doesn't easily support plainto_tsquery)
                    if ((filters === null || filters === void 0 ? void 0 : filters.search) && filters.search.trim()) {
                        term_1 = filters.search.toLowerCase().trim();
                        results = results.filter(function (a) {
                            var _a, _b;
                            return ((_a = a.title) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(term_1)) ||
                                ((_b = a.content) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(term_1)) ||
                                (a.tags || []).some(function (t) { return t.toLowerCase().includes(term_1); });
                        });
                    }
                    return [2 /*return*/, results];
            }
        });
    });
}
function getKbArticleById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_articles")
                        .select("*, category:kb_categories(id, name, icon, color), attachments:kb_article_attachments(*)")
                        .eq("id", id)
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    // Increment view count (fire-and-forget)
                    supabase_1.supabase
                        .from("kb_articles")
                        .update({ view_count: (data.view_count || 0) + 1 })
                        .eq("id", id)
                        .then(function () { });
                    return [2 /*return*/, data];
            }
        });
    });
}
function createKbArticle(article) {
    return __awaiter(this, void 0, void 0, function () {
        var authorName, session, user, _3, _a, data, error;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    authorName = article.author_name;
                    if (!!authorName) return [3 /*break*/, 5];
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 2:
                    session = (_f.sent()).data;
                    user = (_b = session === null || session === void 0 ? void 0 : session.session) === null || _b === void 0 ? void 0 : _b.user;
                    if (user) {
                        authorName = ((_c = user.user_metadata) === null || _c === void 0 ? void 0 : _c.full_name) || ((_d = user.user_metadata) === null || _d === void 0 ? void 0 : _d.name) || ((_e = user.email) === null || _e === void 0 ? void 0 : _e.split("@")[0]) || "Admin";
                    }
                    return [3 /*break*/, 4];
                case 3:
                    _3 = _f.sent();
                    return [3 /*break*/, 4];
                case 4:
                    if (!authorName)
                        authorName = "Admin";
                    _f.label = 5;
                case 5: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_articles")
                        .insert([__assign(__assign({}, article), { author_name: authorName })])
                        .select()
                        .single()];
                case 6:
                    _a = _f.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateKbArticle(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_articles")
                        .update(updates)
                        .eq("id", id)
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteKbArticle(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("kb_articles").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
function getPopularKbArticles() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var _a, data, error;
        if (limit === void 0) { limit = 5; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_articles")
                        .select("*, category:kb_categories(id, name, icon, color)")
                        .eq("status", "published")
                        .order("view_count", { ascending: false })
                        .limit(limit)];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function getRelatedKbArticles(articleId_1) {
    return __awaiter(this, arguments, void 0, function (articleId, limit) {
        var article, query, _a, data, error;
        if (limit === void 0) { limit = 3; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("kb_articles")
                        .select("category_id, tags")
                        .eq("id", articleId)
                        .single()];
                case 1:
                    article = (_b.sent()).data;
                    if (!article)
                        return [2 /*return*/, []];
                    query = supabase_1.supabase
                        .from("kb_articles")
                        .select("id, title, category_id, tags, view_count, created_at")
                        .neq("id", articleId)
                        .eq("status", "published")
                        .limit(limit);
                    if (article.category_id) {
                        query = query.eq("category_id", article.category_id);
                    }
                    return [4 /*yield*/, query.order("view_count", { ascending: false })];
                case 2:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, data || []];
            }
        });
    });
}
// ── Anhänge ──
function addKbArticleAttachment(articleId, uri, filename) {
    return __awaiter(this, void 0, void 0, function () {
        var response, blob, path, uploadError, publicUrlData, _a, data, dbErr;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetch(uri)];
                case 1:
                    response = _b.sent();
                    return [4 /*yield*/, response.blob()];
                case 2:
                    blob = _b.sent();
                    path = "kb/".concat(articleId, "/").concat(Date.now(), "_").concat(filename);
                    return [4 /*yield*/, supabase_1.supabase.storage
                            .from("documents")
                            .upload(path, blob, {
                            contentType: blob.type || "application/octet-stream",
                            upsert: true,
                        })];
                case 3:
                    uploadError = (_b.sent()).error;
                    if (uploadError)
                        throw new Error(uploadError.message);
                    publicUrlData = supabase_1.supabase.storage
                        .from("documents")
                        .getPublicUrl(path).data;
                    return [4 /*yield*/, supabase_1.supabase
                            .from("kb_article_attachments")
                            .insert({
                            article_id: articleId,
                            file_name: filename,
                            file_url: publicUrlData.publicUrl,
                            file_type: blob.type || "application/octet-stream",
                            file_size: blob.size || 0,
                        })
                            .select()
                            .single()];
                case 4:
                    _a = _b.sent(), data = _a.data, dbErr = _a.error;
                    if (dbErr)
                        throw new Error(dbErr.message);
                    return [2 /*return*/, data];
            }
        });
    });
}
function deleteKbArticleAttachment(id) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase.from("kb_article_attachments").delete().eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        throw new Error(error.message);
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
