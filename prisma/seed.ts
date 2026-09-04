import bcrypt from "bcryptjs";
import {
  PrismaClient,
  type UserRole,
  type ColumnCategory,
  type TaskPriority,
  type ClientStatus,
  type InvoiceStatus,
  type InvoiceCurrency,
} from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// TaskFlow Demo Seed — "Nova Digital Agency"
// ----------------------------------------------------------------------------
// A realistic, fully-populated demo workspace so the product tells a coherent
// business story on first open (dashboard, CRM, invoices, analytics all show
// real aggregated data — nothing is hardcoded into the UI).
//
// The seed is idempotent: it DELETES and recreates the demo workspace, so it
// can be re-run at any time to reset the demo to a pristine state:
//     npm run db:seed
// ============================================================================

const DEMO_EMAIL = "demo@taskflow.dev";
const DEMO_PASSWORD = "password123";
const WORKSPACE_SLUG = "nova-digital-agency";
const WORKSPACE_NAME = "Nova Digital Agency";

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
const TEAM: Array<{
  email: string;
  name: string;
  role: UserRole;
  isDemo?: boolean;
}> = [
  { email: DEMO_EMAIL, name: "Farah", role: "OWNER", isDemo: true },
  { email: "ahmed@novadigital.dev", name: "Ahmed", role: "ADMIN" },
  { email: "sara@novadigital.dev", name: "Sara", role: "MEMBER" },
  { email: "omar@novadigital.dev", name: "Omar", role: "MEMBER" },
  { email: "lina@novadigital.dev", name: "Lina", role: "VIEWER" },
];

// ---------------------------------------------------------------------------
// Clients (CRM)
// ---------------------------------------------------------------------------
const CLIENTS: Array<{
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  status: ClientStatus;
  notes: string;
}> = [
  {
    companyName: "Acme Corporation",
    contactName: "Daniel Reyes",
    email: "daniel@acmecorp.com",
    phone: "+1 (555) 010-1200",
    website: "https://acmecorp.com",
    status: "ACTIVE",
    notes: "Primary enterprise client. Prefers detailed weekly progress reports.",
  },
  {
    companyName: "TechVision",
    contactName: "Maya Lindqvist",
    email: "maya@techvision.io",
    phone: "+1 (555) 013-4455",
    website: "https://techvision.io",
    status: "ACTIVE",
    notes: "Fast-moving startup. Monthly sprint reviews.",
  },
  {
    companyName: "Digital Hub",
    contactName: "Ravi Sharma",
    email: "ravi@digitalhub.co",
    phone: "+44 20 7946 0958",
    website: "https://digitalhub.co",
    status: "ACTIVE",
    notes: "Building their flagship e-commerce experience.",
  },
  {
    companyName: "Bright Labs",
    contactName: "Elena Petrova",
    email: "elena@brightlabs.com",
    phone: "+1 (555) 017-3321",
    website: "https://brightlabs.com",
    status: "ACTIVE",
    notes: "Brand identity + marketing support. Design-led client.",
  },
  {
    companyName: "Future Systems",
    contactName: "Tomás Herrera",
    email: "tomas@futuresystems.net",
    phone: "+1 (555) 011-9876",
    website: "https://futuresystems.net",
    status: "LEAD",
    notes: "Evaluating a client portal. Follow up after Q3 review.",
  },
  {
    companyName: "Nova Partners",
    contactName: "Internal",
    email: "internal@novadigital.dev",
    phone: "+1 (555) 010-0000",
    website: "https://novadigital.dev",
    status: "INACTIVE",
    notes: "Internal workspace accounts for facilities and admin.",
  },
];

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
const PROJECTS: Array<{
  name: string;
  key: string;
  description: string;
  color: string;
  client: string; // by companyName
  priority: "high" | "medium" | "low";
  startOffsetDays: number;
  dueOffsetDays: number;
}> = [
  {
    name: "Corporate Website Redesign",
    key: "WEB",
    description: "Full redesign and build-out of the Acme corporate site with CMS and analytics.",
    color: "#6366f1",
    client: "Acme Corporation",
    priority: "medium",
    startOffsetDays: -60,
    dueOffsetDays: 20,
  },
  {
    name: "Mobile App Development",
    key: "APP",
    description: "Cross-platform mobile app for TechVision's customer engagement platform.",
    color: "#0ea5e9",
    client: "TechVision",
    priority: "high",
    startOffsetDays: -40,
    dueOffsetDays: 45,
  },
  {
    name: "E-Commerce Platform",
    key: "ECO",
    description: "Headless storefront and checkout for Digital Hub's online retail brand.",
    color: "#10b981",
    client: "Digital Hub",
    priority: "high",
    startOffsetDays: -75,
    dueOffsetDays: 15,
  },
  {
    name: "Brand Identity",
    key: "BRD",
    description: "Logo, visual identity system and brand guidelines for Bright Labs.",
    color: "#f59e0b",
    client: "Bright Labs",
    priority: "medium",
    startOffsetDays: -30,
    dueOffsetDays: 10,
  },
  {
    name: "Marketing Campaign",
    key: "MKT",
    description: "Integrated campaign: landing pages, email sequences and paid ads.",
    color: "#ef4444",
    client: "Bright Labs",
    priority: "medium",
    startOffsetDays: -20,
    dueOffsetDays: 30,
  },
  {
    name: "Client Portal",
    key: "PTL",
    description: "Self-serve portal prototype with report sharing for Future Systems.",
    color: "#8b5cf6",
    client: "Future Systems",
    priority: "low",
    startOffsetDays: -10,
    dueOffsetDays: 60,
  },
];

// ---------------------------------------------------------------------------
// Tasks — (projectKey, columnCategory, title, priority, assigneeName[], dueOffsetDays, tag[],
//          description, hasComments, done?)
// ---------------------------------------------------------------------------
interface TaskSeed {
  projectKey: string;
  column: ColumnCategory;
  title: string;
  priority: TaskPriority;
  assignees: string[];
  dueOffset: number | null;
  tags: string[];
  description: string;
  commentCount: number;
  doneOffset?: number; // if set, completed at this many days ago
}

const TASKS: TaskSeed[] = [
  // --- Corporate Website Redesign (WEB) ---
  {
    projectKey: "WEB", column: "DONE", title: "Kickoff and requirements workshop", priority: "HIGH",
    assignees: ["Farah", "Ahmed", "Sara"], dueOffset: -58, tags: ["Planning"],
    description: "Facilitated discovery sessions with Acme stakeholders and mapped the sitemap.", commentCount: 3, doneOffset: 56,
  },
  {
    projectKey: "WEB", column: "DONE", title: "Wireframes for key templates", priority: "HIGH",
    assignees: ["Sara"], dueOffset: -45, tags: ["Design"],
    description: "Low-to-mid fidelity wireframes for home, services, and contact.", commentCount: 4, doneOffset: 40,
  },
  {
    projectKey: "WEB", column: "DONE", title: "Homepage visual design", priority: "MEDIUM",
    assignees: ["Sara", "Farah"], dueOffset: -28, tags: ["Design"],
    description: "High-fidelity homepage with the new brand direction.", commentCount: 5, doneOffset: 22,
  },
  {
    projectKey: "WEB", column: "IN_PROGRESS", title: "Build reusable React components", priority: "URGENT",
    assignees: ["Ahmed", "Omar"], dueOffset: 8, tags: ["Development"],
    description: "Button, card, hero, and nav components in the shared design system.", commentCount: 2,
  },
  {
    projectKey: "WEB", column: "IN_PROGRESS", title: "Integrate CMS content model", priority: "HIGH",
    assignees: ["Omar"], dueOffset: 12, tags: ["Backend"],
    description: "Configure content types and connect the headless CMS to the frontend.", commentCount: 1,
  },
  {
    projectKey: "WEB", column: "REVIEW", title: "Accessibility audit (WCAG AA)", priority: "HIGH",
    assignees: ["Lina"], dueOffset: 5, tags: ["QA"],
    description: "Automated and manual accessibility review across templates.", commentCount: 0,
  },
  {
    projectKey: "WEB", column: "TODO", title: "SEO metadata & structured data", priority: "LOW",
    assignees: ["Omar"], dueOffset: 18, tags: ["Backend"],
    description: "Add meta tags, OpenGraph, and JSON-LD schema.", commentCount: 0,
  },

  // --- Mobile App Development (APP) ---
  {
    projectKey: "APP", column: "DONE", title: "Define core feature scope", priority: "HIGH",
    assignees: ["Farah", "Ahmed"], dueOffset: -38, tags: ["Planning"],
    description: "Prioritized the MVP feature set with TechVision.", commentCount: 3, doneOffset: 34,
  },
  {
    projectKey: "APP", column: "IN_PROGRESS", title: "Set up CI/CD pipeline", priority: "HIGH",
    assignees: ["Ahmed"], dueOffset: 6, tags: ["DevOps"],
    description: "Automated builds, tests and OTA distribution.", commentCount: 2,
  },
  {
    projectKey: "APP", column: "IN_PROGRESS", title: "Implement authentication flow", priority: "URGENT",
    assignees: ["Omar", "Ahmed"], dueOffset: 9, tags: ["Development", "Security"],
    description: "OAuth + device session handling with refresh tokens.", commentCount: 4,
  },
  {
    projectKey: "APP", column: "REVIEW", title: "Push notification service", priority: "MEDIUM",
    assignees: ["Omar"], dueOffset: 7, tags: ["Development"],
    description: "Register devices and route in-app notifications.", commentCount: 1,
  },
  {
    projectKey: "APP", column: "TODO", title: "Onboarding screens", priority: "LOW",
    assignees: ["Sara"], dueOffset: 20, tags: ["Design"],
    description: "First-run experience and permissions guidance.", commentCount: 0,
  },
  {
    projectKey: "APP", column: "TODO", title: "Offline-first data sync", priority: "MEDIUM",
    assignees: ["Ahmed"], dueOffset: 30, tags: ["Development"],
    description: "Queue writes and reconcile conflicts when back online.", commentCount: 0,
  },

  // --- E-Commerce Platform (ECO) ---
  {
    projectKey: "ECO", column: "DONE", title: "Catalog data model", priority: "HIGH",
    assignees: ["Ahmed", "Omar"], dueOffset: -70, tags: ["Backend"],
    description: "Products, variants, categories and inventory schema.", commentCount: 4, doneOffset: 64,
  },
  {
    projectKey: "ECO", column: "DONE", title: "Stripe payment integration", priority: "URGENT",
    assignees: ["Ahmed"], dueOffset: -25, tags: ["Payments"],
    description: "Checkout session + webhook handling for subscriptions.", commentCount: 6, doneOffset: 28,
  },
  {
    projectKey: "ECO", column: "IN_PROGRESS", title: "Product detail page", priority: "HIGH",
    assignees: ["Sara", "Omar"], dueOffset: 8, tags: ["Development", "Design"],
    description: "Rich PDP with gallery, variants and reviews.", commentCount: 2,
  },
  {
    projectKey: "ECO", column: "REVIEW", title: "Cart & checkout flow", priority: "URGENT",
    assignees: ["Omar"], dueOffset: 6, tags: ["Development"],
    description: "Streamlined multi-step checkout with address validation.", commentCount: 3,
  },
  {
    projectKey: "ECO", column: "TODO", title: "Order management dashboard", priority: "MEDIUM",
    assignees: ["Ahmed"], dueOffset: 22, tags: ["Backend"],
    description: "Admin panel to view, edit and fulfill orders.", commentCount: 0,
  },
  {
    projectKey: "ECO", column: "TODO", title: "Email receipts & abandoned cart", priority: "LOW",
    assignees: ["Lina"], dueOffset: 28, tags: ["Marketing"],
    description: "Transactional and recovery email templates.", commentCount: 0,
  },

  // --- Brand Identity (BRD) ---
  {
    projectKey: "BRD", column: "DONE", title: "Brand discovery & moodboards", priority: "HIGH",
    assignees: ["Sara", "Farah"], dueOffset: -28, tags: ["Design"],
    description: "Collected competitor and inspiration references.", commentCount: 3, doneOffset: 25,
  },
  {
    projectKey: "BRD", column: "DONE", title: "Logo concepts", priority: "HIGH",
    assignees: ["Sara"], dueOffset: -15, tags: ["Design"],
    description: "Three distinct logo directions presented to client.", commentCount: 5, doneOffset: 12,
  },
  {
    projectKey: "BRD", column: "REVIEW", title: "Visual identity system", priority: "HIGH",
    assignees: ["Sara", "Farah"], dueOffset: 4, tags: ["Design"],
    description: "Color palette, typography, iconography and usage rules.", commentCount: 2,
  },
  {
    projectKey: "BRD", column: "TODO", title: "Brand guidelines document", priority: "MEDIUM",
    assignees: ["Sara"], dueOffset: 10, tags: ["Design"],
    description: "Comprehensive PDF brand book for the client's internal use.", commentCount: 0,
  },

  // --- Marketing Campaign (MKT) ---
  {
    projectKey: "MKT", column: "IN_PROGRESS", title: "Landing page copy", priority: "HIGH",
    assignees: ["Farah"], dueOffset: 7, tags: ["Content"],
    description: "Persuasive copy for the campaign landing pages.", commentCount: 2,
  },
  {
    projectKey: "MKT", column: "TODO", title: "Email nurture sequence", priority: "MEDIUM",
    assignees: ["Lina"], dueOffset: 15, tags: ["Marketing"],
    description: "Five-email sequence to convert leads.", commentCount: 0,
  },
  {
    projectKey: "MKT", column: "TODO", title: "Paid social campaign setup", priority: "MEDIUM",
    assignees: ["Omar"], dueOffset: 18, tags: ["Ads"],
    description: "Audience targeting and ad creatives for Meta + LinkedIn.", commentCount: 0,
  },
  {
    projectKey: "MKT", column: "REVIEW", title: "Campaign analytics dashboard", priority: "LOW",
    assignees: ["Ahmed"], dueOffset: 12, tags: ["Analytics"],
    description: "Consolidated KPI dashboard for the campaign.", commentCount: 1,
  },

  // --- Client Portal (PTL) ---
  {
    projectKey: "PTL", column: "TODO", title: "Portal UX research", priority: "LOW",
    assignees: ["Sara"], dueOffset: 25, tags: ["Design"],
    description: "Interview prospective users at Future Systems.", commentCount: 0,
  },
  {
    projectKey: "PTL", column: "REVIEW", title: "Interactive prototype", priority: "MEDIUM",
    assignees: ["Sara", "Farah"], dueOffset: 14, tags: ["Design"],
    description: "Clickable prototype of the self-serve portal.", commentCount: 2,
  },
  {
    projectKey: "PTL", column: "TODO", title: "Tech stack & hosting proposal", priority: "LOW",
    assignees: ["Ahmed"], dueOffset: 40, tags: ["Planning"],
    description: "Architecture recommendation and cost estimate.", commentCount: 0,
  },
];

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
interface InvoiceSeed {
  number: string;
  client: string;
  project?: string;
  status: InvoiceStatus;
  currency: InvoiceCurrency;
  issueOffset: number;
  dueOffset: number;
  taxRate: number;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  notes?: string;
}

const INVOICES: InvoiceSeed[] = [
  {
    number: "INV-1001", client: "Acme Corporation", project: "WEB", status: "PAID",
    currency: "USD", issueOffset: -50, dueOffset: -20, taxRate: 0,
    items: [
      { description: "Discovery & requirements workshop", quantity: 2, unitPrice: 1500 },
      { description: "Wireframes for key templates", quantity: 6, unitPrice: 900 },
    ],
    notes: "Deposit invoice for the website redesign kickoff.",
  },
  {
    number: "INV-1002", client: "TechVision", project: "APP", status: "SENT",
    currency: "USD", issueOffset: -12, dueOffset: 18, taxRate: 0,
    items: [
      { description: "Mobile app MVP — milestone 1", quantity: 1, unitPrice: 9500 },
    ],
    notes: "First milestone on the mobile application.",
  },
  {
    number: "INV-1003", client: "Digital Hub", project: "ECO", status: "OVERDUE",
    currency: "EUR", issueOffset: -32, dueOffset: -2, taxRate: 20,
    items: [
      { description: "Storefront build — sprint 1", quantity: 1, unitPrice: 7200 },
      { description: "Stripe integration", quantity: 1, unitPrice: 1800 },
    ],
    notes: "Second invoice for the e-commerce platform.",
  },
  {
    number: "INV-1004", client: "Bright Labs", project: "BRD", status: "PAID",
    currency: "USD", issueOffset: -18, dueOffset: -1, taxRate: 0,
    items: [
      { description: "Logo concepts", quantity: 1, unitPrice: 2400 },
      { description: "Moodboard exploration", quantity: 1, unitPrice: 800 },
    ],
    notes: "Brand identity deposit.",
  },
  {
    number: "INV-1005", client: "Acme Corporation", project: "WEB", status: "PENDING",
    currency: "USD", issueOffset: -6, dueOffset: 24, taxRate: 0,
    items: [
      { description: "React component build — sprint 4", quantity: 5, unitPrice: 1100 },
    ],
    notes: "Milestone invoice for build phase.",
  },
  {
    number: "INV-1006", client: "Bright Labs", project: "MKT", status: "DRAFT",
    currency: "USD", issueOffset: -2, dueOffset: 20, taxRate: 0,
    items: [
      { description: "Campaign landing pages", quantity: 3, unitPrice: 850 },
      { description: "Email nurture setup", quantity: 1, unitPrice: 1200 },
    ],
    notes: "Awaiting client approval before sending.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const now = () => new Date();
const daysFrom = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};

function uid(seed: number): string {
  const hex = (n: number) => n.toString(16).padStart(12, "0");
  const extra = (n: number) => n.toString(16).padStart(4, "0");
  const rand = Math.floor(Math.random() * 0xffffff) + seed;
  return `00000000-0000-4000-8000-${hex(rand).slice(-12)}`.replace(/-(.{4})-/, `-${extra(seed)}-`);
}

const TASK_TAG_COLORS: Record<string, string> = {
  Planning: "#6366f1",
  Design: "#ec4899",
  Development: "#0ea5e9",
  Backend: "#10b981",
  DevOps: "#14b8a6",
  Security: "#8b5cf6",
  QA: "#f59e0b",
  Content: "#ef4444",
  Marketing: "#f43f5e",
  Ads: "#f97316",
  Analytics: "#22c55e",
  Payments: "#84cc16",
};

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // --- 0. Reset existing demo workspace (idempotent) ---------------------
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: WORKSPACE_SLUG },
    select: { id: true },
  });
  if (existingWorkspace) {
    await prisma.$transaction([
      prisma.invoiceItem.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.invoice.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.client.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.aIMessage.deleteMany({ where: { conversation: { workspaceId: existingWorkspace.id } } }),
      prisma.aIConversation.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.attachment.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.comment.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.taskMention.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.taskTagRelation.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.taskAssignment.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.activeTimer.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.timeEntry.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.task.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.projectTag.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.statusColumn.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.project.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.notification.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.invitation.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.activityLog.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.billingEvent.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.workspaceMember.deleteMany({ where: { workspaceId: existingWorkspace.id } }),
      prisma.subscription.delete({ where: { workspaceId: existingWorkspace.id } }),
      prisma.workspace.delete({ where: { id: existingWorkspace.id } }),
    ]);
  }

  // --- 1. Users -----------------------------------------------------------
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Farah", isOnboarded: true },
    create: { email: DEMO_EMAIL, name: "Farah", passwordHash, isOnboarded: true },
  });

  const teamUserIds = new Map<string, string>();
  teamUserIds.set("Farah", demoUser.id);
  for (const member of TEAM) {
    if (member.isDemo) continue;
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: { name: member.name, isOnboarded: true },
      create: { email: member.email, name: member.name, passwordHash, isOnboarded: true },
    });
    teamUserIds.set(member.name, user.id);
  }

  // --- 2. Workspace + owner + subscription -------------------------------
  const workspace = await prisma.workspace.create({
    data: {
      slug: WORKSPACE_SLUG,
      name: WORKSPACE_NAME,
      description:
        "Nova Digital Agency — a full-service web, mobile and brand agency. This demo workspace showcases TaskFlow's project, client, invoicing and analytics capabilities.",
      ownerId: demoUser.id,
      plan: "BUSINESS",
      maxProjects: 99999,
      maxMembers: 99999,
      maxTasksPerProject: 99999,
      members: {
        create: TEAM.map((m) => ({
          userId: teamUserIds.get(m.name)!,
          role: m.role,
          status: "ACTIVE",
        })),
      },
      subscription: {
        create: {
          plan: "BUSINESS",
          status: "ACTIVE",
          interval: "MONTHLY",
          seats: TEAM.length,
        },
      },
    },
  });

  // --- 3. Clients ---------------------------------------------------------
  const clientIds = new Map<string, string>();
  for (const c of CLIENTS) {
    const client = await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        phone: c.phone,
        website: c.website,
        status: c.status,
        notes: c.notes,
        createdById: demoUser.id,
      },
    });
    clientIds.set(c.companyName, client.id);
  }

  // --- 4. Projects + columns + tags --------------------------------------
  const projectIds = new Map<string, string>();

  const COLUMN_DEFS: Array<{ name: string; category: ColumnCategory; color: string }> = [
    { name: "Backlog", category: "TODO", color: "#64748b" },
    { name: "To Do", category: "TODO", color: "#94a3b8" },
    { name: "In Progress", category: "IN_PROGRESS", color: "#3b82f6" },
    { name: "Review", category: "REVIEW", color: "#f59e0b" },
    { name: "Done", category: "DONE", color: "#22c55e" },
  ];

  for (const p of PROJECTS) {
    const projectColumns = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: p.name,
        key: p.key,
        description: p.description,
        color: p.color,
        clientId: clientIds.get(p.client),
        createdById: demoUser.id,
        createdAt: daysFrom(p.startOffsetDays),
        updatedAt: daysFrom(p.startOffsetDays),
        statusColumns: {
          create: COLUMN_DEFS.map((c, i) => ({
            workspaceId: workspace.id,
            name: c.name,
            category: c.category,
            position: i,
            color: c.color,
            isDefault: i === 0,
          })),
        },
      },
    });
    projectIds.set(p.key, projectColumns.id);
  }

  // --- 5. Tasks -----------------------------------------------------------
  for (let i = 0; i < TASKS.length; i++) {
    const t = TASKS[i];
    const projectId = projectIds.get(t.projectKey)!;
    const column = await prisma.statusColumn.findFirstOrThrow({
      where: { workspaceId: workspace.id, projectId, name: columnNameFor(t.column) },
    });

    const taskId = uid(1000 + i);
    await prisma.task.create({
      data: {
        id: taskId,
        workspaceId: workspace.id,
        projectId,
        columnId: column.id,
        createdById: teamUserIds.get(t.assignees[0] ?? "Farah") ?? demoUser.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueAt: t.dueOffset === null ? null : daysFrom(t.dueOffset),
        position: i,
        completedAt: t.doneOffset !== undefined ? daysFrom(-t.doneOffset) : null,
        assignees: {
          create: t.assignees.map((a) => ({
            workspaceId: workspace.id,
            userId: teamUserIds.get(a)!,
          })),
        },
        tags: { create: [] },
      },
    });

    // Project tags (tag per task, dedupe within project).
    const tagsForProject = new Map<string, string>();
    for (const tagName of t.tags) {
      let tagId = tagsForProject.get(tagName);
      if (!tagId) {
        const existing = await prisma.projectTag.findUnique({
          where: { projectId_name: { projectId, name: tagName } },
        });
        tagId = existing?.id ?? (
          await prisma.projectTag.create({
            data: { workspaceId: workspace.id, projectId, name: tagName, color: TASK_TAG_COLORS[tagName] ?? "#94a3b8" },
          })
        ).id;
        tagsForProject.set(tagName, tagId);
      }
      await prisma.taskTagRelation.create({
        data: { workspaceId: workspace.id, taskId, tagId },
      });
    }

    // Comments.
    const authors = ["Ahmed", "Sara", "Omar", "Farah"];
    for (let c = 0; c < t.commentCount; c++) {
      const author = authors[Math.floor(Math.random() * authors.length)];
      await prisma.comment.create({
        data: {
          workspaceId: workspace.id,
          taskId,
          authorId: teamUserIds.get(author)!,
          body: sampleComment(t.title, t.commentCount, c),
          createdAt: daysFrom(-(Math.min(t.dueOffset ?? 10, 10) + c)),
        },
      });
    }
  }

  // --- 6. Invoices --------------------------------------------------------
  for (const inv of INVOICES) {
    const clientId = clientIds.get(inv.client)!;
    const projectId = inv.project ? projectIds.get(inv.project) : undefined;
    const items = inv.items.map((it) => ({ ...it, amount: +(it.quantity * it.unitPrice).toFixed(2) }));
    const subtotal = +items.reduce((s, it) => s + it.amount, 0).toFixed(2);
    const taxAmount = inv.status === "PAID" || inv.status === "OVERDUE" ? +(subtotal * (inv.taxRate / 100)).toFixed(2) : 0;
    const total = +(subtotal + (inv.status === "PAID" || inv.status === "OVERDUE" ? taxAmount : 0)).toFixed(2);

    const invoiceId = uid(3000 + INVOICES.indexOf(inv));
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        workspaceId: workspace.id,
        clientId,
        projectId,
        number: inv.number,
        status: inv.status,
        currency: inv.currency,
        issueDate: daysFrom(inv.issueOffset),
        dueDate: daysFrom(inv.dueOffset),
        taxRate: inv.taxRate,
        discount: 0,
        subtotal,
        taxAmount,
        total,
        notes: inv.notes ?? null,
        createdById: demoUser.id,
        paidAt: inv.status === "PAID" ? daysFrom(-15) : null,
        items: { create: items.map((it) => ({ workspaceId: workspace.id, ...it })) },
      },
    });
  }

  // --- 7. Seed a small activity log for a lively feed ----------------------
  const activity = [
    { action: "project.created", entityType: "project", meta: { name: "Corporate Website Redesign" } },
    { action: "task.completed", entityType: "task", meta: { title: "Stripe payment integration" } },
    { action: "client.created", entityType: "client", meta: { name: "Acme Corporation" } },
    { action: "invoice.paid", entityType: "invoice", meta: { number: "INV-1001" } },
    { action: "member.joined", entityType: "member", meta: { name: "Lina" } },
  ];
  for (let i = 0; i < activity.length; i++) {
    const a = activity[i];
    await prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        actorId: teamUserIds.get(["Farah", "Ahmed", "Sara", "Omar"][i % 4])!,
        action: a.action,
        entityType: a.entityType,
        meta: a.meta,
        createdAt: daysFrom(-(i + 1)),
      },
    });
  }

  console.log(
    `✅ Seeded "Nova Digital Agency" (${WORKSPACE_SLUG})\n` +
      `   Members: ${TEAM.length} · Clients: ${CLIENTS.length} · Projects: ${PROJECTS.length} · ` +
      `Tasks: ${TASKS.length} · Invoices: ${INVOICES.length}\n` +
      `   Owner login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`
  );
}

function columnNameFor(category: ColumnCategory): string {
  switch (category) {
    case "TODO": return "To Do";
    case "IN_PROGRESS": return "In Progress";
    case "REVIEW": return "Review";
    case "DONE": return "Done";
    default: return "Backlog";
  }
}

const COMMENTS = [
  (t: string) => `Assigned to me — starting on this today.`,
  (t: string) => `A couple of edge cases to confirm with the client before we finalize.`,
  (t: string) => `Looks good on my end, ready for review.`,
  (t: string) => `I'll pick this up after the current sprint.`,
  (t: string) => `Client asked for a slightly different approach on this one.`,
  (t: string) => `Done! Pushed the changes and left a note in the PR.`,
];
function sampleComment(title: string, count: number, index: number): string {
  return COMMENTS[(index + count) % COMMENTS.length](title);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
