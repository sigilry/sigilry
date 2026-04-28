interface TabNavEntry<Id extends string> {
  id: Id;
  label: string;
}

interface TabNavProps<Id extends string> {
  tabs: readonly TabNavEntry<Id>[];
  activeId: Id;
  onSelect: (id: Id) => void;
}

export const TabNav = <Id extends string>({ tabs, activeId, onSelect }: TabNavProps<Id>) => (
  <>
    <style>
      {`
        .demo-tabnav-shell {
          width: min(100%, 880px);
          margin: 0 auto;
          padding: 2rem 2rem 0;
        }

        .demo-tabnav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          padding: 0.5rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--surface) 90%, transparent);
        }

        .demo-tabnav__tab {
          background: var(--surface);
          border-color: var(--border);
          color: var(--text);
        }

        .demo-tabnav__tab--active {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--accent-contrast);
        }
      `}
    </style>
    <div className="demo-tabnav-shell">
      <nav className="demo-tabnav" role="tablist" aria-label="Demo examples">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            tabIndex={tab.id === activeId ? 0 : -1}
            className={`demo-tabnav__tab${tab.id === activeId ? " demo-tabnav__tab--active" : ""}`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  </>
);
