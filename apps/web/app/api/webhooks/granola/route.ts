import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server-simple';
import { ProjectSchema, TaskSchema } from '@flow-app/models';
import { extractTasksFromMeetingNotes } from '@/lib/ai/taskExtractor';

// Configure for static export compatibility (desktop builds)
// Note: This webhook is only functional in server deployments, not in desktop/static builds
export const dynamic = 'force-static';
export const revalidate = false;

/**
 * Granola Webhook Handler
 *
 * Receives meeting notes from Granola via Zapier, extracts tasks using AI,
 * and creates them in the user's General project.
 *
 * Expected payload from Zapier:
 * {
 *   userId: string;           // Flow user ID
 *   meetingTitle: string;
 *   enhancedNotes: string;    // Main notes with to-dos
 *   transcript: string;       // Full meeting transcript
 *   attendees: string[];
 *   timestamp: string;
 *   granolaLink: string;
 * }
 */

interface GranolaWebhookPayload {
  userId: string;
  meetingTitle: string;
  enhancedNotes: string;
  transcript?: string;
  attendees?: string[];
  timestamp?: string;
  granolaLink?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret for security
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (webhookSecret !== process.env.GRANOLA_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid webhook secret' },
        { status: 401 }
      );
    }

    // Parse the incoming payload
    const payload: GranolaWebhookPayload = await request.json();

    // Validate required fields
    if (!payload.userId || !payload.meetingTitle || !payload.enhancedNotes) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, meetingTitle, or enhancedNotes' },
        { status: 400 }
      );
    }

    // Create service role client (bypasses RLS for server-side operations)
    const supabase = createServiceRoleClient();

    // Get the user's General project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', payload.userId)
      .eq('is_general', true)
      .single();

    if (projectError || !projectData) {
      return NextResponse.json(
        { error: 'No General project found for user' },
        { status: 404 }
      );
    }

    const generalProject = ProjectSchema.parse(projectData);

    // Extract tasks from the meeting notes using AI
    const extractedTasks = await extractTasksFromMeetingNotes({
      meetingTitle: payload.meetingTitle,
      enhancedNotes: payload.enhancedNotes,
      transcript: payload.transcript,
    });

    // Create tasks in the database
    const createdTasksData = [];
    for (const task of extractedTasks) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: generalProject.id,
          name: task.name,
          description: task.description,
          due_date: task.dueDate,
          created_by: payload.userId,
          assigned_to: payload.userId,
          is_completed: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        throw new Error(`Failed to create task: ${error.message}`);
      }

      const validatedTask = TaskSchema.parse(data);
      createdTasksData.push(validatedTask);
    }

    const createdTasks = createdTasksData;

    // Return success response with created tasks
    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdTasks.length} tasks from meeting: ${payload.meetingTitle}`,
      tasks: createdTasks,
      metadata: {
        meetingTitle: payload.meetingTitle,
        granolaLink: payload.granolaLink,
        tasksCreated: createdTasks.length,
      },
    });

  } catch (error) {
    console.error('Granola webhook error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'granola-webhook',
    version: '1.0.0',
  });
}
