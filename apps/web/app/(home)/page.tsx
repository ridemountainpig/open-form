import { FAQ, faqs } from '@/components/landing/faq';
import { Features } from '@/components/landing/features';
import { Footer } from '@/components/landing/footer';
import { GetStarted } from '@/components/landing/get-started';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Nav } from '@/components/landing/nav';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { fetchGitHubStars, formatStarCount } from '@/lib/github';
import {
  appName,
  description,
  gitConfig,
  initCommand,
  npmUrl,
  repoUrl,
  siteUrl,
} from '@/lib/shared';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appName,
    url: siteUrl,
    description,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: appName,
    description,
    codeRepository: repoUrl,
    programmingLanguage: 'TypeScript',
    url: siteUrl,
    license: `${repoUrl}/blob/${gitConfig.branch}/LICENSE`,
    sameAs: [repoUrl, npmUrl],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: appName,
    description,
    url: siteUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Linux, Windows',
    softwareRequirements: 'Node.js 22.13+',
    license: `${repoUrl}/blob/${gitConfig.branch}/LICENSE`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Build a form with Open Form',
    description:
      'Scaffold an Open Form workspace, ask an AI agent to write the form, then deploy one server that stores responses.',
    totalTime: 'PT2M',
    supply: [
      { '@type': 'HowToSupply', name: 'Node.js 22.13+' },
      { '@type': 'HowToSupply', name: 'An AI coding agent (Claude Code, Codex, Cursor, …)' },
    ],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Spin up a workspace',
        text: `Run ${initCommand} my-forms to scaffold the workspace, then npm run dev to open Studio.`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Ask your agent',
        text: 'Use /create-form and your agent writes the questions and logic as a small React file.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Share it, collect responses',
        text: 'Run pnpm build and pnpm start. Responses are stored in SQLite and shown in Studio.',
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  },
];

export default async function HomePage() {
  const stars = await fetchGitHubStars();
  const githubStars = stars !== null ? formatStarCount(stars) : null;

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is built from static, server-only constants
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav githubStars={githubStars} />
      <ScrollReveal />
      <main className="relative flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <FAQ />
        <GetStarted />
      </main>
      <Footer />
    </>
  );
}
