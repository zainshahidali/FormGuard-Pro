import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  try {
    await connectToDatabase();
    const duration = Date.now() - startTime;

    const stateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    const stateNumber = mongoose.connection.readyState;

    return NextResponse.json({
      status: stateNumber === 1 ? 'healthy' : 'degraded',
      database: {
        connected: stateNumber === 1,
        state: stateMap[stateNumber] || 'unknown',
        latencyMs: duration,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: {
          connected: false,
          error: error.message || 'Database connection error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

