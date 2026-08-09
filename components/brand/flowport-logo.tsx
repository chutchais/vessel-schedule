type FlowPortLogoProps = {
  compact?: boolean;
  showDomain?: boolean;
  className?: string;
};

export function FlowPortLogo({ compact = false, showDomain = true, className = "" }: FlowPortLogoProps) {
  return <span role="img" aria-label="FlowPort" className={["inline-flex min-w-0 items-center whitespace-nowrap", className].filter(Boolean).join(" ")}>
    <span className={`${compact ? "text-lg" : "text-2xl"} font-extrabold tracking-[-0.04em] text-[#0b3b5c]`}>Flow<span className="text-[#2d7a9b]">Port</span></span>
    {showDomain ? <span className="ml-2 hidden rounded-full bg-slate-100 px-2.5 py-1 align-middle text-[0.6rem] font-medium tracking-[0.12em] text-slate-600 lg:inline">getflowport.com</span> : null}
  </span>;
}
