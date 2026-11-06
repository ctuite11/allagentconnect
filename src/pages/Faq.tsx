import React from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import FooterV2 from "@/components/home-v2/FooterV2";

const questions = [
  {
    question: "Who can join All Agent Connect?",
    answer: "AAC is for licensed real estate agents. Applicants are verified before receiving member access. It is not a public listing portal or consumer lead marketplace.",
  },
  {
    question: "How does agent verification work?",
    answer: "Agents request access, provide the information needed to confirm their license, and complete member setup after approval. Access to agent profiles, buyer needs, and private listing details is restricted to approved users.",
  },
  {
    question: "Can the public see listings or agent conversations?",
    answer: "No. AAC's collaboration network is intended for approved agents. The public site explains the service but does not display member listings, client demand, or private conversations.",
  },
  {
    question: "Does using AAC change MLS or Clear Cooperation obligations?",
    answer: "No. AAC does not replace an MLS or create an exemption from applicable MLS, NAR Clear Cooperation, state law, or brokerage rules. Agents must follow the requirements that apply to each property, including seller instructions and any required disclosures. Check with your broker or MLS before marketing a property privately.",
  },
  {
    question: "What kinds of opportunities can agents share?",
    answer: "Agents can communicate about properties they are preparing to list, properties sellers wish to market privately, buyer and renter needs, referrals, and market information, subject to applicable rules and seller authorization.",
  },
  {
    question: "Where is AAC focused?",
    answer: "AAC is founded in Greater Boston and serves agents working in Massachusetts. It is built for collaboration across brokerages; agents should request access to confirm coverage and availability in their market.",
  },
  {
    question: "What does membership cost?",
    answer: "This public page does not list membership pricing. Contact hello@allagentconnect.com to confirm current terms and any applicable fees before joining.",
  },
  {
    question: "How do I request access?",
    answer: "Use the Request Access page, choose the agent path, and complete the requested information. The AAC team reviews agent eligibility before member access is enabled.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: questions.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function Faq() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Agent Network FAQ | All Agent Connect"
        description="Answers to common questions about AAC agent verification, private listings, MLS rules, pricing, and membership in Greater Boston."
        canonical="https://allagentconnect.com/faq"
        jsonLd={faqJsonLd}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <p className="text-sm font-semibold text-[#0E56F5]">All Agent Connect</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Frequently asked questions</h1>
        <p className="mt-5 text-lg text-slate-600">What working agents should know before requesting access.</p>
        <div className="mt-10 space-y-8">
          {questions.map(({ question, answer }) => (
            <section key={question} className="border-b border-slate-200 pb-7">
              <h2 className="text-xl font-semibold text-slate-900">{question}</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{answer}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-5">
          <Link to="/request-access" className="inline-flex rounded-full bg-[#0E56F5] px-6 py-3 font-semibold text-white">Request agent access</Link>
          <Link to="/agent-rules" className="inline-flex items-center font-medium text-[#0E56F5] underline underline-offset-4">Read Agent Network Rules</Link>
        </div>
      </main>
      <FooterV2 />
    </div>
  );
}
