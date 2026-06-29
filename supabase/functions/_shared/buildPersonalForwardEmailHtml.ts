import {
  buildAgentForwardEmailHtml,
  type AgentForwardEmailOptions,
} from "./buildAgentForwardEmailHtml.ts";

const ORIGINAL_H1 =
  "Everything you need to grow your real estate business&mdash;all in one platform.";
const PERSONAL_H1 =
  "Why pay for a network when you can launch one for free?";

/**
 * Personal-forward variant of the Agent Forward invitation email.
 * Identical layout, bullets, footer, and CTA — only the H1 changes.
 * Used for the "forward from my personal inbox" admin tool.
 */
export function buildPersonalForwardEmailHtml(
  opts: AgentForwardEmailOptions,
): string {
  const html = buildAgentForwardEmailHtml(opts);
  return html.replace(ORIGINAL_H1, PERSONAL_H1);
}