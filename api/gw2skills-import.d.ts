interface Gw2SkillsImportRequest {
  method?: string;
  query?: { url?: string | null };
}

interface Gw2SkillsImportResponse {
  setHeader(name: string, value: string): void;
  status(code: number): Gw2SkillsImportResponse;
  json(value: unknown): void;
}

export default function handler(request: Gw2SkillsImportRequest, response: Gw2SkillsImportResponse): Promise<void>;
