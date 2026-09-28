import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {/* New users land on onboarding to create or join a family. */}
      <SignUp fallbackRedirectUrl="/onboarding" />
    </main>
  );
}
