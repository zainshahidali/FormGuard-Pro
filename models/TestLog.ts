import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITestLog extends Document {
  siteId: Types.ObjectId;
  status: 'passed' | 'failed';
  durationMs: number;
  errorMessage?: string;
  consoleErrors: string[];
  screenshotBase64?: string;
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

export const TestLog: Model<ITestLog> =
  mongoose.models.TestLog || mongoose.model<ITestLog>('TestLog', TestLogSchema);

export default TestLog;

