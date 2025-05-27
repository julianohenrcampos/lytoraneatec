
import React from "react";

const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
      <span className="ml-2">Carregando dados...</span>
    </div>
  );
};

export default LoadingIndicator;
