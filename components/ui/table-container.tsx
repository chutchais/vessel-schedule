import { ReactNode } from "react";

type TableContainerProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function TableContainer({ children, footer, className = "" }: TableContainerProps) {
  return (
    <div className={["overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm", className].filter(Boolean).join(" ")}>
      {children}
      {footer ? <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{footer}</div> : null}
    </div>
  );
}
