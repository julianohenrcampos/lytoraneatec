import React from "react";

interface Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

const TabHeader: React.FC<Props> = ({ title, description, actions }) => (
  <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
    <div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
    {actions}
  </div>
);

export default TabHeader;
