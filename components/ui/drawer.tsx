"use client";

import { ReactNode, useEffect } from "react";

type DrawerProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  onRequestClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Drawer({
  isOpen,
  title,
  description,
  onRequestClose,
  children,
  footer,
  className = "",
}: DrawerProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onRequestClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onRequestClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-describedby={description ? "drawer-description" : undefined}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onRequestClose}
        aria-label="Close panel"
      />

      <div className="absolute inset-y-0 right-0 flex w-full justify-end sm:w-auto">
        <section
          className={[
            "flex h-full w-full max-w-none flex-col bg-white shadow-xl sm:max-w-2xl",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <header className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
            <div>
              <h2 id="drawer-title" className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {description ? (
                <p id="drawer-description" className="mt-1 text-sm text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={onRequestClose}
              aria-label="Close panel"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">{children}</div>

          {footer ? <footer className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">{footer}</footer> : null}
        </section>
      </div>
    </div>
  );
}
