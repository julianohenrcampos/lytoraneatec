
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface PageTitleContextType {
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType>({
  pageTitle: "",
  setPageTitle: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [pageTitle, setPageTitleState] = useState("");

  const setPageTitle = useCallback((title: string) => {
    setPageTitleState(prev => prev === title ? prev : title);
  }, []);

  const value = useMemo(() => ({ pageTitle, setPageTitle }), [pageTitle, setPageTitle]);

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(title?: string) {
  const context = useContext(PageTitleContext);

  React.useEffect(() => {
    if (title) {
      context.setPageTitle(title);
    }
  }, [title]);

  return context;
}
