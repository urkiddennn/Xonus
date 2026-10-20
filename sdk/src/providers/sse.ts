/**
 * Minimal Server-Sent Events parser for streaming chat APIs.
 *
 * Both OpenAI-compatible endpoints and Anthropic send JSON payloads in
 * `data:` lines. This reader yields one parsed JSON value per event and
 * ignores comments, keep-alives, and the `[DONE]` sentinel.
 */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');

      while (boundary !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
          .trim();

        if (data && data !== '[DONE]') {
          try {
            yield JSON.parse(data) as unknown;
          } catch {
            // Ignore malformed keep-alive frames rather than killing a stream.
          }
        }

        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
