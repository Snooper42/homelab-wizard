
export interface Answer {
  value: string;
  label: string;
  detail: string;
}

export interface Question {
  /** The question, in the household's words. */
  ask: string;
  /** The apps it's asked for. */
  apps: string[];
  answers: Answer[];
}

export const questions: Record<string, Question> = {
  MEDIA_QUALITY: {
    ask: 'What do you mostly watch on?',
    apps: ['sonarr', 'radarr'],
    answers: [
      { value: 'save-space', label: 'Save space', detail: '1080p, the smaller files first: about 2–4 GB a film. Infuse, an Apple TV and most TVs play them.' },
      { value: 'hd', label: 'An HD TV or phones', detail: 'The best 1080p: about 8–15 GB a film.' },
      { value: '4k', label: 'A 4K TV', detail: '4K when there is one, else 1080p: about 15–25 GB a film.' },
    ],
  },
};
