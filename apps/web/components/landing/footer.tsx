import { appName, npmUrl, repoUrl } from '@/lib/shared';
import { Container } from './frame';

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-rule-soft)]">
      <Container className="grid grid-cols-12 gap-x-6 gap-y-10 py-14 sm:py-16">
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-6">
          <div className="flex items-center gap-2.5 text-[14px] font-medium">
            <img
              src="/open-form.svg"
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              className="size-6"
            />
            <span className="tracking-[-0.01em]">{appName}</span>
          </div>
          <p className="max-w-[38ch] text-[14px] leading-[1.6] text-[color:var(--color-muted)]">
            The form framework built for agents. Free and open source under the MIT license.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            ['Live demo', '#demo'],
            ['Features', '#features'],
            ['FAQ', '#faq'],
          ]}
        />
        <FooterCol
          title="Docs"
          links={[
            ['Getting started', '/docs/getting-started'],
            ['Components', '/docs/components/form'],
            ['Agent skills', '/docs/skills/overview'],
            ['CLI', '/docs/cli/overview'],
          ]}
        />
        <FooterCol
          title="Elsewhere"
          links={[
            ['GitHub', repoUrl],
            ['npm', npmUrl],
            ['Issues', `${repoUrl}/issues`],
            ['llms.txt', '/llms.txt'],
          ]}
        />
      </Container>

      <div className="border-t border-[color:var(--color-rule-soft)]">
        <Container className="flex flex-col items-start justify-between gap-3 py-5 text-[13px] text-[color:var(--color-muted)] sm:flex-row sm:items-center sm:gap-0">
          <span>MIT License</span>
          <span>
            Inspired by{' '}
            <a
              href="https://open-slide.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--color-text)] transition-colors hover:text-[color:var(--color-muted)]"
            >
              open-slide
            </a>
            .
          </span>
        </Container>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="col-span-6 flex flex-col gap-4 md:col-span-4 lg:col-span-2">
      <div className="caption">{title}</div>
      <ul className="flex flex-col gap-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <a
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-[14px] text-[color:var(--color-text-soft)] transition-colors hover:text-[color:var(--color-text)]"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
