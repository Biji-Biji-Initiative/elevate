export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return {} as T
  }
}

