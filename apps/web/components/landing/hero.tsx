import { type CSSProperties, Fragment } from 'react';
import { Container } from './frame';
import { HeroActions } from './hero-actions';
import { HeroForm } from './hero-form';

const headline = [
  { words: ['Forms', 'your', 'agent', 'writes.'], em: false },
  { words: ['Responses', 'you', 'own.'], em: true },
];
const WORD_START_MS = 80;
const WORD_STAGGER_MS = 45;

const spec: [string, string][] = [
  ['Written by', 'Your coding agent'],
  ['Runs on', 'One Node server'],
  ['Stored in', 'SQLite, on your disk'],
  ['License', 'MIT'],
];

export function Hero() {
  return (
    <section id="try" aria-labelledby="hero-heading" className="relative">
      <Container className="pt-10 pb-24 sm:pt-14 sm:pb-32 lg:pt-16">
        <div className="rise eyebrow flex items-center gap-3 border-b border-[color:var(--color-rule)] pb-3">
          <span className="text-[color:var(--color-text)]">OF-01</span>
          <span>Open-source form framework</span>
        </div>

        <h1
          id="hero-heading"
          className="display mt-10 text-[46px] leading-[0.98] sm:mt-14 sm:text-[72px] lg:text-[92px]"
        >
          {headline.map((line, li) => (
            <span key={line.words.join(' ')} className="block">
              {line.words.map((word, wi) => {
                const order =
                  headline
                    .slice(0, li)
                    .map((l) => l.words.length)
                    .reduce((a, b) => a + b, 0) + wi;
                const delay = { animationDelay: `${WORD_START_MS + order * WORD_STAGGER_MS}ms` };
                return (
                  <Fragment key={word}>
                    {wi > 0 ? ' ' : null}
                    {line.em ? (
                      <em className="rise rise-word" style={delay}>
                        {word}
                      </em>
                    ) : (
                      <span className="rise rise-word" style={delay}>
                        {word}
                      </span>
                    )}
                  </Fragment>
                );
              })}
            </span>
          ))}
        </h1>

        <div className="mt-10 grid grid-cols-1 gap-12 sm:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,580px)] lg:gap-16">
          <div className="flex flex-col items-start gap-8">
            <p
              className="rise max-w-[480px] text-pretty text-[17px] leading-[1.6] text-[color:var(--color-text-soft)] sm:text-[18px]"
              // The largest text on the page, so its paint is the LCP: it starts visible.
              style={{ animationDelay: '380ms', '--rise-opacity': 0.4 } as CSSProperties}
            >
              Describe the form to your coding agent. It writes one React file, and Open Form turns
              that file into a working form: checked in the browser and on the server, with a
              submission API, storage and a dashboard for the answers.
            </p>

            <div className="rise" style={{ animationDelay: '460ms' }}>
              <HeroActions />
            </div>

            <dl
              className="rise mt-auto hidden w-full max-w-[480px] border-t border-[color:var(--color-rule)] lg:block"
              style={{ animationDelay: '540ms' }}
            >
              {spec.map(([term, value]) => (
                <div
                  key={term}
                  className="flex h-10 items-center justify-between gap-6 border-b border-[color:var(--color-rule-soft)] text-[13.5px]"
                >
                  <dt className="caption">{term}</dt>
                  <dd className="text-[color:var(--color-text)]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rise-frame" style={{ animationDelay: '500ms' }}>
            <HeroForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
