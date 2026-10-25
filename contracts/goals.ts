/** Shared browser/server contract. No Node imports or credentials. */
export interface CreateGoalRequest {
  serviceId: string;
  goal: string;
}

export interface Goal extends CreateGoalRequest {
  id: string;
  status: 'received';
  createdAt: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: { field: string; message: string }[];
  };
}

export type ValidationResult =
  | { success: true; value: CreateGoalRequest }
  | { success: false; details: { field: string; message: string }[] };

/** Validate untrusted JSON, rejecting extra fields rather than persisting secrets. */
export function validateCreateGoal(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, details: [{ field: 'body', message: 'Expected a JSON object.' }] };
  }
  const body = input as Record<string, unknown>;
  const details: { field: string; message: string }[] = [];
  if (Object.keys(body).some(key => !['serviceId', 'goal'].includes(key))) {
    details.push({ field: 'body', message: 'Only serviceId and goal are accepted.' });
  }
  const serviceId = typeof body.serviceId === 'string' ? body.serviceId.trim() : '';
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(serviceId)) {
    details.push({ field: 'serviceId', message: 'Use 3–80 lowercase letters, digits or hyphens, starting with a letter.' });
  }
  if (goal.length < 1 || goal.length > 2000) {
    details.push({ field: 'goal', message: 'Enter a goal between 1 and 2000 characters.' });
  }
  return details.length ? { success: false, details } : { success: true, value: { serviceId, goal } };
}
