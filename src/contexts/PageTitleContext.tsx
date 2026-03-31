
import React, { createContext, useContext, useState, useCallback } from "react";

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
    setPageTitleState(title);
  }, []);

  return (
    <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
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
