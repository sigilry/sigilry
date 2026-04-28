import { useState } from "react";

import { DAppPane } from "./components/dapp";
import { TabNav } from "./components/layout";
import { ExamplesGallery } from "./examples/ExamplesGallery";
import { EXAMPLES, type ExampleId } from "./examples/registry";

const TABS = [
  { id: "todo", label: "Todo Integration" },
  ...EXAMPLES.map((example) => ({
    id: example.id,
    label: example.label,
  })),
] as const;

type TabId = "todo" | ExampleId;

export const App = () => {
  const [activeId, setActiveId] = useState<TabId>("todo");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <TabNav tabs={TABS} activeId={activeId} onSelect={setActiveId} />
      {activeId === "todo" ? <DAppPane /> : <ExamplesGallery activeId={activeId} />}
    </div>
  );
};
