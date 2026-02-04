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
    <div className="flex items-center justify-center w-full mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div
            className={cn(
              "flex items-center cursor-pointer",
              !step.completed && !step.current && "opacity-50"
            )}
            onClick={() => step.completed || step.current ? onStepClick?.(step.number) : null}
          >
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                step.completed && "bg-primary border-primary text-primary-foreground",
                step.current && !step.completed && "border-primary text-primary bg-primary/10",
                !step.completed && !step.current && "border-muted-foreground text-muted-foreground"
              )}
            >
              {step.completed ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="text-sm font-semibold">{step.number}</span>
              )}
            </div>
            <span
              className={cn(
                "ml-2 text-sm font-medium",
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
                "w-16 h-0.5 mx-4",
                step.completed ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
