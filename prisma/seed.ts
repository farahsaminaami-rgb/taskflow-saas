import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "demo@taskflow.dev";
const PASSWORD = "password123";
const WORKSPACE_SLUG = "taskflow-demo";

const COLUMNS = [
  { name: "Backlog", category: "TODO", position: 0 },
  { name: "In Progress", category: "IN_PROGRESS", position: 1 },
  { name: "In Review", category: "REVIEW", position: 2 },
  { name: "Done", category: "DONE", position: 3 },
] as const;

const TASK_TITLES = [
  "Set up the project workspace",
  "Design the authentication flow",
  "Build the Kanban board",
  "Add realtime collaboration",
];

const TASK_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { isOnboarded: true },
    create: {
      email: EMAIL,
      name: "Demo User",
      passwordHash,
      isOnboarded: true,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { ownerId: user.id },
    create: {
      slug: WORKSPACE_SLUG,
      name: "TaskFlow Demo",
      description: "Demo workspace seeded for local development",
      ownerId: user.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    update: { role: "OWNER", status: "ACTIVE" },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const project = await prisma.project.upsert({
    where: { workspaceId_key: { workspaceId: workspace.id, key: "DEMO" } },
    update: { createdById: user.id },
    create: {
      workspaceId: workspace.id,
      name: "Demo Project",
      key: "DEMO",
      description: "Sample project used to exercise the app locally",
      createdById: user.id,
      color: "#6366f1",
    },
  });

  for (const col of COLUMNS) {
    await prisma.statusColumn.upsert({
      where: { projectId_name: { projectId: project.id, name: col.name } },
      update: { category: col.category, position: col.position, isDefault: true },
      create: {
        workspaceId: workspace.id,
        projectId: project.id,
        name: col.name,
        category: col.category,
        position: col.position,
        isDefault: true,
      },
    });
  }

  const backlog = await prisma.statusColumn.findUniqueOrThrow({
    where: { projectId_name: { projectId: project.id, name: "Backlog" } },
  });
  const inProgress = await prisma.statusColumn.findUniqueOrThrow({
    where: { projectId_name: { projectId: project.id, name: "In Progress" } },
  });

  for (const [i, title] of TASK_TITLES.entries()) {
    const columnId = i % 2 === 0 ? backlog.id : inProgress.id;
    const existing = await prisma.task.findUnique({ where: { id: TASK_IDS[i] } });
    if (existing) {
      await prisma.task.update({
        where: { id: TASK_IDS[i] },
        data: { title, projectId: project.id, columnId, createdById: user.id },
      });
    } else {
      await prisma.task.create({
        data: {
          id: TASK_IDS[i],
          workspaceId: workspace.id,
          projectId: project.id,
          columnId,
          createdById: user.id,
          title,
          position: i,
        },
      });
    }
  }

  console.log(
    `Seeded: ${EMAIL} / ${PASSWORD} | workspace "${workspace.name}" (${workspace.slug}) | project "${project.name}"`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());