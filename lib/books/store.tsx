import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { genId } from "../recipes/types";

const BOOKS_KEY = "cocktail.books.v1";

/** Per-book metadata (no chapter content) */
export interface StoredBook {
  id: string;
  title: string;
  fileName: string;
  /** "epub" | "pdf" | "scanned-epub" | "scanned-pdf" */
  format: string;
  sectionCount: number;
  /** True when book was imported with HTML chapters (via extractEpubForReading) */
  hasHtml: boolean;
  /** EPUB CSS string (injected into reader) */
  css?: string;
  /** Plain-text sections (legacy / fallback) */
  sections: { title: string; text: string }[];
  lastPosition: number;
  /** Chapter index for HTML books */
  lastChapter: number;
  importedAt: number;
  lastReadAt: number;
  /** 作者 */
  author?: string;
  /** 出版社 */
  publisher?: string;
  /** ISBN */
  isbn?: string;
  /** 阅读状态: "unread" | "reading" | "completed" */
  readingStatus?: "unread" | "reading" | "completed";
  /** 是否收藏 */
  isFavorite?: boolean;
  /** 书籍分类标签 */
  tags?: string[];
  /** 笔记数量 */
  noteCount?: number;
  /** 高亮数量 */
  highlightCount?: number;
}

/** Chapter HTML stored under separate key to avoid bloating the books array */
const chapterKey = (bookId: string, idx: number) => `books.ch.${bookId}.${idx}`;

interface BookStore {
  books: StoredBook[];
  ready: boolean;
  addBook: (book: Omit<StoredBook, "id" | "importedAt" | "lastReadAt" | "lastPosition" | "lastChapter">) => StoredBook;
  addBookWithHtml: (
    meta: Omit<StoredBook, "id" | "importedAt" | "lastReadAt" | "lastPosition" | "lastChapter" | "sections" | "hasHtml">,
    chapters: { title: string; html: string }[],
  ) => Promise<StoredBook>;
  loadChapter: (bookId: string, idx: number) => Promise<string | null>;
  deleteBook: (id: string) => void;
  updatePosition: (id: string, position: number, chapter?: number) => void;
}

const Ctx = createContext<BookStore>({
  books: [],
  ready: false,
  addBook: () => { throw new Error("no provider"); },
  addBookWithHtml: async () => { throw new Error("no provider"); },
  loadChapter: async () => null,
  deleteBook: () => {},
  updatePosition: () => {},
});

export function BookStoreProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<StoredBook[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BOOKS_KEY)
      .then((raw) => {
        if (raw) {
          try { setBooks(JSON.parse(raw) as StoredBook[]); } catch {}
        }
      })
      .finally(() => setReady(true));
  }, []);

  const persist = (next: StoredBook[]) => {
    AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const addBook = useCallback(
    (book: Omit<StoredBook, "id" | "importedAt" | "lastReadAt" | "lastPosition" | "lastChapter">) => {
      const entry: StoredBook = {
        ...book,
        id: genId(),
        importedAt: Date.now(),
        lastReadAt: Date.now(),
        lastPosition: 0,
        lastChapter: 0,
      };
      setBooks((prev) => {
        const next = [entry, ...prev];
        persist(next);
        return next;
      });
      return entry;
    },
    [],
  );

  const addBookWithHtml = useCallback(
    async (
      meta: Omit<StoredBook, "id" | "importedAt" | "lastReadAt" | "lastPosition" | "lastChapter" | "sections" | "hasHtml">,
      chapters: { title: string; html: string }[],
    ): Promise<StoredBook> => {
      const id = genId();
      // Save each chapter HTML separately
      await Promise.all(
        chapters.map((ch, i) =>
          AsyncStorage.setItem(chapterKey(id, i), ch.html).catch(() => {}),
        ),
      );
      const entry: StoredBook = {
        ...meta,
        id,
        hasHtml: true,
        sections: chapters.map((ch) => ({ title: ch.title, text: "" })),
        importedAt: Date.now(),
        lastReadAt: Date.now(),
        lastPosition: 0,
        lastChapter: 0,
      };
      setBooks((prev) => {
        const next = [entry, ...prev];
        persist(next);
        return next;
      });
      return entry;
    },
    [],
  );

  const loadChapter = useCallback(async (bookId: string, idx: number): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(chapterKey(bookId, idx));
    } catch {
      return null;
    }
  }, []);

  const deleteBook = useCallback(
    (id: string) => {
      setBooks((prev) => {
        const book = prev.find((b) => b.id === id);
        const next = prev.filter((b) => b.id !== id);
        persist(next);
        // Clean up chapter HTML keys
        if (book?.hasHtml) {
          for (let i = 0; i < book.sectionCount; i++) {
            AsyncStorage.removeItem(chapterKey(id, i)).catch(() => {});
          }
        }
        return next;
      });
    },
    [],
  );

  const updatePosition = useCallback(
    (id: string, position: number, chapter?: number) => {
      setBooks((prev) => {
        const next = prev.map((b) =>
          b.id === id
            ? { ...b, lastPosition: position, lastChapter: chapter ?? b.lastChapter, lastReadAt: Date.now() }
            : b,
        );
        persist(next);
        return next;
      });
    },
    [],
  );

  return (
    <Ctx.Provider value={{ books, ready, addBook, addBookWithHtml, loadChapter, deleteBook, updatePosition }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBookStore() {
  return useContext(Ctx);
}
