type StatusBadgeProps = {
  active: boolean;
  activeText?: string;
  inactiveText?: string;
  className?: string;
};

export function StatusBadge({
  active,
  activeText = "Active",
  inactiveText = "Inactive",
  className = "",
}: StatusBadgeProps) {
  const stateClasses = active
    ? "bg-green-100 text-green-700"
    : "bg-slate-100 text-slate-700";

  const classes = ["inline-flex rounded-full px-2.5 py-1 text-xs font-medium", stateClasses, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{active ? activeText : inactiveText}</span>;
}
