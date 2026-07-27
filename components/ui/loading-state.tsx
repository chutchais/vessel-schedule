type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({ message = "Loading...", className = "" }: LoadingStateProps) {
  const classes = ["py-12 text-center text-sm text-slate-500", className].filter(Boolean).join(" ");

  return <div className={classes}>{message}</div>;
}
