import { cloudverseStory } from "./cloudverse-story";

/**
 * Everything on the Work pages. Copy below is placeholder until each piece is written;
 * edit here and the homepage lists, the tabs and the detail pages all follow.
 */
export type Figure = { src: string; width: number; height: number; alt: string; caption: string };

/** One block inside a section: a paragraph, a quote, a list, or a figure. */
export type Block =
  | { kind: "p"; text: string }
  | { kind: "quote"; text: string; by: string }
  | { kind: "list"; items: string[] }
  | { kind: "figure"; figure: Figure };

export type StorySection = { id: string; title: string; blocks: Block[] };

/** A full case study page: header, sectioned body, one-liner and footnote. */
export type Story = {
  title: string;
  meta: string;
  summary: string;
  sections: StorySection[];
  callout: string;
  footnote: string;
};

export type CaseStudy = { slug: string; name: string; blurb: string; story?: Story };

export const CASE_STUDIES: CaseStudy[] = [
  { slug: "cloudverse-ai", name: "Cloudverse AI", blurb: "End-to-end revamp and automation.", story: cloudverseStory },
  { slug: "advisee", name: "Advisee", blurb: "PLACEHOLDER — one line on what this was." },
  { slug: "godrej-lafs", name: "Godrej LAFS", blurb: "PLACEHOLDER — one line on what this was." },
];

export type Piece = { name: string; note: string };

export const UI_PIECES: Piece[] = [
  { name: "PLACEHOLDER — UI piece one", note: "interface" },
  { name: "PLACEHOLDER — UI piece two", note: "interface" },
  { name: "PLACEHOLDER — UI piece three", note: "interface" },
  { name: "PLACEHOLDER — UI piece four", note: "interface" },
];

export const SHADERS: Piece[] = [
  { name: "PLACEHOLDER — shader one", note: "glsl" },
  { name: "PLACEHOLDER — shader two", note: "glsl" },
  { name: "PLACEHOLDER — shader three", note: "three.js" },
  { name: "PLACEHOLDER — shader four", note: "glsl" },
];

export const TABS = [
  { href: "/work/case-studies", label: "Case studies" },
  { href: "/work/ui", label: "UI" },
  { href: "/work/shaders", label: "Shaders" },
] as const;
