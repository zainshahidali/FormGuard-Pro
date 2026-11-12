import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IFormTestResult {
  formId?: string;
  formName: string;
  pageUrl: string;
  status: 'passed' | 'failed';
  durationMs: number;
  errorMessage?: string;
  consoleErrors?: string[];
  screenshotBase64?: string;
}

export interface ITestLog extends Document {
  siteId: Types.ObjectId;
  status: 'passed' | 'failed';
  durationMs: number;
  errorMessage?: string;
  consoleErrors: string[];
  screenshotBase64?: string;
  formResults?: IFormTestResult[];
  notificationsSent: {
    email: boolean;
    slack: boolean;
  };
  executedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TestLogSchema = new Schema<ITestLog>(
  {
    siteId: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['passed', 'failed'],
      required: true,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: '',
    },
    consoleErrors: {
      type: [String],
      default: [],
    },
    screenshotBase64: {
      type: String,
      default: '',
    },
    formResults: {
      type: [
        {
          formId: String,
          formName: String,
          pageUrl: String,
          status: { type: String, enum: ['passed', 'failed'] },
          durationMs: Number,
          errorMessage: String,
          consoleErrors: [String],
          screenshotBase64: String,
        },
      ],
      default: [],
    },
    notificationsSent: {
      email: { type: Boolean, default: false },
      slack: { type: Boolean, default: false },
    },
    executedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TestLogSchema.index({ executedAt: -1, status: 1 });
TestLogSchema.index({ siteId: 1, executedAt: -1 });

export const TestLog: Model<ITestLog> =
  mongoose.models.TestLog || mongoose.model<ITestLog>('TestLog', TestLogSchema);

export default TestLog;

