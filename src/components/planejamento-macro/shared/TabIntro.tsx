import React from "react";

interface Props {
  text: string;
  className?: string;
}

/**
 * Fase 7C — bloco discreto de introdução por aba.
 * Apenas apresentação; nenhuma lógica de negócio.
 */
const TabIntro: React.FC<Props> = ({ text, className }) => {
  return (
    <p
      className={
        "text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 mb-3 " +
        (className ?? "")
      }
    >
      {text}
    </p>
  );
};

export default TabIntro;
