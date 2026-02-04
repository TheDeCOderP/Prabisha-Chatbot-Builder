'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Download, 
  Eye, 
  MoreVertical,
  User,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  X,
  Check,
  ChevronDown,
  FileDown
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface LeadData {
  [key: string]: string | number | boolean;
}

interface Lead {
  id: string;
  data: LeadData;
  createdAt: string;
  chatbot: {
    id: string;
    name: string;
    workspace: {
      id: string;
      name: string;
    };
  };
  form: {
    id: string;
    title: string;
    leadTiming: string;
    leadFormStyle: string;
    fields?: any[];
  };
  conversation?: {
    id: string;
    createdAt: string;
    messages?: Array<{
      content: string;
    }>;
  };
  conversationPreview?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ChatbotInfo {
  id: string;
  name: string;
  fields: string[];
}

interface ExportConfig {
  exportType: 'all' | 'selected';
  selectedChatbotIds: string[];
  includeConversation: boolean;
  includeAllFields: boolean;
  customFields: string[];
  format: 'csv' | 'json';
}

export default function AllLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedChatbot, setSelectedChatbot] = useState<string>('all');
  const [chatbots, setChatbots] = useState<ChatbotInfo[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [showExportConfig, setShowExportConfig] = useState(false);
  
  // Export configuration state
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    exportType: 'all',
    selectedChatbotIds: [],
    includeConversation: true,
    includeAllFields: true,
    customFields: [],
    format: 'csv',
  });

  // Fetch leads with chatbot information
  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '10',
          ...(search && { search }),
          ...(selectedChatbot !== 'all' && { chatbotId: selectedChatbot }),
        });

        const res = await fetch(`/api/leads?${params.toString()}`);
        const data = await res.json();
        
        if (data.leads) {
          setLeads(data.leads);
          setPagination(data.pagination);
          
          // Extract unique chatbots with their fields
          const chatbotMap = new Map<string, ChatbotInfo>();
          
          data.leads.forEach((lead: Lead) => {
            if (!chatbotMap.has(lead.chatbot.id)) {
              const fields = extractFieldsFromForm(lead.form.fields);
              chatbotMap.set(lead.chatbot.id, {
                id: lead.chatbot.id,
                name: lead.chatbot.name,
                fields: fields,
              });
            }
          });
          
          setChatbots(Array.from(chatbotMap.values()));
        }
      } catch (error) {
        console.error("Failed to load leads", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [page, search, selectedChatbot]);

  // Helper to extract contact information from field IDs
  const extractContactInfo = (data: LeadData) => {
    // Extract based on common field patterns
    const contactInfo = {
      name: '',
      email: '',
      phone: '',
    };

    // Try to find contact information in various field formats
    Object.entries(data).forEach(([key, value]) => {
      const stringValue = String(value).toLowerCase();
      if (stringValue.includes('@') && stringValue.includes('.')) {
        contactInfo.email = String(value);
      } else if (/^[\+]?[1-9][\d]{0,15}$/.test(String(value).replace(/\D/g, ''))) {
        contactInfo.phone = String(value);
      } else if (key.toLowerCase().includes('name') || key === '1') {
        contactInfo.name = String(value);
      }
    });

    // If name not found, check other patterns
    if (!contactInfo.name) {
      Object.entries(data).forEach(([key, value]) => {
        if (!contactInfo.name && typeof value === 'string' && value.trim().length > 0) {
          // Check if it looks like a name (contains letters and spaces)
          if (/^[A-Za-z\s]+$/.test(value)) {
            contactInfo.name = value;
          }
        }
      });
    }

    return contactInfo;
  };

  // Helper to extract field names from form configuration
  const extractFieldsFromForm = (fields: any[] | undefined): string[] => {
    if (!fields || !Array.isArray(fields)) {
      return ['Name', 'Email', 'Phone'];
    }

    const fieldNames: string[] = [];
    fields.forEach((field: any) => {
      if (field.label) {
        fieldNames.push(field.label);
      } else if (field.name) {
        fieldNames.push(field.name);
      } else if (field.id) {
        fieldNames.push(`Field ${field.id}`);
      }
    });

    return fieldNames.length > 0 ? fieldNames : ['Name', 'Email', 'Phone'];
  };

  // Helper to get value from lead data by field name
  const getFieldValue = (lead: Lead, fieldName: string): string => {
    const data = lead.data;
    
    // Try direct match
    if (data[fieldName] !== undefined) {
      return String(data[fieldName]);
    }
    
    // Try case-insensitive match
    const lowerFieldName = fieldName.toLowerCase();
    for (const key in data) {
      if (key.toLowerCase() === lowerFieldName) {
        return String(data[key]);
      }
    }
    
    // Try partial match (for labels)
    for (const key in data) {
      if (fieldName.toLowerCase().includes(key.toLowerCase()) || 
          key.toLowerCase().includes(fieldName.toLowerCase())) {
        return String(data[key]);
      }
    }
    
    // Check if it's a contact field
    const contactInfo = extractContactInfo(data);
    if (fieldName.toLowerCase().includes('name') && contactInfo.name) {
      return contactInfo.name;
    }
    if (fieldName.toLowerCase().includes('email') && contactInfo.email) {
      return contactInfo.email;
    }
    if (fieldName.toLowerCase().includes('phone') && contactInfo.phone) {
      return contactInfo.phone;
    }
    
    return 'N/A';
  };

  // Quick export current view
  const handleQuickExport = () => {
    const leadsToExport = leads;
    
    if (leadsToExport.length === 0) {
      alert('No leads to export');
      return;
    }

    // Collect all unique field names
    const allFieldNames = new Set<string>();
    leadsToExport.forEach(lead => {
      if (lead.form.fields && Array.isArray(lead.form.fields)) {
        lead.form.fields.forEach((field: any) => {
          if (field.label) allFieldNames.add(field.label);
        });
      }
    });

    const fieldNames = Array.from(allFieldNames);
    if (fieldNames.length === 0) {
      fieldNames.push('Name', 'Email', 'Phone');
    }

    // Create CSV headers
    const headers = [
      'Chatbot Name',
      'Workspace',
      'Form Title',
      'Submission Date',
      ...fieldNames,
      'Conversation Preview'
    ];

    // Create CSV rows
    const csvRows = [
      headers,
      ...leadsToExport.map(lead => {
        const row = [
          `"${lead.chatbot.name}"`,
          `"${lead.chatbot.workspace.name}"`,
          `"${lead.form.title}"`,
          `"${format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}"`,
        ];

        // Add field values
        fieldNames.forEach(fieldName => {
          const value = getFieldValue(lead, fieldName);
          row.push(`"${value.replace(/"/g, '""')}"`); // Escape quotes for CSV
        });

        // Add conversation preview
        row.push(`"${(lead.conversationPreview || 'N/A').replace(/"/g, '""')}"`);

        return row.join(',');
      })
    ];

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Advanced export with configuration
  const handleAdvancedExport = () => {
    // Filter leads based on export configuration
    let leadsToExport = leads;
    if (exportConfig.exportType === 'selected' && exportConfig.selectedChatbotIds.length > 0) {
      leadsToExport = leads.filter(lead => 
        exportConfig.selectedChatbotIds.includes(lead.chatbot.id)
      );
    }

    if (leadsToExport.length === 0) {
      alert('No leads match your export criteria');
      return;
    }

    // Determine which fields to include
    let fieldsToInclude: string[] = [];
    
    if (exportConfig.includeAllFields) {
      // Collect all unique fields from selected chatbots
      const allFields = new Set<string>();
      leadsToExport.forEach(lead => {
        const fields = extractFieldsFromForm(lead.form.fields);
        fields.forEach(field => allFields.add(field));
      });
      fieldsToInclude = Array.from(allFields);
    } else {
      fieldsToInclude = exportConfig.customFields;
    }

    if (exportConfig.format === 'csv') {
      exportToCSV(leadsToExport, fieldsToInclude);
    } else {
      exportToJSON(leadsToExport, fieldsToInclude);
    }
  };

  // Export to CSV function
  const exportToCSV = (leadsToExport: Lead[], fieldsToInclude: string[]) => {
    // Create CSV headers
    const headers = [
      'ID',
      'Chatbot Name',
      'Workspace',
      'Form Title',
      'Submission Date',
      ...fieldsToInclude,
      ...(exportConfig.includeConversation ? ['Conversation Preview'] : [])
    ];

    // Create CSV rows
    const csvRows = [
      headers,
      ...leadsToExport.map(lead => {
        const row = [
          `"${lead.id}"`,
          `"${lead.chatbot.name}"`,
          `"${lead.chatbot.workspace.name}"`,
          `"${lead.form.title}"`,
          `"${format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}"`,
        ];

        // Add field values
        fieldsToInclude.forEach(fieldName => {
          const value = getFieldValue(lead, fieldName);
          row.push(`"${value.replace(/"/g, '""')}"`); // Escape quotes for CSV
        });

        // Add conversation preview if enabled
        if (exportConfig.includeConversation) {
          row.push(`"${(lead.conversationPreview || 'N/A').replace(/"/g, '""')}"`);
        }

        return row.join(',');
      })
    ];

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportConfig(false);
  };

  // Export to JSON function
  const exportToJSON = (leadsToExport: Lead[], fieldsToInclude: string[]) => {
    const jsonData = leadsToExport.map(lead => {
      const leadData: any = {
        id: lead.id,
        chatbot: lead.chatbot.name,
        workspace: lead.chatbot.workspace.name,
        form: lead.form.title,
        submissionDate: lead.createdAt,
        formattedDate: format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a'),
      };

      // Add field values
      fieldsToInclude.forEach(fieldName => {
        leadData[fieldName] = getFieldValue(lead, fieldName);
      });

      // Add conversation preview if enabled
      if (exportConfig.includeConversation && lead.conversationPreview) {
        leadData.conversationPreview = lead.conversationPreview;
      }

      return leadData;
    });

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportConfig(false);
  };

  // Get all available fields from all chatbots
  const getAllAvailableFields = (): string[] => {
    const allFields = new Set<string>();
    chatbots.forEach(chatbot => {
      chatbot.fields.forEach(field => allFields.add(field));
    });
    return Array.from(allFields);
  };

  // Export Configuration Modal
  const ExportConfigurationModal = () => {
    const availableFields = getAllAvailableFields();
    const allChatbotIds = chatbots.map(c => c.id);

    return (
      <Dialog open={showExportConfig} onOpenChange={setShowExportConfig}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Export Leads Configuration</DialogTitle>
            <DialogDescription>
              Configure what data to include in your export
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="scope" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="scope">Scope</TabsTrigger>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="format">Format</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4">
              {/* Scope Tab */}
              <TabsContent value="scope" className="space-y-4 m-0">
                <div>
                  <Label className="mb-2 block">Export Type</Label>
                  <Select
                    value={exportConfig.exportType}
                    onValueChange={(value: 'all' | 'selected') => 
                      setExportConfig({...exportConfig, exportType: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select export type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Chatbots</SelectItem>
                      <SelectItem value="selected">Selected Chatbots</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {exportConfig.exportType === 'selected' && (
                  <div className="space-y-3">
                    <Label>Select Chatbots</Label>
                    <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                      {chatbots.map(chatbot => (
                        <div key={chatbot.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`chatbot-${chatbot.id}`}
                            checked={exportConfig.selectedChatbotIds.includes(chatbot.id)}
                            onCheckedChange={(checked) => {
                              const newIds = checked
                                ? [...exportConfig.selectedChatbotIds, chatbot.id]
                                : exportConfig.selectedChatbotIds.filter(id => id !== chatbot.id);
                              setExportConfig({...exportConfig, selectedChatbotIds: newIds});
                            }}
                          />
                          <label
                            htmlFor={`chatbot-${chatbot.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {chatbot.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="include-conversation"
                    checked={exportConfig.includeConversation}
                    onCheckedChange={(checked) => 
                      setExportConfig({...exportConfig, includeConversation: checked as boolean})
                    }
                  />
                  <label
                    htmlFor="include-conversation"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include conversation preview
                  </label>
                </div>
              </TabsContent>

              {/* Fields Tab */}
              <TabsContent value="fields" className="space-y-4 m-0">
                <div className="space-y-3">
                  <Label>Field Selection</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="all-fields"
                        checked={exportConfig.includeAllFields}
                        onChange={() => setExportConfig({...exportConfig, includeAllFields: true})}
                        className="rounded"
                      />
                      <label htmlFor="all-fields" className="text-sm">
                        Include all fields from selected chatbots
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="custom-fields"
                        checked={!exportConfig.includeAllFields}
                        onChange={() => setExportConfig({...exportConfig, includeAllFields: false})}
                        className="rounded"
                      />
                      <label htmlFor="custom-fields" className="text-sm">
                        Select specific fields
                      </label>
                    </div>
                  </div>

                  {!exportConfig.includeAllFields && (
                    <div className="border rounded-md p-4">
                      <Label className="mb-3 block">Available Fields</Label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {availableFields.map(field => (
                          <div key={field} className="flex items-center space-x-2">
                            <Checkbox
                              id={`field-${field}`}
                              checked={exportConfig.customFields.includes(field)}
                              onCheckedChange={(checked) => {
                                const newFields = checked
                                  ? [...exportConfig.customFields, field]
                                  : exportConfig.customFields.filter(f => f !== field);
                                setExportConfig({...exportConfig, customFields: newFields});
                              }}
                            />
                            <label
                              htmlFor={`field-${field}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {field}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Format Tab */}
              <TabsContent value="format" className="space-y-4 m-0">
                <div>
                  <Label className="mb-2 block">Export Format</Label>
                  <Select
                    value={exportConfig.format}
                    onValueChange={(value: 'csv' | 'json') => 
                      setExportConfig({...exportConfig, format: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                      <SelectItem value="json">JSON (Structured Data)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-muted p-4 rounded-md">
                  <h4 className="text-sm font-medium mb-2">Export Summary</h4>
                  <div className="text-sm space-y-1">
                    <p>• Format: {exportConfig.format.toUpperCase()}</p>
                    <p>• Scope: {exportConfig.exportType === 'all' ? 'All chatbots' : `${exportConfig.selectedChatbotIds.length} selected chatbots`}</p>
                    <p>• Fields: {exportConfig.includeAllFields ? 'All available fields' : `${exportConfig.customFields.length} selected fields`}</p>
                    <p>• Conversation: {exportConfig.includeConversation ? 'Included' : 'Excluded'}</p>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowExportConfig(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdvancedExport}>
              <Download className="h-4 w-4 mr-2" />
              Export {exportConfig.exportType === 'all' ? leads.length : 
                leads.filter(l => exportConfig.selectedChatbotIds.includes(l.chatbot.id)).length} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Lead Details Modal
  const LeadDetailsModal = () => {
    if (!selectedLead) return null;

    const contactInfo = extractContactInfo(selectedLead.data);
    const formFields = selectedLead.form.fields || [];

    return (
      <Dialog open={showLeadDetails} onOpenChange={setShowLeadDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Submitted {format(new Date(selectedLead.createdAt), 'PPpp')}
            </p>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chatbot Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Source</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Chatbot:</span>
                    <span className="text-sm">{selectedLead.chatbot.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Workspace:</span>
                    <span className="text-sm">{selectedLead.chatbot.workspace.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Form:</span>
                    <span className="text-sm">{selectedLead.form.title}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contactInfo.name && (
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary p-2 rounded-full">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Name</p>
                        <p className="text-sm text-muted-foreground">{contactInfo.name}</p>
                      </div>
                    </div>
                  )}
                  {contactInfo.email && (
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary p-2 rounded-full">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{contactInfo.email}</p>
                      </div>
                    </div>
                  )}
                  {contactInfo.phone && (
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary p-2 rounded-full">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{contactInfo.phone}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Form Data */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Form Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formFields.length > 0 ? (
                    formFields.map((field: any, index: number) => {
                      const fieldName = field.label || field.name || `Field ${index + 1}`;
                      const fieldValue = getFieldValue(selectedLead, fieldName);
                      
                      return (
                        <div key={index} className="grid grid-cols-3 gap-4 py-2 border-b last:border-0">
                          <div className="col-span-1">
                            <p className="text-sm font-medium">{fieldName}</p>
                            {field.type && (
                              <p className="text-xs text-muted-foreground">{field.type}</p>
                            )}
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm">{fieldValue}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(selectedLead.data).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 gap-4 py-2 border-b last:border-0">
                          <div className="col-span-1">
                            <p className="text-sm font-medium">{key}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm">{String(value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conversation Preview */}
            {selectedLead.conversationPreview && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Conversation Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm">{selectedLead.conversationPreview}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              {contactInfo.email && (
                <Button variant="outline" size="sm" onClick={() => window.location.href = `mailto:${contactInfo.email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              )}
              {contactInfo.phone && (
                <Button variant="outline" size="sm" onClick={() => window.location.href = `tel:${contactInfo.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage all captured leads
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleQuickExport} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            Quick Export
          </Button>
          <Button onClick={() => setShowExportConfig(true)}>
            <Download className="h-4 w-4 mr-2" />
            Advanced Export
          </Button>
        </div>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `Showing ${leads.length} of ${pagination?.total || 0} leads`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Select value={selectedChatbot} onValueChange={setSelectedChatbot}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Chatbots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chatbots</SelectItem>
                {chatbots.map(chatbot => (
                  <SelectItem key={chatbot.id} value={chatbot.id}>{chatbot.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-12 w-full" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <User className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No leads found</p>
                        {search && (
                          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                            Clear search
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => {
                    const contact = extractContactInfo(lead.data);
                    return (
                      <TableRow key={lead.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {contact.name || 'Anonymous'}
                              </span>
                              {contact.email && (
                                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {contact.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{lead.chatbot.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {lead.chatbot.workspace.name}
                            </p>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            <div>{format(new Date(lead.createdAt), 'MMM d, yyyy')}</div>
                            <div className="text-muted-foreground">
                              {format(new Date(lead.createdAt), 'h:mm a')}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                setSelectedLead(lead);
                                setShowLeadDetails(true);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {contact.email && (
                                <DropdownMenuItem onClick={() => window.location.href = `mailto:${contact.email}`}>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Send Email
                                </DropdownMenuItem>
                              )}
                              {contact.phone && (
                                <DropdownMenuItem onClick={() => window.location.href = `tel:${contact.phone}`}>
                                  <Phone className="h-4 w-4 mr-2" />
                                  Call
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {showLeadDetails && <LeadDetailsModal />}
      <ExportConfigurationModal />
    </div>
  );
}