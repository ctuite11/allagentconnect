export type EmailStream =
  | "hot_sheet"
  | "communications"
  | "transactional"
  | "system";

export interface EmailJob {
  id: string;
  created_at: string;
  run_after: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  /** Immutable queue stream set at enqueue. */
  stream?: EmailStream | string | null;
  payload: {
    provider: string;
    template: string;
    to: string | string[];
    subject: string;
    html?: string;
    reply_to?: string;
    from?: string;
    category?: string;
    metadata?: Record<string, unknown>;
    variables?: Record<string, any>;
  };
}
