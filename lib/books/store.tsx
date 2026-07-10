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

/** 已导入的书籍条目(元数据+章节文本,持久存储) */
export interface StoredBook {
  id: string;
  title: string;
  /** 文件名,供显示 */
  fileName: string;
  /** "epub" | "pdf" | "scanned-epub" | "scanned-pdf" */
  format: string;
  /** 章节数 */
  sectionCount: number;
  /** 每章节的文本内容(按 extractedBook.sections 顺序) */
  sections: { title: string; text: string }[];
  /** 最近阅读位置:block 索引 */
  lastPosition: number;
  /** 导入时间戳 */
  importedAt: number;
  /** 最近阅读时间戳 */
  lastReadAt: number;
}

interface BookStore {
  books: StoredBook[];
  ready: boolean;
  addBook: (book: Omit<StoredBook, "id" | "importedAt" | "lastReadAt" | "lastPosition">) => StoredBook;
  deleteBook: (id: string) => void;
  updatePosition: (id: string, position: number) => void;
}

const Ctx = createContext<BookStore>({
  books: [],
  ready: false,
  addBook: () => { throw new Error("no provider"); },
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
          try {
            setBooks(JSON.parse(raw) as StoredBook[]);
          } catch {}
        }
      })
      .finally(() => setReady(true));
  }, []);

  const addBook = useCallback(
    (book: Omit<StoredBook, "id" | "importedAt" | "lastReadAt" | "lastPosition">) => {
      const entry: StoredBook = {
        ...book,
        id: genId(),
        importedAt: Date.now(),
        lastReadAt: Date.now(),
        lastPosition: 0,
      };
      setBooks((prev) => {
        const next = [entry, ...prev];
        AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      return entry;
    },
    [],
  );

  const deleteBook = useCallback(
    (id: string) => {
      setBooks((prev) => {
        const next = prev.filter((b) => b.id !== id);
        AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const updatePosition = useCallback(
    (id: string, position: number) => {
      setBooks((prev) => {
        const next = prev.map((b) =>
          b.id === id ? { ...b, lastPosition: position, lastReadAt: Date.now() } : b,
        );
        AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  return (
    <Ctx.Provider value={{ books, ready, addBook, deleteBook, updatePosition }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBookStore() {
  return useContext(Ctx);
}
