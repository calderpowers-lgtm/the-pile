import { sourcesFromFacts, SECTION_TITLES } from "@/lib/profile/sheet";
import { SOURCE_NOTES, type DrawnSheet, type SheetCitation, type FactSection, type SheetFact } from "@/lib/types";

const ORDER: FactSection[] = ["where", "income", "savings", "household", "health", "mental", "other"];

function Cite({ citation, how }: { citation: SheetCitation; how: string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer list-none text-xs leading-relaxed text-muted-foreground [&::-webkit-details-marker]:hidden">
        {citation.source} · {citation.indicator} · {citation.year} · {citation.geography}
      </summary>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">How this was drawn. </span>
        {how}
      </p>
    </details>
  );
}

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
  const sources = sourcesFromFacts([
    ...sheet.facts,
    ...(sheet.problems ?? []).map((problem) => ({ citation: problem.citation }) as SheetFact),
  ]);
  return (
    <article className="pile-shadow min-w-0 [overflow-wrap:anywhere] rounded-3xl border border-border bg-card px-5 py-6">
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">A sheet from the pile</p>
      <h2 tabIndex={-1} className="mt-3 font-serif text-4xl leading-tight tracking-tight outline-none">
        {sheet.name?.text ?? `${sheet.displayName}, ${sheet.age}`}
      </h2>
      <p className="mt-1 text-lg text-muted-foreground">
        {sheet.name ? `${sheet.displayName}, ${sheet.age} · ` : ""}
        {sheet.place}
      </p>
      {sheet.name ? <Cite citation={sheet.name.citation} how={sheet.name.howDrawn} /> : null}
      {sheet.headlineIncome ? (
        <div className="mt-5 rounded-2xl bg-secondary/60 px-4 py-4">
          <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">{sheet.headlineIncome.label}</p>
          <p className="mt-1 font-serif text-4xl leading-tight tracking-tight">
            {sheet.headlineIncome.usd} <span className="text-base font-sans text-muted-foreground">USD PPP</span>
          </p>
          {sheet.headlineIncome.local ? (
            <p className="mt-1 font-serif text-xl">
              ≈ {sheet.headlineIncome.local} <span className="text-sm font-sans text-muted-foreground">local currency, at PPP</span>
            </p>
          ) : null}
          <Cite citation={sheet.headlineIncome.citation} how={sheet.headlineIncome.howDrawn} />
        </div>
      ) : null}
      {sheet.problems ? (
        <section className="mt-6">
          <h3 className="text-xs font-medium tracking-[0.14em] text-primary uppercase">What they’re likely dealing with</h3>
          {sheet.problems.length === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">None of the individual problems in this dataset were drawn for this person. Population-level risks are below.</p>
          ) : (
            <ul className="mt-2">
              {sheet.problems.map((problem) => (
                <li key={problem.id} className="border-t border-border py-3 first:border-t-0">
                  <p className="font-serif text-lg leading-snug">{problem.statement}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{problem.probability}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {problem.citation.source} · {problem.citation.indicator} · {problem.citation.year} · {problem.citation.geography}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <p className="mt-6 font-serif text-xl leading-snug">One person, chosen from eight billion.</p>
      {sheet.problems ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The full sheet and population-level context, with the statistic behind each line.</p>
      ) : null}
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
