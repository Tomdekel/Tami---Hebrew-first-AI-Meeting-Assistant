/** Custom error for meeting bot operations. */
export class MeetingBotError extends Error {
  code: string;

  /**
   * Create a new MeetingBotError.
   */
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
