type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ title, description, className = "" }: EmptyStateProps) {
  const classes = ["rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
