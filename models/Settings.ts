import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
}

export interface ISettings extends Document {
  defaultNotificationEmails: string[];
  defaultSlackWebhookUrl?: string;
  defaultSlackChannelName?: string;
  smtpConfig?: ISmtpConfig;
  testBotEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    defaultNotificationEmails: {
      type: [String],
      default: ['zanshahidali@gmail.com'],
    },
    defaultSlackWebhookUrl: {
      type: String,
      default: '',
    },
    defaultSlackChannelName: {
      type: String,
      default: '',
    },
    smtpConfig: {
      host: { type: String, default: '' },
      port: { type: Number, default: 587 },
      user: { type: String, default: '' },
      pass: { type: String, default: '' },
      fromEmail: { type: String, default: 'alerts@formguardpro.com' },
    },
    testBotEmail: {
      type: String,
      default: 'qa-bot@formguardpro.com',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent mongoose model overwrite in hot reload Next.js environment
export const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;

