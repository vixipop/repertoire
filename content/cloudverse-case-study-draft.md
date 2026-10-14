# Cloudverse Product Revamp

Product design · Enterprise web SaaS · 6 months (Aug 2025 – Jan 2026)

A FinOps tool that could only point at problems, rebuilt so it could fix them too.

**Contents:** Context · Research · System · Screens

---

## Context

Cloudverse is an enterprise FinOps platform. It finds wasted cloud spend, like idle VMs and old snapshots, and recommends what to do about it. The part it didn't do was the doing. Someone still had to find each recommendation and act on it by hand.

For six months I was embedded with the Cloudverse team, working alongside engineers, PMs and the business. The brief was an automation-first product. What we ended up with was a full revamp of the platform, and a new way of talking about it.

*[image 01 — cost dashboard, hero]*

---

## Research

We interviewed users at SISL, DTDC and Axis. The recommendations were good. Acting on them was slow, and a little scary.

> "If there's a safe way to automate things like deleting unused snapshots or right-sizing VMs, and teams can trust us with the right permissions, that's where the real savings happen."
> — Chand Deshwal, CEO & Founder, Cloudverse AI

Three questions kept coming up:

- Hundreds of recommendations land every day. How do we group them and run them on a schedule?
- What if the engine is wrong? Nothing risky should run without a person looking first.
- Write access is risky. If something goes wrong, can we trace it and roll it back?

*[image 03 — user pain points]*

Those questions became one job: turn finding and fixing savings into scheduled policies that run on their own, with a human in the loop where it matters.

*[image 05 — optimisation engine to automations flow]*

---

## System

The design system couldn't keep up with the product. Components were inconsistently sized, typography had no clear hierarchy, and data-heavy screens had little support. Rebuilding it cut design-to-dev handoff by about 45%.

*[image 06 — colour tokens]*
*[image 11 — dashboard elements]*

---

## Screens

The Automation module has five parts: a dashboard, active policies, review and approvals, execution logs, and settings.

Policies have full guardrails and a dry run, so you can see what a rule would do before it does it. Each one is either auto-approved or sent to review. Every run is logged, with savings, failures and a way to roll back.

*[image 13 — automation dashboard]*
*[image 15 — policy creation with dry run]*
*[image 16 — review and approvals]*
*[image 17 — execution logs]*

Core feature adoption went up 25%.

---

> Making the product look better was the easy part. The real challenge was getting a tool to act on a cloud bill without anyone losing trust in it.

---

*Source notes (remove before publishing): the design-to-dev figure is 45% on the Framer homepage card and 43% on the case-study page, so one of them needs fixing. The 25% adoption figure comes only from the homepage card.*
