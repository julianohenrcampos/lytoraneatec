import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  number: number;
  title: string;
  completed: boolean;
  current: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
  onStepClick?: (stepNumber: number) => void;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, onStepClick }) => {
  return (
    <div className="flex items-start justify-between w-full mb-6 px-2">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div
            className={cn(
              "flex flex-col items-center cursor-pointer min-w-0",
              !step.completed && !step.current && "opacity-50"
            )}
            onClick={() => step.completed || step.current ? onStepClick?.(step.number) : null}
          >
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors shrink-0",
                step.completed && "bg-primary border-primary text-primary-foreground",
                step.current && !step.completed && "border-primary text-primary bg-primary/10",
                !step.completed && !step.current && "border-muted-foreground text-muted-foreground"
              )}
            >
              {step.completed ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-xs font-semibold">{step.number}</span>
              )}
            </div>
            <span
              className={cn(
                "mt-1.5 text-xs font-medium text-center leading-tight",
                step.current && "text-primary",
                !step.current && step.completed && "text-foreground",
                !step.current && !step.completed && "text-muted-foreground"
              )}
            >
              {step.title}
            </span>
          </div>
          
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-1 mt-4 shrink",
                step.completed ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
