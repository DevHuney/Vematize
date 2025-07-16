// This file is deprecated and no longer in use.
// The webhook logic has been moved to a static route at /telegram-hook
// to better handle webhook registration and avoid routing conflicts.

import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        { 
            success: false, 
            message: `This webhook URL is deprecated. The system has been updated to use a new route structure. Please re-save your bot settings in the admin panel to activate the new webhook.`,
        }, 
        { status: 410 } // 410 Gone
    );
}
