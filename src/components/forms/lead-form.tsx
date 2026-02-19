// components/chat/LeadCollectionForm.tsx - Updated version
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
}

interface LeadConfig {
  id: string;
  formTitle: string;
  formDesc?: string;
  leadFormStyle: 'EMBEDDED' | 'MESSAGES';
  cadence: 'ALL_AT_ONCE' | 'ONE_BY_ONE' | 'GROUPED';
  fields: string; // JSON string
  successMessage?: string;
  redirectUrl?: string;
  autoClose: boolean;
  showThankYou: boolean;
}

interface LeadFormProps {
  config: LeadConfig;
  chatbotId: string;
  conversationId: string;
  onClose?: () => void;
  onSuccess?: () => void;
  onSubmitLead?: (formData: Record<string, string>) => Promise<boolean>;
}

export function LeadForm({
  config,
  chatbotId,
  conversationId,
  onClose,
  onSuccess,
  onSubmitLead,
}: LeadFormProps) {
  const fields: FormField[] = JSON.parse(config.fields);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateField = (field: FormField, value: string): string | null => {
    if (field.required && !value) {
      return `${field.label} is required`;
    }

    if (value) {
      if (field.type === 'EMAIL') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Invalid email address';
        }
      } else if (field.type === 'PHONE') {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(value)) {
          return 'Invalid phone number';
        }
      } else if (field.type === 'NUMBER' || field.type === 'CURRENCY') {
        if (isNaN(Number(value))) {
          return 'Must be a number';
        }
      } else if (field.type === 'LINK') {
        try {
          new URL(value);
        } catch {
          return 'Invalid URL';
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    // Validate all fields
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      const error = validateField(field, formData[field.id] || '');
      if (error) {
        newErrors[field.id] = error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      let success = false;
      
      // Use the provided submit function if available
      if (onSubmitLead) {
        success = await onSubmitLead(formData);
      } else {
        // Fallback to direct API call
        const response = await fetch(`/api/chatbots/${chatbotId}/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formId: config.id,
            data: formData,
            conversationId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.errors) {
            setErrors(result.errors);
          } else {
            toast.error(result.error || 'Failed to submit form');
          }
          setIsSubmitting(false);
          return;
        }
        
        success = true;
      }

      if (success) {
        setIsSuccess(true);

        if (config.showThankYou) {
          toast.success(config.successMessage || 'Thank you! We\'ll be in touch soon.');
        }

        // Redirect if configured
        if (config.redirectUrl) {
          setTimeout(() => {
            window.open(config.redirectUrl, '_blank');
          }, 1500);
        }

        // Auto close if configured
        if (config.autoClose) {
          setTimeout(() => {
            onSuccess?.();
            onClose?.();
          }, 2000);
        } else {
          onSuccess?.();
        }
      }
    } catch (error) {
      console.error('Error submitting lead:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextField = () => {
    const currentField = fields[currentFieldIndex];
    const error = validateField(currentField, formData[currentField.id] || '');

    if (error) {
      setErrors({ [currentField.id]: error });
      return;
    }

    if (currentFieldIndex < fields.length - 1) {
      setCurrentFieldIndex((prev) => prev + 1);
    }
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      id: field.id,
      value: formData[field.id] || field.defaultValue || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        handleInputChange(field.id, e.target.value),
      placeholder: field.placeholder,
      required: field.required,
      className: errors[field.id] ? 'border-red-500' : '',
      disabled: isSubmitting,
    };

    switch (field.type) {
      case 'TEXTAREA':
        return (
          <textarea
            {...commonProps}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md ${
              errors[field.id] ? 'border-red-500' : 'border-gray-300'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        );

      case 'SELECT':
        return (
          <select
            {...commonProps}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className={`w-full px-3 py-2 border rounded-md ${
              errors[field.id] ? 'border-red-500' : 'border-gray-300'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">Select...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'RADIO':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={formData[field.id] === option}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-4 h-4"
                  disabled={isSubmitting}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'CHECKBOX':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => {
              const values = formData[field.id]?.split(',') || [];
              return (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={option}
                    checked={values.includes(option)}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...values, option]
                        : values.filter((v) => v !== option);
                      handleInputChange(field.id, newValues.join(','));
                    }}
                    className="w-4 h-4"
                    disabled={isSubmitting}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        );

      case 'EMAIL':
        return <Input {...commonProps} type="email" />;

      case 'PHONE':
        return <Input {...commonProps} type="tel" />;

      case 'NUMBER':
      case 'CURRENCY':
        return <Input {...commonProps} type="number" />;

      case 'DATE':
        return <Input {...commonProps} type="date" />;

      case 'LINK':
        return <Input {...commonProps} type="url" />;

      default:
        return <Input {...commonProps} type="text" />;
    }
  };

  if (isSuccess && config.showThankYou) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <h3 className="font-semibold text-lg">
            {config.successMessage || 'Thank you!'}
          </h3>
          <p className="text-sm text-muted-foreground">
            We'll be in touch soon.
          </p>
          {!config.autoClose && onClose && (
            <Button onClick={onClose} variant="outline" className="mt-4 cursor-pointer">
              Close
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // One-by-one cadence
  if (config.cadence === 'ONE_BY_ONE') {
    const currentField = fields[currentFieldIndex];
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{config.formTitle}</h3>
            {onClose && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {config.formDesc && (
            <p className="text-sm text-muted-foreground">{config.formDesc}</p>
          )}

          <div className="space-y-3">
            <div>
              <Label htmlFor={currentField.id}>
                {currentField.label}
                {currentField.required && <span className="text-red-500">*</span>}
              </Label>
              {renderField(currentField)}
              {errors[currentField.id] && (
                <p className="text-xs text-red-500 mt-1">
                  {errors[currentField.id]}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {currentFieldIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentFieldIndex((prev) => prev - 1)}
                  className="flex-1 cursor-pointer"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              )}
              {currentFieldIndex < fields.length - 1 ? (
                <Button 
                  onClick={handleNextField} 
                  className="flex-1 cursor-pointer"
                  disabled={isSubmitting}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              )}
            </div>

            <div className="flex gap-1 justify-center mt-4">
              {fields.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    index === currentFieldIndex
                      ? 'bg-blue-500'
                      : index < currentFieldIndex
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // All at once or grouped cadence (standard form)
  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{config.formTitle}</h3>
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              type="button"
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {config.formDesc && (
          <p className="text-sm text-muted-foreground">{config.formDesc}</p>
        )}

        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.id}>
              <Label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </Label>
              {renderField(field)}
              {errors[field.id] && (
                <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4">
          {onClose && (
            <Button 
              variant="outline" 
              onClick={onClose} 
              type="button" 
              className="flex-1 cursor-pointer"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting} className="flex-1 cursor-pointer">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}