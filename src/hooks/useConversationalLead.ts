// hooks/useConversationalLead.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadField {
  id: string;
  type: 'TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'LINK' | 
        'SELECT' | 'RADIO' | 'CHECKBOX' | 'TEXTAREA' | 'MULTISELECT';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // for SELECT, RADIO, CHECKBOX, MULTISELECT
}

export interface ConversationalLeadConfig {
  id: string;               // ChatbotForm.id
  fields: LeadField[];
  successMessage?: string;
}

export type LeadCollectionStatus = 
  | 'idle'          // not started
  | 'collecting'    // asking fields one by one
  | 'submitting'    // calling /api/leads
  | 'done'          // submitted successfully
  | 'error';        // submission failed

interface UseConversationalLeadProps {
  chatbotId: string;
  conversationId: string | null;
  config: ConversationalLeadConfig | null;
  /** Called when the hook wants to inject a BOT message into the chat */
  onBotMessage: (content: string) => void;
  /** Called when lead is fully collected and submitted */
  onLeadCollected?: (leadData: Record<string, string>) => void;
}

interface UseConversationalLeadReturn {
  status: LeadCollectionStatus;
  currentFieldIndex: number;
  collectedData: Record<string, string>;
  /** Call this to kick off lead collection (replaces showLeadForm) */
  startLeadCollection: () => void;
  /** 
   * Call this with the user's latest message text.
   * Returns true if the message was consumed as a lead answer (so the
   * normal chat submit should be skipped), false otherwise.
   */
  handleUserMessage: (text: string) => Promise<boolean>;
  /** True while we're waiting for an answer to a lead field */
  isAwaitingLeadAnswer: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFieldValue(field: LeadField, value: string): string | null {
  const v = value.trim();
  if (!v && field.required) return `Please provide your ${field.label.toLowerCase()}.`;

  switch (field.type) {
    case 'EMAIL': {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      return ok ? null : 'Please enter a valid email address.';
    }
    case 'PHONE': {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 7 ? null : 'Please enter a valid phone number.';
    }
    case 'NUMBER':
    case 'CURRENCY': {
      return isNaN(Number(v)) ? 'Please enter a valid number.' : null;
    }
    case 'LINK': {
      try { new URL(v); return null; } catch { return 'Please enter a valid URL.'; }
    }
    case 'SELECT':
    case 'RADIO': {
      if (!field.options?.length) return null;
      const opts = field.options.map(o => o.toLowerCase());
      return opts.includes(v.toLowerCase()) 
        ? null 
        : `Please choose one of: ${field.options.join(', ')}.`;
    }
    default:
      return null;
  }
}

// ─── Question builder ─────────────────────────────────────────────────────────

function buildQuestion(field: LeadField, isFirst: boolean): string {
  const prefix = isFirst
    ? "Before we continue, I'd love to know a bit more about you. 😊\n\n"
    : '';

  let question = '';

  switch (field.type) {
    case 'EMAIL':
      question = `May I have your email address?`;
      break;
    case 'PHONE':
      question = `What's the best phone number to reach you?`;
      break;
    case 'SELECT':
    case 'RADIO':
      question = `${field.label}?`;
      if (field.options?.length) {
        question += `\n\nOptions: ${field.options.map((o, i) => `${i + 1}. ${o}`).join(' | ')}`;
      }
      break;
    case 'CHECKBOX':
    case 'MULTISELECT':
      question = `${field.label}? (You can list multiple)`;
      if (field.options?.length) {
        question += `\n\nOptions: ${field.options.map((o, i) => `${i + 1}. ${o}`).join(' | ')}`;
      }
      break;
    case 'TEXTAREA':
      question = `${field.label} — feel free to share as much detail as you like.`;
      break;
    default:
      question = `May I know your ${field.label.toLowerCase()}?`;
  }

  if (field.placeholder && !['SELECT','RADIO','CHECKBOX','MULTISELECT'].includes(field.type)) {
    question += `\n(e.g. ${field.placeholder})`;
  }

  if (!field.required) {
    question += '\n(Optional — type "skip" to skip this one)';
  }

  return prefix + question;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversationalLead({
  chatbotId,
  conversationId,
  config,
  onBotMessage,
  onLeadCollected,
}: UseConversationalLeadProps): UseConversationalLeadReturn {

  const [status, setStatus] = useState<LeadCollectionStatus>('idle');
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  // Track retry count for the current field (for validation errors)
  const retryCount = useRef(0);

  const fields = config?.fields ?? [];
  const isAwaitingLeadAnswer = status === 'collecting';

  // ── Start ──────────────────────────────────────────────────────────────────
  const startLeadCollection = useCallback(() => {
    if (!config || !fields.length || status !== 'idle') return;
    setStatus('collecting');
    setCurrentFieldIndex(0);
    setCollectedData({});
    retryCount.current = 0;
    onBotMessage(buildQuestion(fields[0], true));
  }, [config, fields, status, onBotMessage]);

  // ── Submit to API ──────────────────────────────────────────────────────────
  const submitLead = useCallback(async (data: Record<string, string>) => {
    if (!chatbotId || !conversationId || !config) return;
    setStatus('submitting');

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: config.id,
          data,
          conversationId,
          chatbotId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setStatus('done');
        onLeadCollected?.(data);
        toast.success(config.successMessage || 'Thank you! We\'ll be in touch soon. 🎉');
        onBotMessage(
          config.successMessage || 
          "Thank you so much! I've noted your details. Now, how can I help you further? 😊"
        );
        localStorage.setItem(`chatbot_${chatbotId}_lead_submitted`, 'true');
      } else {
        throw new Error('Lead submission failed');
      }
    } catch (err) {
      console.error('Lead submission error:', err);
      setStatus('error');
      toast.error('Something went wrong saving your details. Please try again.');
      onBotMessage("Sorry, I had trouble saving your details. Let's try again — " + buildQuestion(fields[currentFieldIndex], false));
    }
  }, [chatbotId, conversationId, config, fields, currentFieldIndex, onBotMessage, onLeadCollected]);

  // ── Handle user reply ──────────────────────────────────────────────────────
  const handleUserMessage = useCallback(async (text: string): Promise<boolean> => {
    // Not in collecting mode — pass message through to normal chat
    if (status !== 'collecting') return false;

    const field = fields[currentFieldIndex];
    if (!field) return false;

    const trimmed = text.trim();
    const isSkip = trimmed.toLowerCase() === 'skip';

    // Handle optional skip
    if (isSkip && !field.required) {
      // Record empty for optional fields
      const newData = { ...collectedData, [field.label]: '' };
      setCollectedData(newData);

      const nextIndex = currentFieldIndex + 1;
      if (nextIndex >= fields.length) {
        await submitLead(newData);
      } else {
        setCurrentFieldIndex(nextIndex);
        retryCount.current = 0;
        onBotMessage(buildQuestion(fields[nextIndex], false));
      }
      return true;
    }

    // Validate
    const validationError = validateFieldValue(field, trimmed);
    if (validationError) {
      retryCount.current += 1;
      if (retryCount.current >= 3) {
        // After 3 failed attempts on a required field, skip if optional, or accept as-is
        if (!field.required) {
          onBotMessage("No worries, let's move on! " + (currentFieldIndex + 1 < fields.length ? buildQuestion(fields[currentFieldIndex + 1], false) : ''));
          const newData = { ...collectedData, [field.label]: trimmed };
          setCollectedData(newData);
          const nextIndex = currentFieldIndex + 1;
          if (nextIndex >= fields.length) {
            await submitLead(newData);
          } else {
            setCurrentFieldIndex(nextIndex);
            retryCount.current = 0;
          }
        } else {
          onBotMessage(`I'll accept that for now. ${buildQuestion(fields[currentFieldIndex + 1] ?? field, false)}`);
          const newData = { ...collectedData, [field.label]: trimmed };
          setCollectedData(newData);
          const nextIndex = currentFieldIndex + 1;
          if (nextIndex >= fields.length) {
            await submitLead(newData);
          } else {
            setCurrentFieldIndex(nextIndex);
            retryCount.current = 0;
          }
        }
      } else {
        onBotMessage(`${validationError} Please try again.`);
      }
      return true; // still consumed
    }

    // Valid — store and advance
    retryCount.current = 0;
    const newData = { ...collectedData, [field.label]: trimmed };
    setCollectedData(newData);

    const nextIndex = currentFieldIndex + 1;

    if (nextIndex >= fields.length) {
      // All fields collected
      await submitLead(newData);
    } else {
      setCurrentFieldIndex(nextIndex);
      // Small acknowledgment + next question
      const acks = ['Got it!', 'Perfect!', 'Thanks!', 'Great!', 'Noted!'];
      const ack = acks[Math.floor(Math.random() * acks.length)];
      onBotMessage(`${ack} ${buildQuestion(fields[nextIndex], false)}`);
    }

    return true; // message was consumed by lead flow
  }, [status, fields, currentFieldIndex, collectedData, submitLead, onBotMessage]);

  return {
    status,
    currentFieldIndex,
    collectedData,
    startLeadCollection,
    handleUserMessage,
    isAwaitingLeadAnswer,
  };
}