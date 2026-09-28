import { prisma } from "./index";

// Creates a demo family for local development. Replace the Clerk ids with your own
// dev org/user ids (Clerk dashboard) to sign in as this family.
async function main() {
  const family = await prisma.family.upsert({
    where: { clerkOrgId: "org_demo" },
    update: {},
    create: {
      clerkOrgId: "org_demo",
      name: "The Demo Family",
      subscription: { create: {} },
      members: {
        create: [
          { displayName: "Alex", role: "ADMIN_PARENT", clerkUserId: "user_demo", color: "#6366F1" },
          { displayName: "Emma", role: "CHILD", color: "#F59E0B", interests: ["soccer", "drawing"] },
        ],
      },
      emergencyContacts: {
        create: [{ name: "Dr. Patel", relationship: "Pediatrician", phone: "+1-555-0100" }],
      },
    },
  });
  console.log(`Seeded family ${family.id}`);
}

main().finally(() => prisma.$disconnect());
