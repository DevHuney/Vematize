import { NextResponse } from 'next/server';

/**
 * @deprecated This webhook route is deprecated and is no longer in use.
 * The active webhook is now located at /api/telegram-hook
 * This file is kept to avoid breaking old webhook registrations but should be removed in the future.
 */
export async function POST() {
    return NextResponse.json(
        { 
            success: false, 
            message: `This webhook URL is deprecated. The system has been updated to use a new route structure. Please re-save your bot settings in the admin panel to activate the new webhook.`,
        }, 
        { status: 410 } // 410 Gone
    );
}
