import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface AssetInfoSectionProps {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

const AssetInfoSection: React.FC<AssetInfoSectionProps> = ({
  title,
  icon: Icon,
  action,
  className,
  contentClassName,
  children,
}) => (
  <Card className={cn("border-border/70 shadow-none", className)}>
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/60 px-4 py-3">
      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon ? <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
        {title}
      </CardTitle>
      {action}
    </CardHeader>
    <CardContent className={cn("px-4 py-3", contentClassName)}>{children}</CardContent>
  </Card>
);

export default AssetInfoSection;
