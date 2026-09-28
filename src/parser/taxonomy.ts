import { escapeRegExp } from "./text";

export const TECH_CATEGORIES = [
  "Languages",
  "Frontend",
  "Backend",
  "Data",
  "Cloud & DevOps",
  "AI & ML",
  "Mobile & Desktop",
  "Testing & Quality",
  "Design",
  "Tooling & Workflow",
] as const;

export type TechCategory = (typeof TECH_CATEGORIES)[number];

/**
 * Compact taxonomy: "Canonical|alias|alias". A leading "~" marks a term too ambiguous to detect in free prose
 * ("Go", "Swift", "Spring", "REST"); such terms are still recognised inside explicit skill lists.
 */
const TAXONOMY: Record<TechCategory, readonly string[]> = {
  Languages: [
    "TypeScript|~TS", "JavaScript|~JS|ES6|ES2015|ECMAScript", "Python|~Py|Python3", "~Go|Golang", "Rust", "Java",
    "Kotlin", "~Swift", "Objective-C|ObjC", "C++|cpp", "C#|csharp", "~C", "~R", "~Ruby", "PHP", "Scala", "Elixir",
    "Erlang", "Haskell", "Clojure", "~Dart", "Lua", "Perl", "~Julia", "Zig", "OCaml", "F#", "SQL", "Bash|Shell scripting|~Shell|~sh|Zsh",
    "PowerShell", "Solidity", "MATLAB", "HTML|HTML5", "CSS|CSS3", "Groovy", "~Assembly", "WebAssembly|Wasm", "~Nim",
    "~Crystal", "Gleam", "~Mojo", "COBOL", "Fortran", "Visual Basic|VB.NET",
  ],
  Frontend: [
    "React|React.js|ReactJS", "Next.js|NextJS|Next JS|~Next", "Vue.js|~Vue|VueJS|Vue 3", "Nuxt|Nuxt.js", "Angular|AngularJS",
    "Svelte", "SvelteKit", "SolidJS|Solid.js|~Solid", "Qwik", "Astro", "~Remix", "Gatsby", "Ember.js|~Ember", "Redux|Redux Toolkit|RTK",
    "Zustand", "MobX", "Jotai", "Recoil", "XState", "TanStack Query|React Query", "TanStack Router", "Tailwind CSS|Tailwind|TailwindCSS",
    "Sass|SCSS", "~Less", "styled-components|Styled Components", "Emotion", "CSS Modules", "shadcn/ui|shadcn", "Radix UI|~Radix",
    "Material UI|MUI", "Chakra UI", "~Bootstrap", "Storybook", "Three.js|ThreeJS", "React Three Fiber|R3F", "WebGL", "WebGPU",
    "D3.js|D3", "Framer Motion", "WebRTC", "Yjs", "CRDTs|CRDT", "Canvas API|HTML Canvas", "Service Workers", "IndexedDB", "GSAP", "Vite", "Webpack", "Turbopack", "esbuild", "Rollup", "Babel", "jQuery",
    "Web Components", "~Lit", "htmx", "Alpine.js", "Accessibility|a11y|WCAG", "Micro-frontends|Microfrontends",
    "Module Federation", "React Server Components|RSC", "Server-Side Rendering|SSR", "PWA|Progressive Web Apps",
  ],
  Backend: [
    "Node.js|NodeJS|~Node", "Deno", "~Bun", "Express|Express.js|ExpressJS", "NestJS|Nest.js", "Fastify", "Hono", "Koa",
    "Django", "Flask", "FastAPI", "Ruby on Rails|~Rails|RoR", "Laravel", "Symfony", "Spring Boot|~Spring", ".NET|dotnet|.NET Core",
    "ASP.NET|ASP.NET Core", "Phoenix", "~Gin", "Actix", "Axum", "tRPC", "GraphQL", "Apollo|Apollo GraphQL|Apollo Server",
    "REST APIs|~REST|RESTful|REST API", "gRPC", "WebSockets|WebSocket|Socket.io", "OAuth|OAuth2|OAuth 2.0", "OpenID Connect|OIDC",
    "JWT", "Serverless", "Microservices", "Event-driven architecture|Event-Driven", "Prisma", "Drizzle ORM|~Drizzle",
    "TypeORM", "Sequelize", "Hibernate", "SQLAlchemy", "Celery", "RabbitMQ", "Kafka|Apache Kafka", "~NATS",
    "~Temporal", "Stripe", "Supabase", "Firebase|Firestore", "Nginx", "Keycloak", "Auth0", "~Clerk",
  ],
  Data: [
    "PostgreSQL|Postgres|psql", "MySQL", "MariaDB", "SQLite", "MongoDB|Mongo", "Redis", "Elasticsearch|~Elastic", "OpenSearch",
    "DynamoDB", "Cassandra", "CockroachDB", "ClickHouse", "Snowflake", "BigQuery", "Redshift", "Databricks",
    "Apache Spark|~Spark|PySpark", "Hadoop", "Airflow|Apache Airflow", "dbt", "Apache Flink|~Flink", "Pandas", "NumPy",
    "Polars", "Tableau", "Power BI|PowerBI", "Looker", "Metabase", "Neo4j", "PlanetScale", "~Neon", "DuckDB", "pgvector",
    "NoSQL", "ETL|ELT", "Data Modeling|Data Modelling", "Kafka Streams", "Fivetran", "~Segment", "Amplitude", "Mixpanel",
  ],
  "Cloud & DevOps": [
    "AWS|Amazon Web Services", "Google Cloud|GCP|Google Cloud Platform", "Azure|Microsoft Azure", "Vercel", "Netlify",
    "Cloudflare|Cloudflare Workers", "Fly.io", "Heroku", "DigitalOcean", "~Render", "Docker", "Kubernetes|k8s|K8s", "~Helm",
    "Terraform", "Pulumi", "Ansible", "~Chef", "~Puppet", "Jenkins", "GitHub Actions", "GitLab CI|GitLab CI/CD", "CircleCI",
    "Argo CD|ArgoCD", "CI/CD|CICD", "Linux", "Prometheus", "Grafana", "Datadog", "Sentry", "OpenTelemetry|OTel",
    "New Relic", "AWS Lambda|~Lambda", "Amazon EC2|EC2", "Amazon S3|S3", "Amazon ECS|ECS", "Amazon EKS|EKS",
    "CloudFormation", "AWS CDK|~CDK", "Istio", "~Envoy", "HashiCorp Vault|~Vault", "Site Reliability Engineering|SRE",
    "Observability", "Nix|NixOS", "Podman", "Packer", "Consul", "GKE|Google Kubernetes Engine", "SLOs|SLO|Service Level Objectives", "Backstage", "Cloud Run", "App Engine", "Kubeflow",
  ],
  "AI & ML": [
    "PyTorch", "TensorFlow", "Keras", "scikit-learn|sklearn|Scikit Learn", "Hugging Face|HuggingFace|~Transformers",
    "LangChain", "LlamaIndex", "OpenAI API|OpenAI", "Anthropic API|Claude API", "LLMs|LLM|Large Language Models",
    "RAG|Retrieval-Augmented Generation", "Vector Databases|Vector DB", "Pinecone", "Weaviate", "Computer Vision|~CV",
    "NLP|Natural Language Processing", "MLOps", "MLflow", "Jupyter|Jupyter Notebooks", "XGBoost", "LightGBM", "OpenCV",
    "CUDA", "JAX", "Stable Diffusion", "Prompt Engineering", "Fine-tuning|Finetuning", "Weights & Biases|W&B|wandb",
    "Vertex AI", "SageMaker|Amazon SageMaker", "Ollama", "vLLM", "Deep Learning", "Machine Learning|~ML",
    "Reinforcement Learning|RLHF", "LLM Evaluation|Evals|LLM Evals", "AI Agents|~Agents|~Agentic",
  ],
  "Mobile & Desktop": [
    "React Native", "Flutter", "SwiftUI", "UIKit", "Jetpack Compose", "Android", "iOS", "~Expo", "Ionic", "Capacitor",
    "Xamarin", ".NET MAUI|MAUI", "Kotlin Multiplatform|KMP", "Electron", "Tauri", "Unity", "Unreal Engine", "Godot",
  ],
  "Testing & Quality": [
    "Jest", "Vitest", "Playwright", "Cypress", "Testing Library|React Testing Library|~RTL", "Mocha", "Chai", "Pytest",
    "JUnit", "Selenium", "Puppeteer", "k6", "Postman", "TDD|Test-Driven Development", "Detox", "RSpec", "Supertest",
    "MSW|Mock Service Worker", "ESLint", "Prettier", "Biome", "SonarQube", "Chromatic", "Lighthouse", "Web Vitals|Core Web Vitals",
  ],
  Design: [
    "Figma", "~Sketch", "Adobe XD", "Photoshop|Adobe Photoshop", "Illustrator|Adobe Illustrator", "After Effects",
    "Framer", "Design Systems|Design System", "Prototyping", "UX Research|User Research", "Wireframing", "Blender",
    "Spline", "Webflow", "Interaction Design", "Motion Design", "Design Tokens",
  ],
  "Tooling & Workflow": [
    "Git", "~GitHub", "~GitLab", "~Bitbucket", "Jira", "Confluence", "~Linear", "~Notion", "VS Code|VSCode|Visual Studio Code",
    "Vim|Neovim", "npm", "pnpm", "Yarn", "Turborepo", "Nx", "Bazel", "~Make|Makefile", "Agile", "Scrum", "Kanban",
    "Monorepos|Monorepo", "Code Review", "Technical Writing", "System Design", "Mentoring", "Technical Leadership",
  ],
};

export interface TechTerm {
  name: string;
  category: TechCategory;
}

const LOOKUP = new Map<string, TechTerm>();
const PROSE_ALIASES: Array<{ alias: string; term: TechTerm }> = [];

/** Lookup key: lowercase alphanumerics plus "+" and "#" so "Next.js", "NextJS" and "next js" collide. */
export function techKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+v?\d+(?:\.\d+)*$/, "")
    .replace(/[^a-z0-9+#]/g, "");
}

for (const category of TECH_CATEGORIES) {
  for (const entry of TAXONOMY[category]) {
    const parts = entry.split("|");
    const canonical = (parts[0] ?? "").replace(/^~/, "");
    const term: TechTerm = { name: canonical, category };
    for (const part of parts) {
      const ambiguous = part.startsWith("~");
      const alias = part.replace(/^~/, "");
      const key = techKey(alias);
      if (key && !LOOKUP.has(key)) LOOKUP.set(key, term);
      if (!ambiguous) PROSE_ALIASES.push({ alias, term });
    }
  }
}

export function lookupTech(value: string): TechTerm | null {
  const key = techKey(value);
  if (!key) return null;
  const direct = LOOKUP.get(key);
  if (direct) return direct;
  // "Python3", "Vue3", "Angular17" → retry without trailing version digits.
  const withoutVersion = key.replace(/(?<=[a-z+#])\d+$/, "");
  if (withoutVersion !== key) {
    const versioned = LOOKUP.get(withoutVersion);
    if (versioned) return versioned;
  }
  // "ReactJS"-style suffixes not listed explicitly.
  if (key.endsWith("js") && key.length > 4) return LOOKUP.get(key.slice(0, -2)) ?? null;
  return null;
}

/** Returns the canonical display name when the skill is known, otherwise a cleaned version of the input. */
export function canonicalizeSkill(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").replace(/[.;:]+$/, "").trim();
  return lookupTech(cleaned)?.name ?? cleaned;
}

let proseRegex: RegExp | null = null;

function getProseRegex(): RegExp {
  if (proseRegex) return proseRegex;
  const alternatives = [...PROSE_ALIASES]
    .sort((a, b) => b.alias.length - a.alias.length)
    .map((entry) => escapeRegExp(entry.alias));
  proseRegex = new RegExp(String.raw`(?<![A-Za-z0-9+#.])(?:${alternatives.join("|")})(?![A-Za-z0-9+#]|\.[A-Za-z])`, "gi");
  return proseRegex;
}

/** Detects technologies mentioned in prose, returned canonicalised and in order of first appearance. */
export function detectTechnologies(text: string, limit = Number.POSITIVE_INFINITY): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(getProseRegex())) {
    const term = lookupTech(match[0]);
    if (!term || seen.has(term.name)) continue;
    seen.add(term.name);
    found.push(term.name);
    if (found.length >= limit) break;
  }
  return found;
}

/** Share of items that are recognised technologies (used to tell "Languages: Go, Rust" from "Languages: French"). */
export function techRatio(items: readonly string[]): number {
  if (!items.length) return 0;
  return items.filter((item) => lookupTech(item) !== null).length / items.length;
}

/** Groups a flat list of skills by taxonomy category; unknown skills land in "Additional". */
export function groupByCategory(items: readonly string[]): Array<{ category: string; items: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const item of items) {
    const category = lookupTech(item)?.category ?? "Additional";
    const bucket = buckets.get(category) ?? [];
    bucket.push(item);
    buckets.set(category, bucket);
  }
  const order: string[] = [...TECH_CATEGORIES, "Additional"];
  return [...buckets.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([category, bucket]) => ({ category, items: bucket }));
}
