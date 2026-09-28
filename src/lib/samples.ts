export type SampleId = "markdown" | "json" | "text";

export interface Sample {
  id: SampleId;
  label: string;
  description: string;
  source: string;
}

const MARKDOWN_SAMPLE = `# Maya Okafor
Senior Product Engineer — design systems, web performance & developer experience

[maya@okafor.example](mailto:maya@okafor.example) · Berlin, Germany · [github.com/mayaokafor](https://github.com/mayaokafor) · [LinkedIn](https://www.linkedin.com/in/mayaokafor) · [okafor.example](https://okafor.example)

Open to staff-level product engineering roles (remote, EU time zones).

## About
I build fast, accessible interfaces for data-heavy products. Over the last eight years I've led design-system programs, cut page loads in half at two scale-ups, and mentored a dozen engineers into senior roles.

I care about the seams between design and engineering — the place where small decisions compound into products people love.

## Experience

### Senior Product Engineer · Lumen Labs
*Mar 2022 – Present · Remote*

Lumen builds analytics tooling for climate-tech operators (Series B, 120 people).

- Led the rebuild of the core dashboard on Next.js and React Server Components, cutting median load time from 4.1s to 1.3s.
- Founded the Prism design system (60+ components, Storybook, visual regression in CI), now used by 7 product teams.
- Introduced performance budgets in CI that have blocked 40+ regressions before they reached users.
- Mentored 5 engineers; two were promoted to senior within 18 months.

**Stack:** TypeScript, React, Next.js, Tailwind CSS, PostgreSQL, Vercel

### Frontend Engineer · Parcelly
*Jun 2019 – Feb 2022 · Berlin, Germany*

- Shipped the merchant onboarding flow that raised activation from 38% to 61%.
- Migrated a 200k-line AngularJS codebase to React and TypeScript incrementally, with zero downtime.
- Built a real-time shipment tracking map with WebSockets serving 2M monthly sessions.

### Software Engineer · Northwind Health
*Aug 2017 – May 2019 · Lagos, Nigeria*

- Developed patient scheduling features in React and Node.js used across 30 clinics.
- Reduced API error rates by 70% by adding contract tests and structured logging.

## Projects

- **Nebula** — Real-time collaborative whiteboard built on CRDTs. [Source](https://github.com/mayaokafor/nebula) · [Live demo](https://nebula.okafor.example)
  - Syncs 50+ concurrent cursors with Yjs and WebRTC, falling back to a WebSocket relay.
  - 3.2k GitHub stars; featured in JavaScript Weekly.
- **Contrastly** — Figma plugin that audits color contrast against WCAG 2.2 and suggests accessible alternatives.
  - 40k installs; written in TypeScript with a Preact UI.
- **perf-budget-action** — GitHub Action that fails pull requests exceeding Core Web Vitals budgets. [Source](https://github.com/mayaokafor/perf-budget-action)

## Skills
- **Languages:** TypeScript, JavaScript, Python, SQL
- **Frontend:** React, Next.js, Tailwind CSS, Framer Motion, Storybook, Accessibility
- **Backend & Data:** Node.js, GraphQL, PostgreSQL, Redis
- **Tooling:** Vite, Playwright, Vitest, GitHub Actions, Figma

## Education
**B.Sc. Computer Science** — University of Lagos, 2017
- First Class Honours; thesis on offline-first sync for low-bandwidth networks.

## Certifications
- AWS Certified Developer – Associate (2021)
- Certified Kubernetes Application Developer (CKAD), 2023

## Languages
English (Native), German (B2), Yoruba (Native)
`;

const JSON_SAMPLE = `{
  "$schema": "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
  "basics": {
    "name": "Daniel Reyes",
    "label": "Staff Platform Engineer",
    "email": "daniel.reyes@example.com",
    "phone": "+1 512 555 0172",
    "url": "https://reyes.example",
    "summary": "Platform engineer who makes other engineers faster. I design paved roads — deployment pipelines, observability and developer portals — that let 300+ engineers ship safely many times a day.",
    "location": { "city": "Austin", "region": "TX", "countryCode": "US" },
    "profiles": [
      { "network": "GitHub", "username": "dreyes", "url": "https://github.com/dreyes" },
      { "network": "LinkedIn", "username": "danielreyes", "url": "https://www.linkedin.com/in/danielreyes" }
    ]
  },
  "work": [
    {
      "name": "Harbor Freight Systems",
      "position": "Staff Platform Engineer",
      "location": "Austin, TX",
      "startDate": "2021-04",
      "summary": "Tech lead for the internal developer platform serving 40 product teams.",
      "highlights": [
        "Designed a Kubernetes-based deployment platform on AWS EKS that took median deploy time from 45 minutes to 6.",
        "Rolled out OpenTelemetry tracing across 180 services, cutting mean time to resolution by 52%.",
        "Built a Backstage developer portal adopted by 95% of engineers within two quarters."
      ],
      "keywords": ["Kubernetes", "Terraform", "Go", "AWS", "OpenTelemetry", "Argo CD"]
    },
    {
      "name": "Fieldnote",
      "position": "Senior Site Reliability Engineer",
      "location": "Remote",
      "startDate": "2018-01",
      "endDate": "2021-03",
      "highlights": [
        "Migrated 60 services from Heroku to GKE with zero customer-facing downtime.",
        "Introduced SLOs and error budgets, reducing paging volume by 70%.",
        "Wrote the incident-response playbook used company-wide."
      ]
    },
    {
      "name": "Cobalt Robotics",
      "position": "Software Engineer",
      "startDate": "2015-06",
      "endDate": "2017-12",
      "highlights": [
        "Built telemetry ingestion in Python and Kafka processing 4B events per day.",
        "Automated fleet provisioning with Ansible and Packer."
      ]
    }
  ],
  "projects": [
    {
      "name": "kube-cost-lens",
      "description": "Open-source kubectl plugin that attributes cloud spend to namespaces and teams.",
      "highlights": ["1.8k GitHub stars", "Used in production by 30+ companies"],
      "keywords": ["Go", "Kubernetes", "Prometheus"],
      "url": "https://github.com/dreyes/kube-cost-lens"
    },
    {
      "name": "Paved Road Handbook",
      "description": "Free online book on building internal developer platforms, read by 90k engineers.",
      "url": "https://paved-road.example"
    }
  ],
  "skills": [
    { "name": "Infrastructure", "keywords": ["Kubernetes", "Terraform", "AWS", "GCP", "Helm", "Argo CD"] },
    { "name": "Languages", "keywords": ["Go", "Python", "TypeScript", "Bash"] },
    { "name": "Observability", "keywords": ["OpenTelemetry", "Prometheus", "Grafana", "Datadog"] }
  ],
  "education": [
    {
      "institution": "The University of Texas at Austin",
      "area": "Electrical and Computer Engineering",
      "studyType": "B.S.",
      "startDate": "2011-08",
      "endDate": "2015-05"
    }
  ],
  "certificates": [
    { "name": "Certified Kubernetes Administrator (CKA)", "issuer": "CNCF", "date": "2022-02" },
    { "name": "HashiCorp Certified: Terraform Associate", "issuer": "HashiCorp", "date": "2020-09" }
  ],
  "languages": [
    { "language": "English", "fluency": "Native" },
    { "language": "Spanish", "fluency": "Native" }
  ],
  "volunteer": [
    {
      "organization": "Austin Code Academy",
      "position": "Mentor",
      "startDate": "2019-01",
      "summary": "Mentoring career-changers through their first infrastructure roles."
    }
  ]
}
`;

const TEXT_SAMPLE = `PRIYA RAMANATHAN
Machine Learning Engineer | NLP & Recommendation Systems
priya.ramanathan@example.com | +1 (415) 555-0134 | San Francisco, CA | linkedin.com/in/priyaram | github.com/priyaram-ml

SUMMARY
ML engineer with 6 years of experience taking models from notebook to production. Shipped ranking and
retrieval systems serving 30M users; comfortable across the stack from feature pipelines to model serving.

EXPERIENCE

Stratus Analytics — Senior Machine Learning Engineer                    Jan 2021 - Present
• Built a two-tower retrieval model in PyTorch that lifted click-through rate 14% across the home feed.
• Designed the feature store on Snowflake + Airflow, cutting training data prep from 2 days to 3 hours.
• Led an LLM evaluation harness for support-ticket triage (RAG over 1.2M docs, pgvector).

Brightpath Education, Machine Learning Engineer                         06/2018 – 12/2020
• Deployed a knowledge-tracing model (TensorFlow, Kubernetes) personalising lessons for 400k students
  and improving course completion by 9 points.
• Owned model monitoring with Prometheus and Grafana; on-call for inference services.

Research Intern
University of Toronto Vector Lab, Toronto, ON                           Summer 2017
• Published a workshop paper on low-resource named-entity recognition.

EDUCATION
M.S. Computer Science, University of Toronto — 2018
B.Tech Information Technology, Anna University, 2016    GPA: 8.9/10

TECHNICAL SKILLS
Languages: Python, SQL, Scala, Bash
ML: PyTorch, TensorFlow, scikit-learn, Hugging Face, XGBoost
Data & Infra: Spark, Airflow, Snowflake, Kubernetes, Docker, AWS

AWARDS
Kaggle Competitions Master — top 1% in 3 competitions (2020)
Best Paper, NeurIPS LatinX in AI Workshop, 2017

VOLUNTEERING
Mentor, AI4ALL summer program (2019 – present)
`;

export const SAMPLES: readonly Sample[] = [
  { id: "markdown", label: "Markdown résumé", description: "Headings, links and nested bullets", source: MARKDOWN_SAMPLE },
  { id: "json", label: "JSON Resume", description: "jsonresume.org schema", source: JSON_SAMPLE },
  { id: "text", label: "Plain-text export", description: "ALL-CAPS headings, column dates, wrapped bullets", source: TEXT_SAMPLE },
];

export const DEFAULT_SAMPLE = MARKDOWN_SAMPLE;

export function getSample(id: SampleId): Sample {
  return SAMPLES.find((sample) => sample.id === id) ?? (SAMPLES[0] as Sample);
}
