export type ElysiaError = {
  status: number;
  value: {
    type: string;
    on: string;
    summary?: string;
    message?: string;
    found?: unknown;
    property?: string;
    expected?: string;
  };
} | null;
