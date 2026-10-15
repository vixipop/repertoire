import type { Story } from "./data";

/** The Cloudverse case study. Copy follows the approved draft (content/cloudverse-case-study-draft.md). */
export const cloudverseStory: Story = {
  title: "Cloudverse Product Revamp",
  meta: "Product design · Enterprise web SaaS · 6 months (Aug 2025 – Jan 2026)",
  summary: "A FinOps tool that could only point at problems, rebuilt so it could fix them too.",
  sections: [
    {
      id: "context",
      title: "Context",
      blocks: [
        {
          kind: "p",
          text: "Cloudverse is an enterprise FinOps platform. It finds wasted cloud spend, like idle VMs and old snapshots, and recommends what to do about it. The part it didn't do was the doing. Someone still had to find each recommendation and act on it by hand.",
        },
        {
          kind: "p",
          text: "For six months I was embedded with the Cloudverse team, working alongside engineers, PMs and the business. The brief was an automation-first product. What we ended up with was a full revamp of the platform, and a new way of talking about it.",
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/hero-dashboard.webp",
            width: 1200,
            height: 781,
            alt: "Cloudverse cost dashboard showing total spend across AWS, GCP and Azure, with the cost trend explorer",
            caption: "Cost dashboard: spend across clouds, before automation",
          },
        },
      ],
    },
    {
      id: "research",
      title: "Research",
      blocks: [
        {
          kind: "p",
          text: "We interviewed users at SISL, DTDC and Axis. The recommendations were good. Acting on them was slow, and a little scary.",
        },
        {
          kind: "quote",
          text: "If there's a safe way to automate things like deleting unused snapshots or right-sizing VMs, and teams can trust us with the right permissions, that's where the real savings happen.",
          by: "Chand Deshwal, CEO & Founder, Cloudverse AI",
        },
        { kind: "p", text: "Three questions kept coming up:" },
        {
          kind: "list",
          items: [
            "Hundreds of recommendations land every day. How do we group them and run them on a schedule?",
            "What if the engine is wrong? Nothing risky should run without a person looking first.",
            "Write access is risky. If something goes wrong, can we trace it and roll it back?",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/research-notes.webp",
            width: 929,
            height: 769,
            alt: "Sticky notes with user concerns about batching, risky changes and rollback",
            caption: "What users kept raising in discovery",
          },
        },
        {
          kind: "p",
          text: "Those questions became one job: turn finding and fixing savings into scheduled policies that run on their own, with a human in the loop where it matters.",
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/flow.webp",
            width: 1200,
            height: 357,
            alt: "Flow from the optimisation engine's recommendations to the automations module",
            caption: "From recommendation to executed policy",
          },
        },
      ],
    },
    {
      id: "system",
      title: "System",
      blocks: [
        {
          kind: "p",
          text: "The design system couldn't keep up with the product. Components were inconsistently sized, typography had no clear hierarchy, and data-heavy screens had little support. Rebuilding it cut design-to-dev handoff by about 43%.",
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/colour-tokens.webp",
            width: 773,
            height: 1200,
            alt: "Colour tokens with hex values and usage notes",
            caption: "Colour tokens, with the job each one does",
          },
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/dashboard-elements.webp",
            width: 1200,
            height: 1183,
            alt: "Dashboard elements: anomaly cards, tables, tabs and tooltips",
            caption: "Dashboard elements, rebuilt for data-heavy screens",
          },
        },
      ],
    },
    {
      id: "screens",
      title: "Screens",
      blocks: [
        {
          kind: "p",
          text: "The Automation module has five parts: a dashboard, active policies, review and approvals, execution logs, and settings.",
        },
        {
          kind: "p",
          text: "Policies have full guardrails and a dry run, so you can see what a rule would do before it does it. Each one is either auto-approved or sent to review. Every run is logged, with savings, failures and a way to roll back.",
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/dashboard.webp",
            width: 1200,
            height: 692,
            alt: "Workflow automation dashboard with total savings, engine health and awaiting review",
            caption: "Automation dashboard",
          },
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/policy-dry-run.webp",
            width: 1200,
            height: 742,
            alt: "Policy creation screen with a dry run preview",
            caption: "Policy creation with a dry run preview",
          },
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/review.webp",
            width: 1200,
            height: 742,
            alt: "Review and approvals table of pending recommendations",
            caption: "Review and approvals",
          },
        },
        {
          kind: "figure",
          figure: {
            src: "/work/cloudverse/logs.webp",
            width: 1200,
            height: 742,
            alt: "Execution logs with run status, savings and rollback",
            caption: "Execution logs, with rollback",
          },
        },
        { kind: "p", text: "Core feature adoption went up 25%." },
      ],
    },
  ],
  callout:
    "Making the product look better was the easy part. The real challenge was getting a tool to act on a cloud bill without anyone losing trust in it.",
  footnote:
    "I was the point of contact for Cloudverse at Turbostart and acted as PM end to end: planning every module with the Turbostart devs, running the UI/UX reviews, and collaborating regularly with the Cloudverse team.",
};
