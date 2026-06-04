type SetupWarningProps = {
  message: string;
};

export function SetupWarning({ message }: SetupWarningProps) {
  return (
    <div className="rounded-md border border-amber/30 bg-amber/10 p-4 text-sm leading-6 text-ink">
      <p className="font-semibold">云端数据库未连接</p>
      <p className="mt-1 text-ink/70">{message}</p>
      <p className="mt-2 text-ink/70">请在 `.env.local` 设置 `DATABASE_URL`，然后运行 `npm run db:push`。</p>
    </div>
  );
}
