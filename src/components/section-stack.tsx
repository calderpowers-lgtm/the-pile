import { filledGratitudes, SECTION_FIELDS, type SheetSections } from "@/lib/types";

export function SectionStack({
  sections,
  gratitudes,
}: {
  sections: SheetSections;
  gratitudes?: readonly string[];
}) {
  const thanks = gratitudes ? filledGratitudes(gratitudes) : [];

  return (
    <div className="space-y-5">
      {SECTION_FIELDS.map((field) => {
        const text = sections[field.id].trim();
        if (!text) return null;
        return (
          <section key={field.id}>
            <h3 className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{field.title}</h3>
            <p className="mt-1 font-serif text-lg leading-relaxed whitespace-pre-wrap">{text}</p>
          </section>
        );
      })}
      {thanks.length > 0 ? (
        <section className="border-t border-border pt-5">
          <h3 className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Grateful for</h3>
          <ol className="mt-2 space-y-2">
            {thanks.map((line, index) => (
              <li key={`${index}-${line.slice(0, 24)}`} className="font-serif text-lg leading-relaxed">
                {line}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
