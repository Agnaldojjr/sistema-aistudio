export const config = { runtime: 'edge' };

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const fileParam = url.searchParams.get('file');
    const origin = url.origin;

    if (format === 'txt' || format === 'llms') {
      const res = await fetch(`${origin}/llms.txt`);
      const text = await res.text();
      return new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    if (format === 'full') {
      const res = await fetch(`${origin}/llms-full.txt`);
      const text = await res.text();
      return new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    const res = await fetch(`${origin}/ai-context.json`);
    const manifest = await res.json();

    if (fileParam && Array.isArray(manifest.files)) {
      const matched = manifest.files.find((f: any) => f.path === fileParam || f.path.endsWith(fileParam));
      if (!matched) {
        return new Response(JSON.stringify({ error: `Arquivo '${fileParam}' não encontrado no manifesto.` }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      if (format === 'raw' || url.searchParams.get('raw') === 'true') {
        return new Response(matched.content, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      return new Response(JSON.stringify(matched, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Falha ao carregar contexto de IA',
        details: err?.message || String(err),
        fallbackLinks: ['/llms.txt', '/llms-full.txt', '/ai-context.json', '/ai-inspector'],
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
