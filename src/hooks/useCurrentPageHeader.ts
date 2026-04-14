import { useLocation } from "react-router-dom";
import { menuStructure } from "@/constants/menuStructure";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { LucideIcon } from "lucide-react";

interface PageHeaderMeta {
  title: string;
  icon: LucideIcon | null;
}

export function useCurrentPageHeader(): PageHeaderMeta {
  const location = useLocation();
  const { pageTitle } = usePageTitle();

  // Search menuStructure for matching route
  for (const group of menuStructure) {
    for (const item of group.items) {
      if (location.pathname === item.href || location.pathname.startsWith(item.href + "/")) {
        return {
          title: pageTitle || item.name,
          icon: item.icon,
        };
      }
    }
  }

  // Fallback: use pageTitle without icon
  return {
    title: pageTitle || "",
    icon: null,
  };
}
