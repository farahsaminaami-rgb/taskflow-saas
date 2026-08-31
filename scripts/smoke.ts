import { authService } from "../src/services/auth.service";
import { workspaceService } from "../src/services/workspace.service";
import { projectService } from "../src/services/project.service";
import { taskService } from "../src/services/task.service";
import { commentService } from "../src/services/comment.service";
import { prisma } from "../src/lib/db";

const EMAIL = `smoke-${Date.now()}@taskflow.dev`;
const PASSWORD = "smoke-password-123";
const SLUG = `smoke-${Date.now().toString(36)}`;

const results: string[] = [];
let failures = 0;
const check = (name: string, cond: boolean, extra?: string) => {
  results.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? ` | ${extra}` : ""}`);
  if (!cond) failures += 1;
};

async function main() {
  const user = await authService.register({
    name: "Smoke Tester",
    email: EMAIL,
    password: PASSWORD,
    confirmPassword: PASSWORD,
  });
  check("auth.register creates user", !!user.id && user.email === EMAIL, user.email);

  const verified = await authService.verifyPassword(EMAIL, PASSWORD);
  check("auth.verifyPassword succeeds", verified !== null && verified.email === EMAIL);

  const badLogin = await authService.verifyPassword(EMAIL, "wrong-password");
  check("auth.verifyPassword rejects bad password", badLogin === null);

  const workspace = await workspaceService.create(user.id, {
    name: "Smoke Workspace",
    slug: SLUG,
    description: "created by smoke test",
  });
  check("workspace.create returns workspace", !!workspace.id && workspace.slug === SLUG);

  const ownerRole = (workspace as unknown as { members: { role: string }[] }).members?.[0]?.role;
  check("workspace.create adds OWNER membership", ownerRole === "OWNER", ownerRole ?? "none");

  const listed = await workspaceService.listForUser(user.id);
  check(
    "workspace.listForUser includes it",
    listed.some((w) => w.id === workspace.id)
  );

  const project = await projectService.create(workspace.id, user.id, {
    name: "Smoke Project",
    key: "SMK",
    description: "created by smoke test",
    color: "#6366f1",
  });
  check("project.create returns project", !!project.id && project.key === "SMK", project.key);
  check(
    "project.create seeds default board",
    project.statusColumns.length >= 4,
    `${project.statusColumns.length} columns`
  );

  const colInProgress = project.statusColumns.find((c) => c.category === "IN_PROGRESS");
  const colDone = project.statusColumns.find((c) => c.category === "DONE");
  check("default board has IN_PROGRESS", !!colInProgress);
  check("default board has DONE", !!colDone);

  const task = await taskService.create(workspace.id, user.id, {
    projectId: project.id,
    columnId: colInProgress!.id,
    title: "Smoke Task",
    description: "created by smoke test",
    priority: "HIGH",
    assigneeIds: [],
    tagIds: [],
  });
  check("task.create returns task", !!task.id && task.columnId === colInProgress!.id);

  const moved = await taskService.move(workspace.id, user.id, {
    taskId: task.id,
    columnId: colDone!.id,
    position: 0,
  });
  check("task.move returns task", !!moved && moved.columnId === colDone!.id);

  const comment = await commentService.add(workspace.id, user.id, {
    taskId: task.id,
    body: "Smoke comment body",
  });
  check("comment.add returns comment", !!comment.id && comment.body === "Smoke comment body");

  const comments = await commentService.list(workspace.id, user.id, task.id);
  check("comment.list returns it", comments.some((c) => c.id === comment.id));

  const dbCheck = await prisma.task.findUnique({
    where: { id: task.id },
    select: { columnId: true, completedAt: true },
  });
  check("db shows task in DONE column", dbCheck?.columnId === colDone!.id);

  const board = await projectService.getBoard(workspace.id, user.id, project.id);
  check("project.getBoard returns board", !!board && Array.isArray(board.columns));

  console.log(`\nSmoke results for ${EMAIL}:`);
  for (const r of results) console.log(`  ${r}`);
  console.log(failures === 0 ? `\nALL GREEN (${results.length} checks)` : `\n${failures} FAILURES`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("\nSMOKE TEST CRASHED:");
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});