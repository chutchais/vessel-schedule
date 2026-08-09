"use client";

import Link from "next/link";
import { useState } from "react";
import { FlowPortLogo } from "@/components/brand/flowport-logo";

const sectionLink = "rounded-sm text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
const secondaryAction = "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
const primaryAction = "inline-flex min-h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export function LandingHeader({ showPlatformSetup }: { showPlatformSetup: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <Link href="/" className="flex flex-col rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        <FlowPortLogo compact />
        <span className="sr-only">Visual berth planning for modern terminal operations.</span>
      </Link>
      <nav className="hidden items-center gap-6 md:flex" aria-label="Landing page sections">
        <a href="#capabilities" className={sectionLink}>Capabilities</a>
        <a href="#workflow" className={sectionLink}>Workflow</a>
        <a href="#security" className={sectionLink}>Security</a>
        <a href="#pilot" className={sectionLink}>Pilot</a>
        <a href="#contact" className={sectionLink}>Contact Us</a>
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        {showPlatformSetup ? <Link href="/request-access?setup=platform" className={secondaryAction}>Set Up Platform</Link> : null}
        <Link href="/login" className={secondaryAction}>Sign In</Link>
        <Link href="/request-access" className={primaryAction}>Request Access</Link>
      </div>
      <button type="button" aria-expanded={menuOpen} aria-controls="landing-mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen((open) => !open)} className="min-h-11 min-w-11 rounded-md border border-slate-300 text-xl text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden">{menuOpen ? "×" : "☰"}</button>
    </div>
    {menuOpen ? <div id="landing-mobile-menu" className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
      <nav className="grid gap-1" aria-label="Mobile landing page sections">
        {[['Capabilities', '#capabilities'], ['Workflow', '#workflow'], ['Security', '#security'], ['Pilot', '#pilot'], ['Contact Us', '#contact']].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{label}</a>)}
      </nav>
      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3">
        {showPlatformSetup ? <Link href="/request-access?setup=platform" onClick={() => setMenuOpen(false)} className={secondaryAction}>Set Up Platform</Link> : null}
        <Link href="/login" onClick={() => setMenuOpen(false)} className={secondaryAction}>Sign In</Link>
        <Link href="/request-access" onClick={() => setMenuOpen(false)} className={primaryAction}>Request Access</Link>
      </div>
    </div> : null}
  </header>;
}
