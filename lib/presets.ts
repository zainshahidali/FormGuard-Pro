import { IFormField } from '@/models/Site';

export interface FormPreset {
  name: string;
  pluginType: 'Elementor Pro' | 'Contact Form 7' | 'MetForm' | 'WPForms' | 'Gravity Forms' | 'Custom';
  description: string;
  submitButtonSelector: string;
  verificationMethod: 'text_visible' | 'selector_visible' | 'url_redirect';
  expectedSuccessValue: string;
  fields: IFormField[];
}

export const FORM_PRESETS: Record<string, FormPreset> = {
  'Elementor Pro': {
    name: 'Elementor Pro Contact Form',
    pluginType: 'Elementor Pro',
    description: 'Standard Elementor Pro Form widget selectors',
    submitButtonSelector: 'form.elementor-form button[type="submit"], button.elementor-button[type="submit"]',
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '.elementor-message-success',
    fields: [
      {
        label: 'Name',
        selector: 'input[name="form_fields[name]"], input[name="form_fields[field_name]"]',
        type: 'text',
        testValue: 'Test User',
      },
      {
        label: 'Email',
        selector: 'input[name="form_fields[email]"], input[name="form_fields[field_email]"]',
        type: 'email',
        testValue: 'test@gmail.com',
      },
      {
        label: 'Phone',
        selector: 'input[name="form_fields[field_phone]"], input[name="form_fields[phone]"], input[type="tel"]',
        type: 'tel',
        testValue: '+1 555-019-2834',
      },
      {
        label: 'Message',
        selector: 'textarea[name="form_fields[message]"], textarea[name="form_fields[field_message]"]',
        type: 'textarea',
        testValue: 'Testing',
      },
    ],
  },
  'Contact Form 7': {
    name: 'Contact Form 7 (CF7)',
    pluginType: 'Contact Form 7',
    description: 'Standard Contact Form 7 input fields and AJAX response block',
    submitButtonSelector: 'form.wpcf7-form input[type="submit"], form.wpcf7-form button[type="submit"], input.wpcf7-submit',
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '.wpcf7-mail-sent-ok, .wpcf7-response-output',
    fields: [
      {
        label: 'Your Name',
        selector: 'input[name="your-name"]',
        type: 'text',
        testValue: 'Test User',
      },
      {
        label: 'Your Email',
        selector: 'input[name="your-email"]',
        type: 'email',
        testValue: 'test@gmail.com',
      },
      {
        label: 'Your Phone',
        selector: 'input[name="your-tel"], input[name="your-phone"]',
        type: 'tel',
        testValue: '+1 555-019-2834',
      },
      {
        label: 'Your Message',
        selector: 'textarea[name="your-message"]',
        type: 'textarea',
        testValue: 'Testing',
      },
    ],
  },
  'MetForm': {
    name: 'MetForm Elementor Addon',
    pluginType: 'MetForm',
    description: 'MetForm input fields & confirmation container',
    submitButtonSelector: 'button.metform-btn[type="submit"], .metform-btn',
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '.metform-success-message, .mf-success-message',
    fields: [
      {
        label: 'Name',
        selector: 'input[name="mf-listing-name"], input[name="name"], input[name="mf-text"]',
        type: 'text',
        testValue: 'Test User',
      },
      {
        label: 'Email',
        selector: 'input[name="mf-email"]',
        type: 'email',
        testValue: 'test@gmail.com',
      },
      {
        label: 'Phone',
        selector: 'input[name="mf-telephone"], input[name="mf-number"]',
        type: 'tel',
        testValue: '+1 555-019-2834',
      },
      {
        label: 'Message',
        selector: 'textarea[name="mf-textarea"], textarea[name="mf-comment"]',
        type: 'textarea',
        testValue: 'Testing',
      },
    ],
  },
  'WPForms': {
    name: 'WPForms',
    pluginType: 'WPForms',
    description: 'Standard WPForms input classes & confirmation box',
    submitButtonSelector: 'button.wpforms-submit[type="submit"]',
    verificationMethod: 'selector_visible',
    expectedSuccessValue: 'div.wpforms-confirmation-container-full, .wpforms-confirmation-container',
    fields: [
      {
        label: 'Name',
        selector: 'input.wpforms-field-name-first, input[name*="[first]"], input[id*="wpforms-field_1"]',
        type: 'text',
        testValue: 'Test User',
      },
      {
        label: 'Email',
        selector: 'input[type="email"].wpforms-field-email, input[id*="wpforms-field_2"]',
        type: 'email',
        testValue: 'test@gmail.com',
      },
      {
        label: 'Phone',
        selector: 'input[type="tel"], input.wpforms-field-phone',
        type: 'tel',
        testValue: '+1 555-019-2834',
      },
      {
        label: 'Message',
        selector: 'textarea.wpforms-field-medium, textarea[id*="wpforms-field_3"]',
        type: 'textarea',
        testValue: 'Testing',
      },
    ],
  },
  'Gravity Forms': {
    name: 'Gravity Forms',
    pluginType: 'Gravity Forms',
    description: 'Standard Gravity Forms inputs & confirmation container',
    submitButtonSelector: 'input.gform_button[type="submit"], button.gform_button',
    verificationMethod: 'selector_visible',
    expectedSuccessValue: 'div.gform_confirmation_message, .gforms_confirmation_message',
    fields: [
      {
        label: 'Name',
        selector: 'input.ginput_first, input[name*="input_1.3"], input[name*="input_1"]',
        type: 'text',
        testValue: 'Test User',
      },
      {
        label: 'Email',
        selector: 'input[type="email"].ginput_email, input[name*="input_2"]',
        type: 'email',
        testValue: 'test@gmail.com',
      },
      {
        label: 'Phone',
        selector: 'input[type="tel"].ginput_phone, input[name*="input_3"]',
        type: 'tel',
        testValue: '+1 555-019-2834',
      },
      {
        label: 'Message',
        selector: 'textarea.textarea, textarea[name*="input_4"]',
        type: 'textarea',
        testValue: 'Testing',
      },
    ],
  },
  'Custom': {
    name: 'Generic / Custom Form',
    pluginType: 'Custom',
    description: 'Custom selectors matching standard HTML5 contact forms',
    submitButtonSelector: 'button[type="submit"], input[type="submit"]',
    verificationMethod: 'text_visible',
    expectedSuccessValue: 'Thank you',
    fields: [
      {
        label: 'Name',
        selector: 'input[name="name"], input[id="name"], input[type="text"]',
        type: 'text',
        testValue: 'Test User',
      },
      {
        label: 'Email',
        selector: 'input[name="email"], input[id="email"], input[type="email"]',
        type: 'email',
        testValue: 'test@gmail.com',
      },
      {
        label: 'Message',
        selector: 'textarea[name="message"], textarea[id="message"], textarea',
        type: 'textarea',
        testValue: 'Testing',
      },
    ],
  },
};

