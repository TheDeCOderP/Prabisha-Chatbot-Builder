// hooks/useLeadGeneration.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ConversationalLeadConfig } from './useConversationalLead';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadForm {
  id: string;
  formTitle: string;
  formDesc?: string;
  leadFormStyle: 'EMBEDDED' | 'MESSAGES';
  cadence: 'ALL_AT_ONCE' | 'ONE_BY_ONE' | 'GROUPED';
  fields: string; // JSON string of LeadField[]
  successMessage?: string;
  redirectUrl?: string;
  autoClose: boolean;
  showThankYou: boolean;
}

interface UseLeadGenerationProps {
  chatbotId: string;
  conversationId: string | null;
  onLeadCollected?: (leadData: any) => void;
}

interface UseLeadGenerationReturn {
  activeLeadForm: LeadForm | null;
  isLeadFormVisible: boolean;
  shouldShowLeadForm: boolean;
  isLoadingLeadConfig: boolean;
  leadFormError: string | null;
  hasSubmittedLead: boolean;
  /** 
   * When leadFormStyle === 'MESSAGES', this is populated so the chatbot widget
   * can pass it to useConversationalLead instead of showing the modal.
   */
  conversationalLeadConfig: ConversationalLeadConfig | null;
  /** True when the lead should be collected via chat messages (not modal) */
  isConversationalMode: boolean;

  showLeadForm: () => void;
  hideLeadForm: () => void;
  submitLeadForm: (formData: Record<string, string>) => Promise<boolean>;
  checkLeadRequirements: () => Promise<void>;
  markLeadAsSubmitted: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLeadGeneration({
  chatbotId,
  conversationId,
  onLeadCollected,
}: UseLeadGenerationProps): UseLeadGenerationReturn {
  const [activeLeadForm, setActiveLeadForm] = useState<LeadForm | null>(null);
  const [conversationalLeadConfig, setConversationalLeadConfig] = useState<ConversationalLeadConfig | null>(null);
  const [isLeadFormVisible, setIsLeadFormVisible] = useState(false);
  const [shouldShowLeadForm, setShouldShowLeadForm] = useState(false);
  const [isLoadingLeadConfig, setIsLoadingLeadConfig] = useState(false);
  const [leadFormError, setLeadFormError] = useState<string | null>(null);
  const [hasSubmittedLead, setHasSubmittedLead] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);

  // ── Fetch lead config ──────────────────────────────────────────────────────
  const fetchLeadConfig = useCallback(async () => {
    if (!chatbotId || hasSubmittedLead) return;
    setIsLoadingLeadConfig(true);
    setLeadFormError(null);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/lead`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data && data.isActive) {
          setActiveLeadForm(data.config);
          setKeywords(data.triggerKeywords || []);

          // Parse fields from JSON string (schema stores fields as Json)
          let parsedFields = [];
          try {
            parsedFields = typeof data.config?.fields === 'string'
              ? JSON.parse(data.config.fields)
              : (data.config?.fields ?? []);
          } catch {
            parsedFields = [];
          }

          // Determine mode: MESSAGES = conversational, EMBEDDED = modal
          if (data.config?.leadFormStyle === 'MESSAGES') {
            setConversationalLeadConfig({
              id: data.config.id,
              fields: parsedFields,
              successMessage: data.config.successMessage,
            });
          } else {
            setConversationalLeadConfig(null);
          }

          if (data.triggerType === 'ALWAYS' || data.triggerType === 'BEGINNING') {
            setShouldShowLeadForm(true);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching lead config:', error);
      setLeadFormError('Failed to load lead form configuration');
    } finally {
      setIsLoadingLeadConfig(false);
    }
  }, [chatbotId, hasSubmittedLead]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLeadConfig();
    const hasSubmitted = localStorage.getItem(`chatbot_${chatbotId}_lead_submitted`);
    if (hasSubmitted === 'true') setHasSubmittedLead(true);
  }, [chatbotId, fetchLeadConfig]);

  // ── Check requirements ─────────────────────────────────────────────────────
  const checkLeadRequirements = useCallback(async () => {
    if (!chatbotId || !conversationId || hasSubmittedLead || !activeLeadForm) return;
    try {
      const response = await fetch(
        `/api/chatbots/${chatbotId}/check-lead-requirements?conversationId=${conversationId}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.shouldShowForm) setShouldShowLeadForm(true);
      }
    } catch (error) {
      console.error('Error checking lead requirements:', error);
    }
  }, [chatbotId, conversationId, hasSubmittedLead, activeLeadForm]);

  // ── Modal submit (EMBEDDED mode) ───────────────────────────────────────────
  const submitLeadForm = async (formData: Record<string, string>): Promise<boolean> => {
    if (!chatbotId || !conversationId || !activeLeadForm) return false;
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId: activeLeadForm.id, data: formData, conversationId, chatbotId }),
      });
      if (response.ok) {
        const result = await response.json();
        setHasSubmittedLead(true);
        localStorage.setItem(`chatbot_${chatbotId}_lead_submitted`, 'true');
        if (result.leadId && conversationId) {
          await fetch(`/api/chat/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId: result.leadId }),
          });
        }
        onLeadCollected?.(result);
        toast.success(result.successMessage || 'Thank you for your information!');
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to submit form');
        return false;
      }
    } catch (error) {
      console.error('Error submitting lead:', error);
      toast.error('An error occurred. Please try again.');
      return false;
    }
  };

  const showLeadForm = () => {
    if (activeLeadForm && !hasSubmittedLead) {
      setIsLeadFormVisible(true);
      setShouldShowLeadForm(false);
    }
  };

  const hideLeadForm = () => setIsLeadFormVisible(false);

  const markLeadAsSubmitted = () => {
    setHasSubmittedLead(true);
    setIsLeadFormVisible(false);
    setShouldShowLeadForm(false);
    localStorage.setItem(`chatbot_${chatbotId}_lead_submitted`, 'true');
  };

  return {
    activeLeadForm,
    isLeadFormVisible,
    shouldShowLeadForm,
    isLoadingLeadConfig,
    leadFormError,
    hasSubmittedLead,
    conversationalLeadConfig,
    isConversationalMode: activeLeadForm?.leadFormStyle === 'MESSAGES',
    showLeadForm,
    hideLeadForm,
    submitLeadForm,
    checkLeadRequirements,
    markLeadAsSubmitted,
  };
}