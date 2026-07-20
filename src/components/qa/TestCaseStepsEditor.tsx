"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface StepDraft {
  action: string;
  testData: string;
  expectedResult: string;
}

const cellStyle: React.CSSProperties = {
  width: "100%", padding: "0.4rem 0.55rem", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.82rem",
};

export function TestCaseStepsEditor({ steps, onChange }: { steps: StepDraft[]; onChange: (steps: StepDraft[]) => void }) {
  function updateStep(index: number, field: keyof StepDraft, value: string) {
    onChange(steps.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function addStep() {
    onChange([...steps, { action: "", testData: "", expectedResult: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {steps.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "24px 1fr 1fr 1fr 28px", gap: "0.4rem", fontSize: "0.72rem", color: "var(--ink-muted)" }}>
          <span />
          <span>Action</span>
          <span>Test Data</span>
          <span>Expected Result</span>
          <span />
        </div>
      )}
      {steps.map((step, i) => (
        <div key={i} className="grid items-start" style={{ gridTemplateColumns: "24px 1fr 1fr 1fr 28px", gap: "0.4rem" }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", paddingTop: 6 }}>
            <GripVertical size={13} />
          </span>
          <textarea value={step.action} onChange={(e) => updateStep(i, "action", e.target.value)} rows={2} style={{ ...cellStyle, resize: "vertical" }} placeholder={`Step ${i + 1} action`} />
          <textarea value={step.testData} onChange={(e) => updateStep(i, "testData", e.target.value)} rows={2} style={{ ...cellStyle, resize: "vertical" }} />
          <textarea value={step.expectedResult} onChange={(e) => updateStep(i, "expectedResult", e.target.value)} rows={2} style={{ ...cellStyle, resize: "vertical" }} />
          <button type="button" onClick={() => removeStep(i)} title="Remove step" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", paddingTop: 6 }}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={addStep} style={{ alignSelf: "flex-start" }}>
        <Plus size={13} /> Add Step
      </Button>
    </div>
  );
}
