import Link from "next/link";

export default function PublicationPagination({
  path,
  params,
  page,
  pageCount
}: {
  path: string;
  params: Record<string, string>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }

  function pageHref(targetPage: number): string {
    const searchParams = new URLSearchParams(params);
    searchParams.set("page", String(targetPage));
    return `${path}?${searchParams.toString()}`;
  }

  return (
    <nav className="publication-pagination" aria-label="Publication pages">
      {page > 1 ? (
        <Link className="button button-ghost" href={pageHref(page - 1)}>Previous</Link>
      ) : (
        <span className="button button-ghost" aria-disabled="true">Previous</span>
      )}
      <span aria-live="polite">Page {page} of {pageCount}</span>
      {page < pageCount ? (
        <Link className="button button-ghost" href={pageHref(page + 1)}>Next</Link>
      ) : (
        <span className="button button-ghost" aria-disabled="true">Next</span>
      )}
    </nav>
  );
}
