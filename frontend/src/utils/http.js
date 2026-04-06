export async function parseJsonSafely(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Received invalid JSON from server.');
  }
}
