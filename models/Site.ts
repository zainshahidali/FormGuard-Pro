import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFormField {
  label: string;
  selector: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'file';
  testValue: string;
}

export interface IFormItem {
  id: string;
  name: string;
  pageUrl: string;
  formPluginType: 'Elementor Pro' | 'Contact Form 7' | 'MetForm' | 'WPForms' | 'Gravity Forms' | 'Custom';
  fields: IFormField[];
  submitButtonSelector: string;
  verificationMethod: 'text_visible' | 'selector_visible' | 'url_redirect';
  expectedSuccessValue: string;
  isActive: boolean;
  lastStatus?: 'healthy' | 'failing' | 'pending';
  lastCheckedAt?: Date;
  lastErrorMessage?: string;
  lastScreenshotBase64?: string;
}

export interface INotificationPreferences {
  useGlobalDefaults: boolean;
  enableEmail: boolean;
  customEmails: string[];
  enableSlack: boolean;
  customSlackWebhookUrl?: string;
  notifyOnSuccess: boolean;
}

export interface ISite extends Document {
  name: string;
  url: string;
  formPluginType?: 'Elementor Pro' | 'Contact Form 7' | 'MetForm' | 'WPForms' | 'Gravity Forms' | 'Custom';
  fields?: IFormField[];
  submitButtonSelector?: string;
  verificationMethod?: 'text_visible' | 'selector_visible' | 'url_redirect';
  expectedSuccessValue?: string;
  forms: IFormItem[];
  notificationPreferences: INotificationPreferences;
  isActive: boolean;
  lastStatus: 'healthy' | 'failing' | 'pending';
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FormFieldSchema = new Schema<IFormField>(
  {
    label: { type: String, required: true },
    selector: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'email', 'tel', 'textarea', 'select', 'checkbox', 'file'],
      default: 'text',
    },
    testValue: { type: String, default: '' },
  },
  { _id: false }
);

const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    useGlobalDefaults: { type: Boolean, default: true },
    enableEmail: { type: Boolean, default: true },
    customEmails: { type: [String], default: [] },
    enableSlack: { type: Boolean, default: true },
    customSlackWebhookUrl: { type: String, default: '' },
    notifyOnSuccess: { type: Boolean, default: false },
  },
  { _id: false }
);

const FormItemSchema = new Schema<IFormItem>(
  {
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    name: { type: String, required: true, trim: true },
    pageUrl: { type: String, required: true, trim: true },
    formPluginType: {
      type: String,
      enum: ['Elementor Pro', 'Contact Form 7', 'MetForm', 'WPForms', 'Gravity Forms', 'Custom'],
      default: 'Elementor Pro',
    },
    fields: {
      type: [FormFieldSchema],
      default: [],
    },
    submitButtonSelector: {
      type: String,
      required: true,
      default: 'button[type="submit"]',
    },
    verificationMethod: {
      type: String,
      enum: ['text_visible', 'selector_visible', 'url_redirect'],
      default: 'text_visible',
    },
    expectedSuccessValue: {
      type: String,
      required: true,
      default: 'Thank you',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastStatus: {
      type: String,
      enum: ['healthy', 'failing', 'pending'],
      default: 'pending',
    },
    lastCheckedAt: { type: Date },
    lastErrorMessage: { type: String, default: '' },
    lastScreenshotBase64: { type: String, default: '' },
  },
  { _id: false }
);

const SiteSchema = new Schema<ISite>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    forms: {
      type: [FormItemSchema],
      default: [],
    },
    formPluginType: {
      type: String,
      enum: ['Elementor Pro', 'Contact Form 7', 'MetForm', 'WPForms', 'Gravity Forms', 'Custom'],
      default: 'Elementor Pro',
    },
    fields: {
      type: [FormFieldSchema],
      default: [],
    },
    submitButtonSelector: {
      type: String,
      default: 'button[type="submit"]',
    },
    verificationMethod: {
      type: String,
      enum: ['text_visible', 'selector_visible', 'url_redirect'],
      default: 'text_visible',
    },
    expectedSuccessValue: {
      type: String,
      default: 'Thank you',
    },
    notificationPreferences: {
      type: NotificationPreferencesSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastStatus: {
      type: String,
      enum: ['healthy', 'failing', 'pending'],
      default: 'pending',
    },
    lastCheckedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Site: Model<ISite> =
  mongoose.models.Site || mongoose.model<ISite>('Site', SiteSchema);

export default Site;

