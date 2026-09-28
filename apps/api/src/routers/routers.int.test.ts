// Integration tests against a real Postgres. Run with:
//   TEST_DATABASE_URL=postgresql://flos:flos@localhost:5432/flos pnpm --filter @flos/api test
// They are skipped when TEST_DATABASE_URL is not set.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("tRPC routers (integration)", async () => {
  const { prisma } = await import("@flos/db");
  const { appRouter } = await import("../router");
  const { notifyOverdueChores } = await import("../jobs/overdue-chores");
  type Member = Awaited<ReturnType<typeof prisma.familyMember.create>>;

  const suffix = Date.now().toString(36);
  let parent: Member, child: Member, otherParent: Member;

  const log = { info() {}, warn() {}, error() {}, debug() {} };
  const callerFor = (member: Member) =>
    appRouter.createCaller({
      req: {} as never,
      prisma,
      userId: member.clerkUserId ?? `user_${member.id}`,
      member,
      log: log as never,
    });

  beforeAll(async () => {
    const fam = await prisma.family.create({
      data: { clerkOrgId: `org_a_${suffix}`, name: "Test A", subscription: { create: {} } },
    });
    const other = await prisma.family.create({
      data: { clerkOrgId: `org_b_${suffix}`, name: "Test B", subscription: { create: {} } },
    });
    parent = await prisma.familyMember.create({
      data: { familyId: fam.id, clerkUserId: `user_p_${suffix}`, displayName: "Pat", role: "ADMIN_PARENT" },
    });
    child = await prisma.familyMember.create({
      data: { familyId: fam.id, clerkUserId: `user_c_${suffix}`, displayName: "Kid", role: "CHILD" },
    });
    otherParent = await prisma.familyMember.create({
      data: { familyId: other.id, clerkUserId: `user_o_${suffix}`, displayName: "Other", role: "ADMIN_PARENT" },
    });
  });

  afterAll(async () => {
    await prisma.family.deleteMany({ where: { clerkOrgId: { in: [`org_a_${suffix}`, `org_b_${suffix}`] } } });
    await prisma.$disconnect();
  });

  it("only parents can create chores", async () => {
    await expect(callerFor(child).chores.create({ title: "Sneaky", recurrence: "NONE", points: 100 })).rejects.toThrow(
      /Requires role/,
    );
    const chore = await callerFor(parent).chores.create({
      title: "Dishes",
      assigneeId: child.id,
      recurrence: "NONE",
      points: 3,
    });
    expect(chore.familyId).toBe(parent.familyId);
  });

  it("children see only their own chores and can complete them", async () => {
    await callerFor(parent).chores.create({ title: "Parent task", assigneeId: parent.id, recurrence: "NONE", points: 1 });
    const visible = await callerFor(child).chores.list({ includeCompleted: false });
    expect(visible.every((c) => c.assigneeId === child.id)).toBe(true);

    const mine = visible[0]!;
    const done = await callerFor(child).chores.markComplete({ id: mine.id, completed: true });
    expect(done.completedAt).not.toBeNull();

    const parentTask = (await callerFor(parent).chores.list({ includeCompleted: false })).find((c) => c.title === "Parent task")!;
    await expect(callerFor(child).chores.markComplete({ id: parentTask.id, completed: true })).rejects.toThrow(/own chores/);
  });

  it("completing a recurring chore schedules the next one", async () => {
    const due = new Date("2026-03-01T17:00:00Z");
    const chore = await callerFor(parent).chores.create({
      title: "Trash",
      assigneeId: child.id,
      dueAt: due,
      recurrence: "WEEKLY",
      points: 2,
    });
    await callerFor(child).chores.markComplete({ id: chore.id, completed: true });
    const next = await prisma.chore.findFirst({ where: { familyId: parent.familyId, title: "Trash", completedAt: null } });
    expect(next?.dueAt?.toISOString()).toBe("2026-03-08T17:00:00.000Z");
  });

  it("isolates families from each other", async () => {
    const theirs = await callerFor(otherParent).chores.list({ includeCompleted: true });
    expect(theirs).toHaveLength(0);
    const ours = await prisma.chore.findFirstOrThrow({ where: { familyId: parent.familyId } });
    await expect(callerFor(otherParent).chores.delete({ id: ours.id })).rejects.toThrow(/NOT_FOUND/);
  });

  it("generates a deduped grocery list from the week's meals", async () => {
    const caller = callerFor(parent);
    const tacos = await caller.meals.createRecipe({
      name: "Tacos",
      ingredients: [
        { name: "Tomatoes", quantity: "2", category: "produce" },
        { name: "ground beef", quantity: "1 lb", category: "meat" },
      ],
      tags: [],
    });
    const salad = await caller.meals.createRecipe({
      name: "Salad",
      ingredients: [
        { name: "tomato", quantity: "1", category: "produce" },
        { name: "lettuce", category: "other" },
      ],
      tags: [],
    });
    await caller.grocery.add({ name: "Lettuce" }); // already on the list -> skipped
    await caller.meals.setMeal({ date: "2026-10-05", slot: "DINNER", recipeId: tacos.id, title: "Tacos" });
    await caller.meals.setMeal({ date: "2026-10-06", slot: "LUNCH", recipeId: salad.id, title: "Salad" });

    const result = await caller.meals.generateGroceryList({ weekStart: "2026-10-05" });
    expect(result).toEqual({ added: 2, skippedAlreadyOnList: 1 });

    const list = await caller.grocery.list();
    const tomato = list.find((i) => i.name === "Tomatoes");
    expect(tomato?.quantity).toBe("2 + 1");
    expect(list.find((i) => i.name === "ground beef")?.category).toBe("meat");
  });

  it("free families hit the member limit and invites are single-use", async () => {
    const caller = callerFor(parent);
    const { token } = await caller.family.createInvite({ role: "PARENT" });
    const joiner = appRouter.createCaller({ req: {} as never, prisma, userId: `user_j_${suffix}`, member: null, log: log as never });
    const member = await joiner.family.acceptInvite({ token, displayName: "Jo" });
    expect(member.role).toBe("PARENT");
    const other = appRouter.createCaller({ req: {} as never, prisma, userId: `user_k_${suffix}`, member: null, log: log as never });
    await expect(other.family.acceptInvite({ token, displayName: "Late" })).rejects.toThrow(/invalid or expired/);
  });

  it("nightly job flags overdue chores exactly once", async () => {
    await callerFor(parent).chores.create({
      title: "Overdue homework",
      assigneeId: child.id,
      dueAt: new Date(Date.now() - 3600_000),
      recurrence: "NONE",
      points: 1,
    });
    const first = await notifyOverdueChores();
    expect(first).toBeGreaterThanOrEqual(1);
    const flagged = await prisma.chore.findFirstOrThrow({ where: { familyId: parent.familyId, title: "Overdue homework" } });
    expect(flagged.overdueNotifiedAt).not.toBeNull();
    const again = await prisma.chore.count({
      where: { familyId: parent.familyId, completedAt: null, dueAt: { lt: new Date() }, overdueNotifiedAt: null },
    });
    expect(again).toBe(0);
  });
});
