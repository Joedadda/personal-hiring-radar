export type Cluster = {
  id: string;
  label: string;
  phrases: string[];
};

export type DomainGraph = {
  id: string;
  labels: string[];
  clusters: Cluster[];
  examples: string[];
};

const GRAPHS: DomainGraph[] = [
  {
    id: "marketing",
    labels: ["marketing"],
    examples: [
      "Growth Intern",
      "Content Intern",
      "Community Intern",
      "Product Marketing Intern",
      "SEO Intern",
      "Brand Intern",
      "Videography Intern",
    ],
    clusters: [
      {
        id: "growth",
        label: "growth",
        phrases: [
          "growth marketing",
          "demand generation",
          "demand gen",
          "performance marketing",
          "lifecycle marketing",
          "customer lifecycle",
          "user acquisition",
          "paid social",
          "paid media",
        ],
      },
      {
        id: "content",
        label: "content",
        phrases: [
          "content marketing",
          "content strategy",
          "content creation",
          "copywriting",
          "copywriter",
          "editorial",
          "newsletter",
          "blog post",
          "storytelling",
        ],
      },
      {
        id: "social",
        label: "social and community",
        phrases: [
          "social media",
          "social channel",
          "social channels",
          "community management",
          "community programs",
          "community",
          "instagram",
          "tiktok",
        ],
      },
      {
        id: "pmm",
        label: "product marketing",
        phrases: [
          "product marketing",
          "go-to-market",
          "go to market",
          "positioning",
          "messaging",
          "competitive intelligence",
          "sales enablement",
          "product launch",
        ],
      },
      {
        id: "brand",
        label: "brand",
        phrases: ["brand marketing", "brand voice", "brand strategy", "brand", "creative marketing", "campaign"],
      },
      {
        id: "seo",
        label: "seo",
        phrases: ["search engine optimization", "organic search", "keyword research", "seo", "search ads"],
      },
      {
        id: "events",
        label: "events",
        phrases: ["event marketing", "field marketing", "webinar", "experiential marketing"],
      },
      {
        id: "video",
        label: "video",
        phrases: ["videography", "video marketing", "short-form video", "short form video", "youtube", "motion graphics"],
      },
      {
        id: "ops",
        label: "marketing operations",
        phrases: ["marketing operations", "marketing ops", "martech", "hubspot", "marketo", "campaign operations"],
      },
      {
        id: "outbound",
        label: "outbound",
        phrases: ["outbound marketing", "email marketing", "nurture sequence", "crm campaign"],
      },
      {
        id: "comms",
        label: "communications",
        phrases: ["public relations", "media relations", "press release", "communications"],
      },
    ],
  },
  {
    id: "design",
    labels: ["design", "designer", "ux design", "ui design", "product design"],
    examples: ["Product Designer", "Brand Designer", "UX Intern", "Visual Designer"],
    clusters: [
      {
        id: "product-design",
        label: "product design",
        phrases: ["product design", "product designer", "interaction design", "ux design", "ui design", "visual designer", "graphic designer", "brand designer", "figma"],
      },
      {
        id: "research",
        label: "research",
        phrases: ["user research", "usability study", "usability testing", "design research"],
      },
      {
        id: "visual",
        label: "visual design",
        phrases: ["visual design", "graphic design", "art direction", "brand identity", "illustration"],
      },
      {
        id: "content-design",
        label: "content design",
        phrases: ["content design", "ux writing", "design system"],
      },
    ],
  },
  {
    id: "engineering",
    labels: ["engineering", "software engineering"],
    examples: ["Backend Intern", "Frontend Engineer", "iOS Engineer", "Infrastructure Engineer"],
    clusters: [
      {
        id: "backend",
        label: "backend",
        phrases: ["backend", "back-end", "api", "apis", "distributed systems", "microservices", "postgres", "database"],
      },
      {
        id: "frontend",
        label: "frontend",
        phrases: ["frontend", "front-end", "react", "typescript", "css", "browser"],
      },
      {
        id: "mobile",
        label: "mobile",
        phrases: ["ios", "android", "swift", "kotlin", "mobile app"],
      },
      {
        id: "infra",
        label: "infrastructure",
        phrases: ["infrastructure", "devops", "kubernetes", "ci/cd", "site reliability", "terraform"],
      },
      {
        id: "security",
        label: "security",
        phrases: ["application security", "security engineer", "penetration", "threat model"],
      },
    ],
  },
  {
    id: "finance",
    labels: ["finance"],
    examples: ["FP&A Analyst", "Accountant", "Investment Intern"],
    clusters: [
      {
        id: "fpa",
        label: "fp&a",
        phrases: ["fp&a", "financial planning", "forecasting", "variance analysis", "board reporting"],
      },
      {
        id: "accounting",
        label: "accounting",
        phrases: ["accounting", "general ledger", "month-end close", "reconciliation", "gaap"],
      },
      {
        id: "audit-tax",
        label: "audit and tax",
        phrases: ["audit", "tax", "controllership", "treasury"],
      },
      {
        id: "investing",
        label: "investing",
        phrases: ["investment banking", "equity research", "portfolio", "valuation"],
      },
    ],
  },
  {
    id: "product",
    labels: ["product", "product management"],
    examples: ["Product Manager", "Associate Product Manager", "Product Intern"],
    clusters: [
      {
        id: "pm",
        label: "product management",
        phrases: ["product manager", "product management", "associate product", "roadmap", "feature prioritization"],
      },
      {
        id: "discovery",
        label: "discovery",
        phrases: ["product discovery", "user stories", "product requirements", "prd"],
      },
    ],
  },
  {
    id: "sales",
    labels: ["sales"],
    examples: ["Account Executive", "SDR", "Sales Intern"],
    clusters: [
      {
        id: "closing",
        label: "closing",
        phrases: ["account executive", "quota", "pipeline", "closing", "book of business"],
      },
      {
        id: "development",
        label: "development",
        phrases: ["sales development", "sdr", "bdr", "outbound calls", "prospecting"],
      },
      {
        id: "accounts",
        label: "accounts",
        phrases: ["customer success", "account management", "renewal", "expansion"],
      },
    ],
  },
  {
    id: "operations",
    labels: ["operations"],
    examples: ["Business Operations", "Chief of Staff", "Strategy & Ops"],
    clusters: [
      {
        id: "bizops",
        label: "business operations",
        phrases: ["business operations", "bizops", "revops", "revenue operations", "operating cadence"],
      },
      {
        id: "programs",
        label: "programs",
        phrases: ["program management", "process improvement", "vendor management", "supply chain", "logistics"],
      },
    ],
  },
  {
    id: "data",
    labels: ["data", "data science", "data analytics"],
    examples: ["Data Analyst", "Data Scientist", "Analytics Intern"],
    clusters: [
      {
        id: "science",
        label: "data science",
        phrases: ["data science", "machine learning", "statistical", "experimentation", "modeling"],
      },
      {
        id: "analytics",
        label: "analytics",
        phrases: ["data analyst", "analytics", "tableau", "looker", "sql", "dashboard"],
      },
    ],
  },
];

const ALIASES: Record<string, string> = {
  marketing: "marketing",
  design: "design",
  "ux design": "design",
  "ui design": "design",
  "product design": "design",
  "graphic design": "design",
  ux: "design",
  ui: "design",
  engineering: "engineering",
  "software engineering": "engineering",
  software: "engineering",
  swe: "engineering",
  finance: "finance",
  accounting: "finance",
  product: "product",
  "product management": "product",
  sales: "sales",
  operations: "operations",
  ops: "operations",
  "business operations": "operations",
  data: "data",
  "data science": "data",
  "data analytics": "data",
  "machine learning": "data",
};

export function normalizeDomain(input: string): string {
  return input.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function resolveDomain(input: string): { graph: DomainGraph; synthetic: boolean } {
  const normalized = normalizeDomain(input);
  const alias = ALIASES[normalized];
  const known = GRAPHS.find((graph) => graph.id === alias || graph.labels.some((label) => normalizeDomain(label) === normalized));
  if (known) return { graph: known, synthetic: false };

  const phrase = input.trim() || "this domain";
  return {
    synthetic: true,
    graph: {
      id: "custom",
      labels: [phrase],
      examples: [],
      clusters: [
        {
          id: "phrase",
          label: phrase,
          phrases: [phrase, ...(phrase.split(/\s+/).filter((word) => word.length > 4))],
        },
      ],
    },
  };
}

export function allGraphs(): DomainGraph[] {
  return GRAPHS;
}

export function previewTitles(input: string): string[] {
  return resolveDomain(input).graph.examples;
}
