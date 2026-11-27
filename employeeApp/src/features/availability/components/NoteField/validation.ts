/** Same limit as the backend (submitAvailabilitySchema: note max 100 after trimming). */
export const NOTE_MAX = 100;

/** An error message, or undefined when the note is fine. */
export function validateNote(note: string): string | undefined {
  if (note.trim().length > NOTE_MAX) return `Keep the note to ${NOTE_MAX} characters.`;
  return undefined;
}

/** What the API gets: the trimmed note, or null for an empty one. */
export function noteForApi(note: string): string | null {
  return note.trim() || null;
}
