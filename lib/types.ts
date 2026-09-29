export type SessionData = {
  exerciseId: string;
  status: "draft" | "submitted";
  answers: string[];
  essay: string;
  notes: string;
  elapsed: number;
  audioTime: number;
  score?: number | null;
  results?: boolean[];
};
export type WordData = {
  word: string;
  meaning: string;
  example: string;
  source: string;
  stage: number;
  due: number;
  reviews: number;
};
export type StudyRecord = {
  id: string;
  kind: "session" | "word";
  data: SessionData | WordData;
  revision: number;
  updated: number;
};
