type SetupWarningProps = {
  message: string;
};

export function SetupWarning({ message }: SetupWarningProps) {
  return (
    <div className="rounded-md border border-amber/30 bg-amber/10 p-4 text-sm leading-6 text-ink">
      <p className="font-semibold">Cloud database is not connected</p>
      <p className="mt-1 text-ink/70">{message}</p>
      <p className="mt-2 text-ink/70">Set `DATABASE_URL` in `.env.local`, then run `npm run db:push`.</p>
    </div>
  );
}
