'use client';

import { useMemo, useState, useTransition } from 'react';

type SearchResourceType = 'announcement' | 'document' | 'link';

type ApiSearchResult = {
  id: string;
  type: SearchResourceType;
  title: string;
  highlightedTitle: string;
  highlightedDescription: string;
  link: string;
  category: string;
  updatedAt: string;
};

const typeLabel: Record<SearchResourceType, string> = {
  announcement: 'Announcement',
  document: 'Document',
  link: 'Link',
};

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/search?query=${encodeURIComponent(trimmed)}`
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          setError(payload?.error ?? 'Search failed.');
          return;
        }
        const payload = (await response.json()) as {
          results: ApiSearchResult[];
        };
        setResults(payload.results);
        setHasSearched(true);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error ? fetchError.message : 'Search failed.'
        );
      }
    });
  };

  const emptyStateMessage = useMemo(() => {
    if (!hasSearched) {
      return 'Try searching for announcements, documents, or curated links.';
    }
    if (results.length === 0) {
      return 'No results found. Adjust your keywords or department filters.';
    }
    return null;
  }, [hasSearched, results.length]);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search announcements, documents, links..."
          className="flex-1 border rounded-md px-3 py-2"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {emptyStateMessage && (
        <p className="text-sm text-muted-foreground">{emptyStateMessage}</p>
      )}

      <ul className="space-y-3">
        {results.map((result) => (
          <li
            key={`${result.type}-${result.id}`}
            className="border rounded-lg p-4 bg-card space-y-1"
          >
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {typeLabel[result.type]} · {result.category || 'general'}
            </span>
            <a
              href={result.link}
              className="block text-lg font-semibold text-primary hover:underline"
              dangerouslySetInnerHTML={{ __html: result.highlightedTitle }}
            />
            <p
              className="text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: result.highlightedDescription,
              }}
            />
            <p className="text-xs text-muted-foreground">
              Updated {new Date(result.updatedAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
