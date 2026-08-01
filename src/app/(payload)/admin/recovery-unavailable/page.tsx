export default function RecoveryUnavailablePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-lg border-l-4 border-amber-400 bg-slate-900 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          Operator action required
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Password recovery is unavailable.
        </h1>
        <p className="mt-4 leading-7 text-slate-300">
          Contact the designated CMS operator through an approved internal
          channel. Recovery emails are disabled until a production delivery and
          ownership policy is implemented.
        </p>
      </section>
    </main>
  );
}
