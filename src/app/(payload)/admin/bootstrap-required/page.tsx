export default function BootstrapRequiredPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-lg border-l-4 border-amber-400 bg-slate-900 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          CMS initialization required
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Public signup is disabled.
        </h1>
        <p className="mt-4 leading-7 text-slate-300">
          A server operator must create the first CMS administrator with the
          documented bootstrap command. No account can be created from this
          page.
        </p>
      </section>
    </main>
  );
}
