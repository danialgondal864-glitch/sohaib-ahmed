export const RESEARCH_CATEGORIES = [
  "AI & Emerging Technologies",
  "Latest AI Tools",
  "Research & Analysis",
  "Problem Solving",
  "Cloud & DevOps",
  "Future Technologies"
] as const;

export type PostCardData = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  read_time: number;
  created_at: string;
};
