/** The sentence to show for a failed call. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    // A validation error arrives as zod's JSON list of issues.
    try {
      const issues = JSON.parse(error.message);
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // Not JSON: the message itself.
    }
    return error.message;
  }
  return "That didn't work. Try again.";
}
