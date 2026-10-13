import { sourcesFromFacts, SECTION_TITLES } from "@/lib/profile/sheet";
import { SOURCE_NOTES, type DrawnSheet, type FactSection, type SheetFact } from "@/lib/types";

const ORDER: FactSection[] = ["where", "income", "savings", "household", "health", "mental", "other"];

function FactLine({ fact }: { fact: SheetFact }) {
  return (
    <li className="border-t border-border py-3 first:border-t-0">
      <details className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">{fact.label}</span>
          <span className="mt-1 block font-serif text-lg leading-snug">{fact.value}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {fact.citation.source} · {fact.citation.indicator} · {fact.citation.year} · {fact.citation.geography}
          </span>
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">How this was drawn. </span>
          {fact.howDrawn}
        </p>
      </details>
    </li>
  );
}

export function SheetCard({ sheet }: { sheet: DrawnSheet }) {
  const sources = sourcesFromFacts(sheet.facts);
  return (
    <article className="pile-shadow min-w-0 [overflow-wrap:anywhere] rounded-3xl border border-border bg-card px-5 py-6">
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">A sheet from the pile</p>
      <h2 tabIndex={-1} className="mt-3 font-serif text-4xl tracking-tight outline-none">
        {sheet.displayName}, {sheet.age}
      </h2>
      <p className="mt-1 text-lg text-muted-foreground">{sheet.place}</p>
      <p className="mt-4 font-serif text-xl leading-snug">One person, chosen from eight billion.</p>
      <div className="mt-6 space-y-6">
        {ORDER.map((section) => {
          const items = sheet.facts.filter((item) => item.section === section);
          if (items.length === 0) return null;
          return (
            <section key={section}>
              <h3 className="text-xs font-medium tracking-[0.14em] text-primary uppercase">{SECTION_TITLES[section]}</h3>
              <ul className="mt-1">{items.map((item) => <FactLine key={item.id} fact={item} />)}</ul>
            </section>
          );
        })}
      </div>
      <section className="mt-6 border-t border-border pt-4">
        <h3 className="text-xs font-medium tracking-[0.14em] text-primary uppercase">Sources</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Retrieved {sheet.facts[0]?.citation.retrieved}. Each figure is the published number, or a draw from that number. {SOURCE_NOTES[sheet.source]}
        </p>
        <ul className="mt-3 space-y-2">
          {sources.map((source) => (
            <li key={`${source.source}-${source.indicator}`} className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {source.source}. {source.indicator}. {source.url}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
