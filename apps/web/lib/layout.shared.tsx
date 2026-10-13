import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, repoUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img
            src="/open-form.svg"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="size-6"
          />
          <span>{appName}</span>
        </>
      ),
    },
    githubUrl: repoUrl,
  };
}
