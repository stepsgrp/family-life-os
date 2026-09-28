import Link from "next/link";

const features = [
  ["📅", "Shared calendar", "Everyone's plans in one color-coded view, synced live."],
  ["🛒", "Grocery list", "Add from any phone, auto-sorted by aisle, checked off in the store."],
  ["🍽️", "Meal planner", "Plan the week, then turn it into a grocery list in one tap."],
  ["🧹", "Chores", "Assign, remind, and reward with points and a monthly leaderboard."],
  ["💊", "Reminders", "Medicine schedules and school deadlines, pushed to the right phones."],
  ["🤖", "AI helpers", "Dinner ideas from what's in the fridge, weekend plans, appointment drafts."],
];

export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <nav className="mb-20 flex items-center justify-between">
        <span className="text-lg font-semibold">🏡 Family Life OS</span>
        <div className="flex gap-3 text-sm">
          <Link href="/sign-in" className="rounded-lg px-3 py-2 hover:bg-white/60">Sign in</Link>
          <Link href="/sign-up" className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700">
            Start free
          </Link>
        </div>
      </nav>

      <section className="mb-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          The operating system for your family&apos;s life
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-500">
          Calendar, groceries, meals, chores, reminders, documents and emergency info in one shared app on
          web, iPhone and Android.
        </p>
        <Link href="/sign-up" className="mt-8 inline-block rounded-xl bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700">
          Create your family - it&apos;s free
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([icon, title, body]) => (
          <div key={title} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-ink-300/50 dark:bg-slate-900 dark:ring-slate-800">
            <div className="text-2xl">{icon}</div>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-ink-500">{body}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mt-20 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 ring-1 ring-ink-300/50 dark:bg-slate-900 dark:ring-slate-800">
          <h3 className="font-semibold">Free</h3>
          <p className="mt-1 text-3xl font-bold">$0</p>
          <ul className="mt-4 space-y-1 text-sm text-ink-500">
            <li>Up to 4 family members</li>
            <li>10 AI requests / month</li>
            <li>100 MB documents</li>
          </ul>
        </div>
        <div className="rounded-xl bg-brand-600 p-6 text-white">
          <h3 className="font-semibold">Family plan</h3>
          <p className="mt-1 text-3xl font-bold">
            $6.99<span className="text-base font-normal">/mo</span>
          </p>
          <ul className="mt-4 space-y-1 text-sm text-brand-100">
            <li>Unlimited members and AI</li>
            <li>10 GB documents</li>
            <li>14-day free trial - one subscription covers every device</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
