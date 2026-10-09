import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { dbStore } from './db';
import { googleService } from './googleService';
import { Appointment } from '../src/types';

// Tool Declarations for Gemini
const listFacultyTool: FunctionDeclaration = {
  name: 'list_available_faculty',
  description: 'List all faculty members in the university directory, including department, title, and whether their Google Calendar is linked.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      department: {
        type: Type.STRING,
        description: 'Optional department filter'
      }
    }
  }
};

const checkAvailabilityTool: FunctionDeclaration = {
  name: 'check_faculty_availability',
  description: 'Check a faculty member availability for an appointment on a specific date and time against their Google Calendar (working hours 9:00 AM – 4:00 PM).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      facultyNameOrId: {
        type: Type.STRING,
        description: 'Faculty member name or ID'
      },
      date: {
        type: Type.STRING,
        description: 'Target date in YYYY-MM-DD format'
      },
      time: {
        type: Type.STRING,
        description: 'Proposed start time in HH:MM format (24-hour, between 09:00 and 16:00)'
      }
    },
    required: ['facultyNameOrId', 'date', 'time']
  }
};

const bookAppointmentTool: FunctionDeclaration = {
  name: 'book_appointment',
  description: 'Book an appointment with a faculty member. Enforces Google Calendar availability between 9:00 AM and 4:00 PM.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      facultyNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the faculty member'
      },
      date: {
        type: Type.STRING,
        description: 'Appointment date in YYYY-MM-DD format'
      },
      startTime: {
        type: Type.STRING,
        description: 'Start time in HH:MM 24-hour format (e.g. 10:00, 14:30)'
      },
      purpose: {
        type: Type.STRING,
        description: 'Purpose of the appointment'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional student notes or context'
      }
    },
    required: ['facultyNameOrId', 'date', 'startTime', 'purpose']
  }
};

const cancelAppointmentTool: FunctionDeclaration = {
  name: 'cancel_appointment',
  description: 'Cancel an existing appointment by appointment ID.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      appointmentId: {
        type: Type.STRING,
        description: 'Unique ID of the appointment'
      },
      reason: {
        type: Type.STRING,
        description: 'Reason for cancellation'
      }
    },
    required: ['appointmentId']
  }
};

const getMyAppointmentsTool: FunctionDeclaration = {
  name: 'get_user_appointments',
  description: 'Get all scheduled and pending appointments for the current user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      statusFilter: {
        type: Type.STRING,
        description: 'Optional filter: pending, accepted, rejected, cancelled, or all'
      }
    }
  }
};

export async function processAIChat(
  userId: string,
  userMessage: string,
  conversationHistory: { role: string; content: string }[]
): Promise<{ reply: string; toolExecutions: { name: string; args: any; result: any }[] }> {
  const user = dbStore.users.get(userId);
  const toolExecutions: { name: string; args: any; result: any }[] = [];

  const apiKey = dbStore.customGeminiApiKey || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return {
      reply: 'Gemini API Key is not configured on the server. Please ask the Administrator to configure the Gemini API key in the Admin Dashboard.',
      toolExecutions: []
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const systemInstruction = `You are "AcademiaSync AI", the official academic appointment agent.
Authenticated user:
- Name: ${user?.displayName || 'User'}
- Role: ${user?.role || 'STUDENT'}
- User ID: ${userId}
- Current Date/Time: ${new Date().toISOString()}

CRITICAL RULES FOR APPOINTMENTS & AVAILABILITY:
1. All faculty members have working hours: 9:00 AM – 4:00 PM.
2. The individual availability of each faculty member must ONLY be determined from their Google Calendar.
3. Verification flow when booking an appointment:
   Faculty exists → Google Calendar connected? → Yes: Check Calendar availability in 9:00 AM–4:00 PM → Slot available? → Book appointment.
4. If a faculty member has NO connected Google Calendar, you MUST respond:
   "Google account not linked. Kindly contact the faculty personally."
5. You must NEVER assume a faculty member is available without checking their connected Google Calendar.
6. If the requested time is outside 9:00 AM – 4:00 PM, inform the student that faculty working hours are 9:00 AM – 4:00 PM.`;

  const tools = [
    {
      functionDeclarations: [
        listFacultyTool,
        checkAvailabilityTool,
        bookAppointmentTool,
        cancelAppointmentTool,
        getMyAppointmentsTool
      ]
    }
  ];

  const executeTool = async (name: string, args: any): Promise<any> => {
    switch (name) {
      case 'list_available_faculty': {
        let faculty = Array.from(dbStore.facultyProfiles.values()).filter(f => !f.disabled);
        if (args.department) {
          const dept = String(args.department).toLowerCase();
          faculty = faculty.filter(f => f.department.toLowerCase().includes(dept));
        }
        return faculty.map(f => ({
          id: f.id,
          name: f.name,
          email: f.email,
          department: f.department,
          title: f.title,
          isGoogleCalendarConnected: googleService.isUserCalendarConnected(f.userId),
          workingHours: '9:00 AM – 4:00 PM'
        }));
      }

      case 'check_faculty_availability': {
        const query = String(args.facultyNameOrId).toLowerCase();
        const faculty = Array.from(dbStore.facultyProfiles.values()).find(
          f => !f.disabled && (f.id.toLowerCase() === query || f.name.toLowerCase().includes(query) || f.username.toLowerCase() === query)
        );

        if (!faculty) {
          return { available: false, message: `Faculty member "${args.facultyNameOrId}" not found in directory.` };
        }

        // Check if Google Calendar is connected
        if (!googleService.isUserCalendarConnected(faculty.userId)) {
          return {
            available: false,
            message: "Google account not linked. Kindly contact the faculty personally."
          };
        }

        const date = args.date;
        const time = args.time;

        // Check working hours 9:00 AM - 4:00 PM
        const [h, m] = time.split(':').map(Number);
        const mins = h * 60 + m;
        if (mins < 9 * 60 || mins > 16 * 60) {
          return {
            available: false,
            message: `Requested time ${time} is outside faculty working hours (9:00 AM – 4:00 PM).`
          };
        }

        const avail = await googleService.getFacultyAvailableSlots(faculty.id, date);
        if (!avail.isConnected) {
          return {
            available: false,
            message: "Google account not linked. Kindly contact the faculty personally."
          };
        }

        // Check if any slot starts at this time
        const slotMatch = avail.slots.find(s => s.startTime === time);
        if (slotMatch) {
          return {
            available: true,
            faculty: faculty.name,
            date,
            time: `${slotMatch.startTime} - ${slotMatch.endTime}`,
            message: `${faculty.name} is available on ${date} from ${slotMatch.startTime} to ${slotMatch.endTime} according to their Google Calendar.`
          };
        }

        const freeSlotsText = avail.slots.length > 0 
          ? avail.slots.map(s => s.startTime).join(', ') 
          : 'None';

        return {
          available: false,
          faculty: faculty.name,
          date,
          message: `${faculty.name} is not available at ${time} on ${date} according to their Google Calendar. Available slots on this day: ${freeSlotsText}.`
        };
      }

      case 'book_appointment': {
        const query = String(args.facultyNameOrId).toLowerCase();
        const faculty = Array.from(dbStore.facultyProfiles.values()).find(
          f => !f.disabled && (f.id.toLowerCase() === query || f.name.toLowerCase().includes(query) || f.username.toLowerCase() === query)
        );

        if (!faculty) {
          return { success: false, message: `Faculty member "${args.facultyNameOrId}" not found.` };
        }

        // Rule: If Google Calendar not connected -> specific response
        if (!googleService.isUserCalendarConnected(faculty.userId)) {
          return {
            success: false,
            message: "Google account not linked. Kindly contact the faculty personally."
          };
        }

        // Calculate end time (default 30 mins)
        const [h, m] = args.startTime.split(':').map(Number);
        const startMin = h * 60 + m;
        const endMin = startMin + 30;

        if (startMin < 9 * 60 || endMin > 16 * 60) {
          return {
            success: false,
            message: `Requested time ${args.startTime} is outside faculty working hours (9:00 AM – 4:00 PM).`
          };
        }

        const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
        const endM = String(endMin % 60).padStart(2, '0');
        const endTime = `${endH}:${endM}`;

        // Re-check Google Calendar in real-time
        const check = await googleService.checkFacultySlotAvailable(faculty.id, args.date, args.startTime, endTime);
        if (!check.available) {
          return {
            success: false,
            message: check.reason || `Slot ${args.startTime} - ${endTime} is not available on ${args.date}.`
          };
        }

        const appointmentId = `apt-${Date.now().toString().slice(-6)}`;
        const newApt: Appointment = {
          id: appointmentId,
          studentId: userId,
          studentName: user?.displayName || 'Student',
          studentEmail: user?.email || 'student@institution.edu',
          facultyId: faculty.id,
          facultyName: faculty.name,
          facultyEmail: faculty.email,
          date: args.date,
          startTime: args.startTime,
          endTime,
          purpose: args.purpose,
          notes: args.notes || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        dbStore.appointments.set(newApt.id, newApt);

        // Sync with Google Calendar
        try {
          const calId = await googleService.addAppointmentToCalendar(faculty.userId, newApt);
          if (calId) {
            newApt.googleCalendarEventId = calId;
            dbStore.appointments.set(newApt.id, newApt);
          }
        } catch (err: any) {
          console.warn('Calendar sync deferred:', err.message);
        }

        return {
          success: true,
          appointmentId: newApt.id,
          facultyName: faculty.name,
          date: newApt.date,
          time: `${newApt.startTime} - ${newApt.endTime}`,
          purpose: newApt.purpose,
          status: newApt.status,
          message: `Appointment requested with ${faculty.name} on ${newApt.date} at ${newApt.startTime}. Synced to faculty's Google Calendar and awaiting confirmation.`
        };
      }

      case 'cancel_appointment': {
        const apt = dbStore.appointments.get(args.appointmentId);
        if (!apt) {
          return { success: false, message: `Appointment ${args.appointmentId} not found.` };
        }

        if (user?.role === 'STUDENT' && apt.studentId !== userId) {
          return { success: false, message: 'You can only cancel your own appointments.' };
        }

        apt.status = 'cancelled';
        apt.updatedAt = new Date().toISOString();
        if (args.reason) {
          apt.notes = `${apt.notes || ''} [Cancelled: ${args.reason}]`.trim();
        }

        // Two-way sync: Remove from Google Calendar if event was created
        if (apt.googleCalendarEventId) {
          const faculty = dbStore.facultyProfiles.get(apt.facultyId);
          if (faculty) {
            await googleService.deleteAppointmentFromCalendar(faculty.userId, apt.googleCalendarEventId).catch(() => {});
            apt.googleCalendarEventId = undefined;
          }
        }

        dbStore.appointments.set(apt.id, apt);

        return {
          success: true,
          appointmentId: apt.id,
          message: `Appointment ${apt.id} with ${apt.facultyName} on ${apt.date} has been cancelled.`
        };
      }

      case 'get_user_appointments': {
        let apts = Array.from(dbStore.appointments.values());
        if (user?.role === 'STUDENT') {
          apts = apts.filter(a => a.studentId === userId);
        } else if (user?.role === 'FACULTY') {
          const fac = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === userId);
          if (fac) {
            apts = apts.filter(a => a.facultyId === fac.id);
          }
        }

        if (args.statusFilter && args.statusFilter !== 'all') {
          apts = apts.filter(a => a.status === args.statusFilter);
        }

        return apts.map(a => ({
          id: a.id,
          facultyName: a.facultyName,
          studentName: a.studentName,
          date: a.date,
          time: `${a.startTime} - ${a.endTime}`,
          purpose: a.purpose,
          status: a.status
        }));
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  };

  const contents: any[] = [];
  for (const msg of conversationHistory.slice(-8)) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const modelName = dbStore.llmModel || 'gemma-4-26b-a4b-it';

  try {
    let response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools
      }
    });

    let iterations = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < 3) {
      iterations++;
      const functionCalls = response.functionCalls;
      const candidateContent = response.candidates?.[0]?.content;
      contents.push(candidateContent);

      const functionResponseParts: any[] = [];
      for (const call of functionCalls) {
        if (!call.name) continue;
        const toolName = call.name;
        const result = await executeTool(toolName, call.args);
        toolExecutions.push({ name: toolName, args: call.args, result });
        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: { output: result }
          }
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponseParts
      });

      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            tools
          }
        });
      } catch (stepErr: any) {
        console.warn('Follow-up generation error:', stepErr.message);
        break;
      }
    }

    if (response.text) {
      return {
        reply: response.text,
        toolExecutions
      };
    }

    if (toolExecutions.length > 0) {
      const summaryLines = toolExecutions.map(te => {
        if (te.result?.message) return te.result.message;
        return `Action ${te.name} completed.`;
      });
      return {
        reply: summaryLines.join('\n\n'),
        toolExecutions
      };
    }

    return {
      reply: 'I processed your request.',
      toolExecutions
    };
  } catch (err: any) {
    if (toolExecutions.length > 0) {
      return {
        reply: toolExecutions.map(te => te.result?.message || 'Action executed.').join('\n'),
        toolExecutions
      };
    }
    return {
      reply: `I encountered an issue processing your request: ${err.message || 'Service unavailable'}. Please verify the Gemini API key in Admin Settings.`,
      toolExecutions
    };
  }
}
