import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        { 
            success: false, 
            message: `This webhook URL is deprecated. The system has been updated to use a new route structure. Please re-save your bot settings in the admin panel to activate the new webhook.`,
        }, 
        { status: 410 }
    );
}
