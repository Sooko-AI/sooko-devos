"use client";

import type { ExecutionPlan } from "@/types";
import { Card } from "@/components/ui/Card";

export function PlanView({ plan }: { plan: ExecutionPlan }) {
  return (
    <div className="mb-6 animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-text-primary tracking-tight">
          Execution Plan
        </h2>
        <p className="text-[13px] text-white/40 mt-1">
          Structured breakdown of the implementation task
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {plan.steps.map((step, i) => (
          <Card
            key={step.id}
            className={`!p-4 animate-fade-in`}
            style={{ animationDelay: `${i * 0.08}s` } as React.CSSProperties}
          >
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent-light flex items-center justify-center text-xs font-bold shrink-0">
                {step.id}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">
                  {step.title}
                </p>
                <p className="text-xs text-white/40 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
