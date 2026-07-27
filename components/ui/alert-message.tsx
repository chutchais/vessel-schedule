type AlertType = "success" | "error";

type AlertMessageProps = {
  type: AlertType;
  message: string;
  className?: string;
};

const classMap: Record<AlertType, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

export function AlertMessage({ type, message, className = "" }: AlertMessageProps) {
  const classes = ["rounded-md border px-4 py-3 text-sm", classMap[type], className]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{message}</div>;
}
