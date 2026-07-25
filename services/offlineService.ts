import { get, set, del, keys } from 'idb-keyval';

export interface OfflineContent {
  id: string; // e.g., 'summary_class-10_math_chapter-1'
  title: string;
  subject: string;
  classId: string;
  type: 'summary' | 'qa' | 'paper';
  content: any;
  timestamp: number;
}

export const saveOfflineContent = async (
  classId: string,
  subjectId: string,
  chapterId: string,
  chapterTitle: string,
  type: 'summary' | 'qa' | 'paper',
  content: any
) => {
  const id = `${type}_${classId}_${subjectId}_${chapterId}`;
  const data: OfflineContent = {
    id,
    title: chapterTitle,
    subject: subjectId,
    classId,
    type,
    content,
    timestamp: Date.now(),
  };
  await set(id, data);
};

export const getOfflineContent = async (
  classId: string,
  subjectId: string,
  chapterId: string,
  type: 'summary' | 'qa' | 'paper'
): Promise<any | null> => {
  const id = `${type}_${classId}_${subjectId}_${chapterId}`;
  const data = await get<OfflineContent>(id);
  return data ? data.content : null;
};

export const getAllOfflineContent = async (): Promise<OfflineContent[]> => {
  const allKeys = await keys();
  const items: OfflineContent[] = [];
  for (const key of allKeys) {
    if (typeof key === 'string' && (key.startsWith('summary_') || key.startsWith('qa_') || key.startsWith('paper_'))) {
      const item = await get<OfflineContent>(key);
      if (item) items.push(item);
    }
  }
  return items.sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteOfflineContent = async (id: string) => {
  await del(id);
};

export const isOffline = () => !navigator.onLine;
