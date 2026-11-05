const DB_NAME = "vector-space-real-embeddings";
const STORE = "vectors";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Cache failures (private mode/quota) never replace a model with teaching data. */
export async function readEmbeddings(
  keys: string[],
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  let db: IDBDatabase | undefined;
  try {
    db = await openDatabase();
    const transaction = db.transaction(STORE, "readonly");
    await Promise.all(
      keys.map(
        (key) =>
          new Promise<void>((resolve, reject) => {
            const request = transaction.objectStore(STORE).get(key);
            request.onsuccess = () => {
              const value: unknown = request.result;
              if (
                Array.isArray(value) &&
                value.length === 384 &&
                value.every((x) => typeof x === "number" && Number.isFinite(x))
              )
                result.set(key, value);
              resolve();
            };
            request.onerror = () => reject(request.error);
          }),
      ),
    );
  } catch {
    /* Storage is optional; trained inference still runs. */
  } finally {
    db?.close();
  }
  return result;
}

export async function writeEmbeddings(
  entries: Array<[string, number[]]>,
): Promise<void> {
  if (!entries.length) return;
  let db: IDBDatabase | undefined;
  try {
    db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    entries.forEach(([key, value]) => store.put(value, key));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    /* The current session retains computed embeddings in memory. */
  } finally {
    db?.close();
  }
}
