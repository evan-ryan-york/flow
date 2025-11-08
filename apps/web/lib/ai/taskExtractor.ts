import OpenAI from 'openai';
import { z } from 'zod';

// Lazy initialization of OpenAI client to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Schema for extracted task
const ExtractedTaskSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  dueDate: z.string().nullable(), // ISO date string or null
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

// Schema for AI response
const AITaskExtractionResponseSchema = z.object({
  tasks: z.array(ExtractedTaskSchema),
});

interface ExtractTasksInput {
  meetingTitle: string;
  enhancedNotes: string;
  transcript?: string;
}

/**
 * Extracts actionable tasks from Granola meeting notes using OpenAI.
 *
 * Uses GPT-4 to intelligently parse meeting notes and identify:
 * - Action items
 * - To-dos
 * - Assignments
 * - Deadlines
 *
 * @param input - Meeting notes and metadata
 * @returns Array of extracted tasks with names, descriptions, and due dates
 */
export async function extractTasksFromMeetingNotes(
  input: ExtractTasksInput
): Promise<ExtractedTask[]> {
  try {
    const systemPrompt = `You are an AI assistant that extracts actionable tasks from meeting notes.

Your job is to:
1. Identify clear action items, to-dos, and assignments from meeting notes
2. Extract the task name with FULL CONTEXT (include who, what, and key details)
3. Create a helpful description with additional context from the meeting
4. Determine if a due date was mentioned (return as ISO date string)

Guidelines for Task Names:
- Task names MUST include ALL key context: who is involved, what needs to be done, and any important details
- Start with a verb and include the object AND relevant parties/details
- Good examples:
  * "Send Q4 report to stakeholders"
  * "Schedule follow-up meeting with marketing team"
  * "Review contract with legal team before Friday"
  * "Update dashboard with latest sales metrics"
- Bad examples (too vague):
  * "Send report" ❌ (who to?)
  * "Schedule meeting" ❌ (with whom?)
  * "Review contract" ❌ (which contract? with whom?)

Other Guidelines:
- Only extract items that are clearly actionable tasks
- Ignore general discussion points or informational items
- Descriptions should provide additional context, background, or meeting notes
- If no due date is mentioned, set dueDate to null
- IMPORTANT: You will be given TODAY'S DATE in the prompt. Use this to calculate relative dates accurately.
  * "end of week" = the upcoming Friday (or same Friday if today is early in the week)
  * "next week" = the following Monday
  * "tomorrow" = the next day
  * Always calculate dates relative to the provided TODAY'S DATE
- Return all dates in ISO format (YYYY-MM-DD)

Return your response as a JSON object with this structure:
{
  "tasks": [
    {
      "name": "Specific, context-rich task name with all key details",
      "description": "Additional context, background, or notes from the meeting",
      "dueDate": "2025-11-15" or null
    }
  ]
}`;

    // Get today's date for accurate relative date parsing
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

    const userPrompt = `TODAY'S DATE: ${todayFormatted} (${dayOfWeek})

Meeting Title: ${input.meetingTitle}

Meeting Notes:
${input.enhancedNotes}

${input.transcript ? `\nFull Transcript:\n${input.transcript}` : ''}

Extract all actionable tasks from this meeting. Remember to calculate all relative dates (like "end of week", "next week", "tomorrow") based on TODAY'S DATE: ${todayFormatted}.`;

    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency, can upgrade to gpt-4o for better quality
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent extraction
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Parse and validate the AI response
    const parsedResponse = JSON.parse(content);
    const validatedResponse = AITaskExtractionResponseSchema.parse(parsedResponse);

    console.log(`Extracted ${validatedResponse.tasks.length} tasks from meeting: ${input.meetingTitle}`);

    return validatedResponse.tasks;

  } catch (error) {
    console.error('Task extraction error:', error);

    // If AI extraction fails, create a fallback task with the meeting info
    return [
      {
        name: `Review meeting: ${input.meetingTitle}`,
        description: `AI task extraction failed. Please review the meeting notes manually.\n\n${input.enhancedNotes.slice(0, 500)}...`,
        dueDate: null,
      },
    ];
  }
}

/**
 * Helper function to parse relative dates mentioned in meetings
 * (e.g., "end of week", "tomorrow", "next Monday")
 *
 * Note: Currently unused as GPT-4 handles date parsing in the prompt.
 * Keeping for potential future use if we need client-side date parsing.
 */
function _parseRelativeDate(dateString: string): string | null {
  const today = new Date();
  const lowerDate = dateString.toLowerCase();

  // Tomorrow
  if (lowerDate.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // End of week (Friday)
  if (lowerDate.includes('end of week') || lowerDate.includes('eow')) {
    const daysUntilFriday = (5 - today.getDay() + 7) % 7;
    const friday = new Date(today);
    friday.setDate(friday.getDate() + daysUntilFriday);
    return friday.toISOString().split('T')[0];
  }

  // Next week (next Monday)
  if (lowerDate.includes('next week')) {
    const daysUntilMonday = ((1 - today.getDay() + 7) % 7) + 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  }

  return null;
}
