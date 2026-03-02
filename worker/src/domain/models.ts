export interface Comment {
  id: string;
  author: string;
  text: string;
  parentId: string | null;
  score: number;
}

export interface Story {
  id: string;
  title: string;
  url: string;
  points: number;
  author: string;
  timestamp: Date;
  rawContent: string;
  comments: Comment[];
}

export interface SentimentCluster {
  label: string;
  type: 'positive' | 'negative' | 'mixed' | 'neutral' | 'debate';
  description: string;
  estimated_agreement: string;
}

export interface Analysis {
  topic: 'AI Fundamentals' | 'AI Applications' | 'Tech' | 'Politics' | 'Others';
  summary_paragraphs: string[];
  highlight: string;
  key_points: string[];
  article_sentiment: SentimentCluster;
  community_sentiments: SentimentCluster[];
}
