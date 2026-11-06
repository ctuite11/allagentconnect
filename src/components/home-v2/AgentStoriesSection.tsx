import React from "react";
import { approvedAgentStories } from "@/content/approvedAgentStories";

/** Intentionally hidden until AAC supplies approved, attributed testimonials. */
export default function AgentStoriesSection() {
  if (approvedAgentStories.length === 0) return null;
  return (
    <section className="bg-slate-50 px-6 py-16" aria-label="Real agent stories">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-['Manrope'] text-3xl font-semibold text-slate-900">Agents already working the network.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {approvedAgentStories.map((story) => (
            <figure key={story.name + story.consentRecordedAt} className="rounded-2xl border border-slate-200 bg-white p-6">
              <blockquote className="leading-relaxed text-slate-800">“{story.quote}”</blockquote>
              <figcaption className="mt-5 text-sm text-slate-600">
                <strong className="block text-slate-900">{story.name}</strong>
                {story.brokerage} · {story.city}
                <span className="mt-2 block">{story.outcome}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
