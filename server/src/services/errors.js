// An error whose message is safe and useful to show to the user as-is.
export class UserError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; this.expose = true; }
}
