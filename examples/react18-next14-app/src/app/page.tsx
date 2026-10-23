import { cookies, draftMode } from 'next/headers';

interface PageProps {
  params: { slug: string };
  searchParams: { q?: string };
}

export default async function Page({ params, searchParams }: PageProps) {
  const cookieStore = cookies();
  const theme = cookieStore.get('theme');
  const { isEnabled } = draftMode();

  return (
    <main>
      <h1>Post: {params.slug}</h1>
      <p>Search: {searchParams.q ?? 'none'}</p>
      <p>Theme: {theme?.value ?? 'default'}</p>
      <p>Draft mode: {isEnabled ? 'on' : 'off'}</p>
    </main>
  );
}
