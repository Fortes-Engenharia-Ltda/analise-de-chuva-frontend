import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  description?: string;
  icon?: ReactNode;
  variant?: "default" | "primary" | "secondary";
  className?: string;
}

export const KpiCard = ({ label, value, unit, description, icon, variant = "default", className }: KpiCardProps) => {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-card relative overflow-hidden",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <p className="text-3xl font-semibold tracking-tight">
            {value}
            {unit && <span className="text-base text-muted-foreground font-normal ml-1">{unit}</span>}
          </p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              variant === "primary" && "bg-primary-soft text-primary",
              variant === "secondary" && "bg-secondary-soft text-secondary",
              variant === "default" && "bg-muted text-muted-foreground"
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
