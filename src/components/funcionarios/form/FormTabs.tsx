
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Briefcase, FileText, DollarSign } from "lucide-react";

interface FormTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  className?: string;
}

const FormTabs: React.FC<FormTabsProps> = ({
  activeTab,
  setActiveTab,
  children,
  className
}) => {
  return (
    <Tabs
      defaultValue="pessoal"
      className={`w-full ${className || ''}`}
      value={activeTab}
      onValueChange={setActiveTab}
    >
      <TabsList className="grid grid-cols-4 mb-4">
        <TabsTrigger value="pessoal" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Dados Pessoais</span>
        </TabsTrigger>
        <TabsTrigger value="profissional" className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">Dados Profissionais</span>
        </TabsTrigger>
        <TabsTrigger value="contratual" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Dados Contratuais</span>
        </TabsTrigger>
        <TabsTrigger value="financeiro" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          <span className="hidden sm:inline">Dados Financeiros</span>
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
};

export default FormTabs;
