import { EXAMPLES, type ExampleId } from "./registry";

interface ExamplesGalleryProps {
  activeId: ExampleId;
}

export const ExamplesGallery = ({ activeId }: ExamplesGalleryProps) => {
  const entry = EXAMPLES.find((example) => example.id === activeId);

  if (!entry) {
    return (
      <section className="app" aria-label="Unknown example">
        <div className="panel">
          <h2>Unknown example</h2>
          <p className="muted">No gallery entry exists for `{activeId}`.</p>
        </div>
      </section>
    );
  }

  const Component = entry.component;

  return (
    <section className="app" aria-label={entry.label}>
      <header className="panel panel-tight">
        <p className="eyebrow">Examples Gallery</p>
        <h2>{entry.label}</h2>
        <p className="muted">{entry.description}</p>
      </header>
      <Component />
    </section>
  );
};
