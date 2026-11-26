// Text with its links clickable (opens in a new tab). Line breaks are kept by the parent's whitespace-pre-wrap.
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+\.[^\s<>"']+)/g;

export default function Linkify({ text }) {
  const parts = String(text ?? "").split(URL_RE);
  return parts.map((p, i) => {
    if (i % 2 === 0) return p;
    // Leave closing punctuation outside the link: "see https://x.com/a)." → link + ")."
    const [, url, tail] = p.match(/^(.*?)([).,;:!?\]]*)$/) || [null, p, ""];
    const href = url.startsWith("www.") ? `https://${url}` : url;
    return (
      <span key={i}>
        <a href={href} target="_blank" rel="noreferrer" className="break-all text-brand underline underline-offset-2 hover:opacity-80">
          {url}
        </a>
        {tail}
      </span>
    );
  });
}
